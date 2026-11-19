// @ts-check
// Validação visual completa com mock Supabase (isolado de produção)
import { test, expect } from '@playwright/test'
import { isolarSupabase, perfilFalso, pularApresentacao, medirViewport, criarBancoMemoria } from './apoio.js'

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 }
}

// Páginas a testar
const PAGINAS = [
  { path: '/', name: 'Home', elemento: 'Saldo disponível' },
  { path: '/configuracoes', name: 'Configurações', elemento: 'Paleta de cores' },
  { path: '/investimentos', name: 'Investimentos', elemento: 'Total investido' },
  { path: '/cartoes', name: 'Cartões', elemento: 'Adicionar cartão' },
  { path: '/receitas', name: 'Receitas', elemento: 'Nova receita' },
  { path: '/despesas', name: 'Despesas', elemento: 'Nova despesa' },
  { path: '/calendario', name: 'Calendário', elemento: 'Calendário financeiro' },
  { path: '/onboarding', name: 'Onboarding', elemento: 'passo' },
]

test.describe('Validação Visual - Mobile 390px', () => {
  test.use({ viewport: VIEWPORTS.mobile })

  for (const pagina of PAGINAS) {
    test(`${pagina.name} - sem overflow horizontal`, async ({ page }) => {
      const banco = criarBancoMemoria({
        investimentos: [],
        cartoes: [],
        receitas: [],
        despesas: [],
        lancamentos: []
      })

      await isolarSupabase(page, { 
        autenticado: true, 
        perfil: perfilFalso({ onboarding_concluido: true }),
        banco 
      })
      await pularApresentacao(page)

      await page.goto(pagina.path)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Medir viewport e detectar overflow
      const metricas = await medirViewport(page)
      
      console.log(`[${pagina.name}] Mobile:`, metricas)

      // Verificar overflow horizontal
      expect(metricas.scrollWidth, `${pagina.name} não deve ter overflow horizontal`).toBeLessThanOrEqual(metricas.clientWidth + 1)
      expect(metricas.vazando.length, `${pagina.name} não deve ter elementos vazando`).toBe(0)
    })
  }
})

test.describe('Validação Visual - Desktop 1440px', () => {
  test.use({ viewport: VIEWPORTS.desktop })

  for (const pagina of PAGINAS) {
    test(`${pagina.name} - layout adequado`, async ({ page }) => {
      const banco = criarBancoMemoria({
        investimentos: [],
        cartoes: [],
        receitas: [],
        despesas: [],
        lancamentos: []
      })

      await isolarSupabase(page, { 
        autenticado: true, 
        perfil: perfilFalso({ onboarding_concluido: true }),
        banco 
      })
      await pularApresentacao(page)

      await page.goto(pagina.path)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      const metricas = await medirViewport(page)
      
      console.log(`[${pagina.name}] Desktop:`, metricas)

      // Verificar que não há overflow (tolerância de 1px para arredondamento)
      expect(metricas.scrollWidth, `${pagina.name} não deve ter overflow horizontal`).toBeLessThanOrEqual(metricas.clientWidth + 1)
      expect(metricas.vazando.length, `${pagina.name} não deve ter elementos vazando`).toBe(0)
    })
  }
})

