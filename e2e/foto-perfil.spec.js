import { test, expect } from '@playwright/test'
import sharp from 'sharp'
import { isolarSupabase, perfilFalso, USUARIO_TESTE } from './apoio'

// Foto de perfil com Storage FALSO em memória (bucket privado). Nada chega
// ao Supabase real. Verifica recorte, compressão, URL assinada e persistência.
const U = USUARIO_TESTE.id
let fotoGrande
test.beforeAll(async () => {
  // Foto de celular simulada: 4000×3000, JPEG.
  fotoGrande = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: { r: 128, g: 29, b: 57 } } }).jpeg({ quality: 95 }).toBuffer()
})

async function abrirPerfil(page, opcoes = {}) {
  const storage = opcoes.storage || new Map()
  const ctx = await isolarSupabase(page, { autenticado: true, storage, ...opcoes })
  await page.goto('/mais/perfil')
  await page.getByTitle('Alterar foto').click({ timeout: 20_000 })
  return { ...ctx, storage }
}
const escolher = (page, name, mimeType, buffer) => page.getByTestId('foto-arquivo').setInputFiles({ name, mimeType, buffer })
const fotoVisivel = page => page.getByTestId('foto-perfil-img').filter({ visible: true }).first()
const aviso = page => page.locator('.bg-red-50')

test('foto grande do celular: recorte circular, envio como JPEG 512 px e exibição por URL assinada', async ({ page }) => {
  const { storage, escritasPerfil } = await abrirPerfil(page)
  await escolher(page, 'IMG_0001.JPG', 'image/jpeg', fotoGrande)
  await expect(page.getByTestId('recorte-foto')).toBeVisible()
  await page.getByLabel('Zoom da foto').fill('1.5')
  await page.getByRole('button', { name: 'Salvar foto' }).click()
  await expect(page.getByText('Alterar foto de perfil')).toHaveCount(0)

  expect(storage.size).toBe(1)
  const [caminho, obj] = [...storage.entries()][0]
  expect(caminho).toMatch(new RegExp(`^${U}/perfil-\\d+\\.jpg$`))
  expect(escritasPerfil.find(e => 'foto_url' in e)).toMatchObject({ foto_url: caminho, avatar_id: null })
  // O WebKit do Playwright não expõe o corpo de uploads multipart na
  // interceptação: o conteúdo do arquivo só é conferido no Chromium.
  test.skip(obj.corpo.length === 0, 'conteúdo do upload indisponível na interceptação deste navegador')
  const meta = await sharp(obj.corpo).metadata()
  expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 512, 512])
  expect(obj.corpo.length).toBeLessThan(fotoGrande.length / 4)
  expect(escritasPerfil.find(e => 'foto_url' in e)).toMatchObject({ foto_url: caminho, avatar_id: null })

  const img = fotoVisivel(page)
  await expect(img).toBeVisible()
  await expect.poll(() => img.evaluate(el => el.naturalWidth)).toBe(512)

  // Persistência após recarregar (novo carregamento do perfil).
  await page.reload()
  await expect(fotoVisivel(page)).toBeVisible({ timeout: 20_000 })
})

test('substituir a foto remove a anterior do bucket', async ({ page }) => {
  const storage = new Map([[`${U}/perfil-1.jpg`, { tipo: 'image/jpeg', corpo: await sharp(fotoGrande).resize(512, 512).jpeg().toBuffer() }]])
  const { escritasPerfil } = await abrirPerfil(page, { storage, perfil: perfilFalso({ foto_url: `${U}/perfil-1.jpg` }) })
  await escolher(page, 'nova.png', 'image/png', await sharp(fotoGrande).resize(800, 600).png().toBuffer())
  await page.getByRole('button', { name: 'Salvar foto' }).click()
  await expect(page.getByText('Alterar foto de perfil')).toHaveCount(0)
  expect([...storage.keys()]).toHaveLength(1)
  expect(storage.has(`${U}/perfil-1.jpg`)).toBe(false)
  expect(escritasPerfil.at(-1).foto_url).not.toBe(`${U}/perfil-1.jpg`)
})

test('foto antiga gravada como URL pública continua aparecendo (bucket privado)', async ({ page }) => {
  const storage = new Map([[`${U}/antiga.jpg`, { tipo: 'image/jpeg', corpo: await sharp(fotoGrande).resize(64, 64).jpeg().toBuffer() }]])
  await isolarSupabase(page, { autenticado: true, storage, perfil: perfilFalso({ foto_url: `https://ievccupeijzuzhomphwn.supabase.co/storage/v1/object/public/avatares/${U}/antiga.jpg` }) })
  await page.goto('/mais/perfil')
  await expect(fotoVisivel(page)).toBeVisible({ timeout: 20_000 })
  await expect.poll(() => fotoVisivel(page).evaluate(el => el.naturalWidth)).toBe(64)
})

test('sem foto mostra as iniciais; arquivo da foto removido também cai nas iniciais', async ({ page }) => {
  await isolarSupabase(page, { autenticado: true, perfil: perfilFalso({ foto_url: `${U}/inexistente.jpg` }) })
  await page.goto('/mais/perfil')
  await expect(page.getByText('TE', { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('foto-perfil-img')).toHaveCount(0)
})

test('formato incompatível, arquivo muito grande e HEIC ilegível: mensagens claras, nada enviado', async ({ page }) => {
  const { storage, escritasPerfil } = await abrirPerfil(page)
  await escolher(page, 'anim.gif', 'image/gif', Buffer.from('GIF89a'))
  await expect(aviso(page)).toContainText('Formato não suportado')
  await escolher(page, 'enorme.jpg', 'image/jpeg', Buffer.alloc(26 * 1024 * 1024, 1))
  await expect(aviso(page)).toContainText('25 MB')
  await escolher(page, 'IMG.HEIC', 'image/heic', Buffer.from('nao e uma imagem heic'))
  await expect(aviso(page)).toContainText('HEIC')
  await escolher(page, 'quebrada.jpg', 'image/jpeg', Buffer.from('lixo'))
  await expect(aviso(page)).toContainText('corrompido')
  expect(storage.size).toBe(0)
  expect(escritasPerfil.some(e => 'foto_url' in e)).toBe(false)
})

test('falha de rede no envio: mensagem clara e foto atual preservada', async ({ page }) => {
  const { escritasPerfil } = await abrirPerfil(page, { falharStorage: true, perfil: perfilFalso({ foto_url: `${U}/perfil-1.jpg` }) })
  await escolher(page, 'foto.jpg', 'image/jpeg', fotoGrande)
  await page.getByRole('button', { name: 'Salvar foto' }).click()
  await expect(aviso(page)).toContainText('Sem conexão')
  expect(escritasPerfil.some(e => 'foto_url' in e)).toBe(false)
})
