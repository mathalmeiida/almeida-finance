// Testes das regras da foto de perfil — lib PURA.
import { caminhoFoto, validarArquivoFoto, ehHeic, recorteQuadrado, caminhoNovaFoto, mensagemErroFoto } from '../src/lib/fotoPerfil.js'

let falhas = 0
function assert(nome, cond) { if (!cond) falhas++; console.log(`${cond ? 'PASS' : 'FALHA'} — ${nome}`) }
const arq = (name, type, size) => ({ name, type, size })

console.log('# Caminho no bucket privado')
assert('caminho simples', caminhoFoto('u1/perfil-1.jpg') === 'u1/perfil-1.jpg')
assert('URL pública antiga → caminho', caminhoFoto('https://x.supabase.co/storage/v1/object/public/avatares/u1/perfil-1.jpg') === 'u1/perfil-1.jpg')
assert('URL com espaço codificado e query', caminhoFoto('https://x.supabase.co/storage/v1/object/public/avatares/u1/a%20b.png?v=2') === 'u1/a b.png')
assert('vazio → null', caminhoFoto(null) === null && caminhoFoto('') === null)
assert('novo caminho na pasta do usuário', caminhoNovaFoto('u1', 123) === 'u1/perfil-123.jpg')

console.log('\n# Validação do arquivo')
assert('JPEG grande (12 MB) aceito: é reduzido antes do envio', validarArquivoFoto(arq('a.jpg', 'image/jpeg', 12e6)) === null)
assert('PNG, WebP e HEIC aceitos', ['image/png', 'image/webp', 'image/heic'].every(t => validarArquivoFoto(arq('x', t, 100)) === null))
assert('tipo vazio com extensão .heic aceito (Android)', validarArquivoFoto(arq('IMG.HEIC', '', 100)) === null)
assert('GIF recusado', /Formato/.test(validarArquivoFoto(arq('a.gif', 'image/gif', 100))))
assert('PDF recusado', /Formato/.test(validarArquivoFoto(arq('a.pdf', 'application/pdf', 100))))
assert('acima de 25 MB recusado', /25 MB/.test(validarArquivoFoto(arq('a.jpg', 'image/jpeg', 26 * 1024 * 1024))))
assert('vazio recusado', /vazio/.test(validarArquivoFoto(arq('a.jpg', 'image/jpeg', 0))))
assert('detecta HEIC', ehHeic(arq('a.heif', '', 1)) && ehHeic(arq('x', 'image/heic', 1)) && !ehHeic(arq('a.jpg', 'image/jpeg', 1)))

console.log('\n# Recorte quadrado')
let r = recorteQuadrado({ largura: 4000, altura: 3000 })
assert('centralizado: lado = menor dimensão', r.lado === 3000 && r.sx === 500 && r.sy === 0)
r = recorteQuadrado({ largura: 4000, altura: 3000, zoom: 2, deslocX: 1, deslocY: -1 })
assert('zoom 2 e deslocamento até a borda', r.lado === 1500 && r.sx === 2500 && r.sy === 0)
r = recorteQuadrado({ largura: 100, altura: 100, zoom: 99, deslocX: 9 })
assert('limites: zoom máx. 4, deslocamento máx. 1, recorte dentro da imagem', r.lado === 25 && r.sx + r.lado <= 100)

console.log('\n# Mensagens')
assert('rede', /Sem conexão/.test(mensagemErroFoto(new Error('Failed to fetch'))))
assert('permissão', /permissão/.test(mensagemErroFoto({ message: 'new row violates row-level security policy' })))
assert('genérica sem detalhes técnicos', mensagemErroFoto(new Error('xyz')) === 'Não foi possível salvar a foto. Tente novamente.')

console.log(falhas === 0 ? '\nOK — todos os testes passaram' : `\n${falhas} FALHA(S)`)
if (falhas) process.exitCode = 1