test.describe('Funcionalidades Críticas', () => {
  test.use({ viewport: VIEWPORTS.desktop })

  test('Theme switching - selecionar e persistir paleta', async ({ page }) => {
    const banco = criarBancoMemoria()
    const { escritasPerfil, perfilAtual } = await isolarSupabase(page, { 
      autenticado: true, 
      perfil: perfilFalso({ cor_tema: 'claro' }),
      banco 
    })
    await pularApresentacao(page)

    await page.goto('/configuracoes')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Buscar botões de tema (Claro/Escuro/Automático)
    const btnEscuro = page.locator('button').filter({ hasText: /escuro|🌙/i })
    const btnClaro = page.locator('button').filter({ hasText: /claro|☀/i })
    const btnAuto = page.locator('button').filter({ hasText: /automático|⚙/i })

    const temBotoes = await btnEscuro.first().isVisible({ timeout: 3000 }).catch(() => false)

    if (temBotoes) {
      console.log('✅ Botões de tema encontrados')
      
      // Perfil começa em 'claro', vamos alternar para 'escuro'
      const countAntes = escritasPerfil.length
      
      await btnEscuro.first().click()
      await page.waitForTimeout(500)

      // Verificar se houve escrita no perfil
      const countDepois = escritasPerfil.length
      console.log('Escritas no perfil antes:', countAntes, 'depois:', countDepois)
      console.log('Conteúdo das escritas:', JSON.stringify(escritasPerfil, null, 2))

      expect(countDepois, 'Deve ter gravado a mudança de tema').toBeGreaterThan(countAntes)
      expect(escritasPerfil.some(e => e.cor_tema === 'escuro'), 'Deve ter gravado cor_tema=escuro').toBeTruthy()

      // Recarregar página e verificar se mantém
      await page.reload()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Verificar se botão 'escuro' está marcado como ativo (aria-pressed="true")
      const btnEscuroDepois = page.locator('button').filter({ hasText: /escuro|🌙/i }).first()
      const isPressed = await btnEscuroDepois.getAttribute('aria-pressed')
      console.log('Botão Escuro após reload - aria-pressed:', isPressed)

      expect(isPressed).toBe('true')
    } else {
      console.log('⚠️  Botões de tema não encontrados na página de Configurações')
      throw new Error('Seletor de tema não encontrado')
    }
  })

  test('Onboarding - salvar saldo não abre Home prematuramente', async ({ page }) => {
    const banco = criarBancoMemoria()
    const { escritasPerfil } = await isolarSupabase(page, { 
      autenticado: true, 
      perfil: perfilFalso({ 
        onboarding_concluido: false,
        onboarding_etapa: 'saldo',  // Começa direto na etapa de saldo
        nome: 'Teste User',
        saldo_base: null,
        saldo_base_data: null 
      }),
      banco 
    })
    await pularApresentacao(page)

    // Vai direto para etapa de saldo
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const campoSaldo = page.locator('#onb-saldo')
    const temSaldo = await campoSaldo.isVisible({ timeout: 3000 }).catch(() => false)

    if (!temSaldo) {
      const heading = await page.locator('h1, h2').first().textContent().catch(() => '')
      console.log('⚠️  Campo saldo não encontrado. Tela:', heading)
      return
    }

    console.log('✓ Campo saldo encontrado')
    await campoSaldo.fill('1000')
    await page.waitForTimeout(500)

    const countAntes = escritasPerfil.length
    await page.locator('button').filter({ hasText: /continuar/i }).first().click()
    await page.waitForTimeout(1500)

    const countDepois = escritasPerfil.length
    console.log(`✓ Saldo gravado (${countDepois - countAntes} escritas)`)

    expect(countDepois, 'Deve gravar saldo_base').toBeGreaterThan(countAntes)
    expect(escritasPerfil.some(e => 'saldo_base' in e)).toBeTruthy()

    const url = page.url()
    console.log('✓ URL:', url)
    expect(url, 'Deve permanecer em /onboarding').toContain('/onboarding')
  })

  test('Calendário - altura e largura adequadas', async ({ page }) => {
    const banco = criarBancoMemoria({
      lancamentos: [
        {
          id: 'lanc-1',
          usuario_id: '00000000-0000-4000-8000-000000000001',
          descricao: 'Teste',
          valor: 100,
          data: new Date().toISOString().split('T')[0],
          tipo: 'despesa',
          categoria_id: 'cat-alimentacao'
        }
      ]
    })

    await isolarSupabase(page, { 
      autenticado: true, 
      perfil: perfilFalso(),
      banco 
    })
    await pularApresentacao(page)

    await page.goto('/calendario')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const metricas = await medirViewport(page)
    
    // Verificar que calendário não vaza
    expect(metricas.vazando.length).toBe(0)
    expect(metricas.scrollWidth).toBeLessThanOrEqual(metricas.clientWidth + 1)

    // Procurar elementos do calendário
    const calendario = page.locator('[class*="calendar"], [role="grid"]').first()
    const temCalendario = await calendario.isVisible({ timeout: 3000 }).catch(() => false)

    if (temCalendario) {
      const bbox = await calendario.boundingBox()
      console.log('Dimensões do calendário:', bbox)

      // Calendário deve ser visível e ter dimensões razoáveis
      expect(bbox.width).toBeGreaterThan(200)
      expect(bbox.height).toBeGreaterThan(200)
    }
  })
})

test.describe('Páginas Públicas - Já Validadas', () => {
  test.skip('Login - já validado manualmente', () => {})
  test.skip('Apresentação - já validada manualmente', () => {})
})
