// VALIDAÇÃO FINAL DE PRODUÇÃO
// Verifica rotas e recursos críticos no deploy Vercel
import https from 'https'

const BASE_URL = 'almeida-finance.vercel.app'

const ROTAS_CRITICAS = [
  '/',
  '/login',
  '/cadastro',
  '/receitas',
  '/despesas',
  '/cartoes',
  '/investimentos',
  '/importacao',
  '/admin'
]

const RECURSOS = [
  '/manifest.webmanifest',
  '/branding/favicon-32.png',
  '/branding/icon-192.png',
  '/branding/icon-512.png',
  '/branding/apple-touch-icon.png',
  '/branding/af-icone.png'
]

let falhas = 0

function verificarURL(path) {
  return new Promise((resolve) => {
    https.get(`https://${BASE_URL}${path}`, (res) => {
      const isOK = res.statusCode === 200
      const isRedirect = res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307
      
      resolve({
        path,
        status: res.statusCode,
        ok: isOK,
        redirect: isRedirect,
        location: res.headers.location,
        contentType: res.headers['content-type'],
        contentLength: res.headers['content-length']
      })
    }).on('error', (err) => {
      resolve({
        path,
        status: 0,
        ok: false,
        error: err.message
      })
    })
  })
}

console.log('# VALIDAÇÃO FINAL DE PRODUÇÃO\n')
console.log(`🌐 URL Base: https://${BASE_URL}\n`)

async function verificarRotas() {
  console.log('═'.repeat(60))
  console.log('ROTAS DA APLICAÇÃO')
  console.log('═'.repeat(60))
  console.log('')
  
  for (const rota of ROTAS_CRITICAS) {
    const resultado = await verificarURL(rota)
    
    if (resultado.error) {
      console.log(`❌ ${rota}`)
      console.log(`   Erro: ${resultado.error}`)
      falhas++
    } else if (resultado.ok) {
      console.log(`✅ ${rota}`)
      console.log(`   Status: ${resultado.status}`)
      console.log(`   Content-Type: ${resultado.contentType}`)
    } else if (resultado.redirect) {
      console.log(`↪️  ${rota}`)
      console.log(`   Status: ${resultado.status} (redirect)`)
      console.log(`   Location: ${resultado.location || 'N/A'}`)
    } else {
      console.log(`⚠️  ${rota}`)
      console.log(`   Status: ${resultado.status}`)
      falhas++
    }
    
    console.log('')
  }
}

async function verificarRecursos() {
  console.log('═'.repeat(60))
  console.log('RECURSOS ESTÁTICOS (PWA)')
  console.log('═'.repeat(60))
  console.log('')
  
  for (const recurso of RECURSOS) {
    const resultado = await verificarURL(recurso)
    
    if (resultado.error) {
      console.log(`❌ ${recurso}`)
      console.log(`   Erro: ${resultado.error}`)
      falhas++
    } else if (resultado.ok) {
      const size = resultado.contentLength ? ` (${resultado.contentLength} bytes)` : ''
      console.log(`✅ ${recurso}${size}`)
    } else {
      console.log(`⚠️  ${recurso}`)
      console.log(`   Status: ${resultado.status}`)
      if (recurso.includes('manifest') || recurso.includes('icon')) {
        console.log(`   ⚠️  Recurso PWA ausente pode afetar instalação`)
        falhas++
      }
    }
    
    console.log('')
  }
}

async function verificarSPARouting() {
  console.log('═'.repeat(60))
  console.log('ROTEAMENTO SPA (Vite)')
  console.log('═'.repeat(60))
  console.log('')
  
  // Verificar se rota inexistente retorna index.html (SPA fallback)
  const resultado = await verificarURL('/rota-que-nao-existe-xyz123')
  
  if (resultado.ok && resultado.contentType?.includes('text/html')) {
    console.log(`✅ Fallback para index.html funcionando`)
    console.log(`   Rotas SPA funcionarão corretamente (React Router)`)
  } else {
    console.log(`⚠️  Fallback SPA pode estar incorreto`)
    console.log(`   Status: ${resultado.status}`)
    console.log(`   Content-Type: ${resultado.contentType}`)
    falhas++
  }
  
  console.log('')
}

async function main() {
  await verificarRotas()
  await verificarRecursos()
  await verificarSPARouting()
  
  console.log('═'.repeat(60))
  console.log('RESULTADO FINAL')
  console.log('═'.repeat(60))
  console.log('')
  
  if (falhas === 0) {
    console.log('✅ VALIDAÇÃO DE PRODUÇÃO: APROVADA')
    console.log('')
    console.log('Todas as verificações passaram:')
    console.log('  ✓ Rotas da aplicação acessíveis')
    console.log('  ✓ Recursos PWA presentes')
    console.log('  ✓ Roteamento SPA funcionando')
    console.log('')
    console.log(`🚀 Aplicação funcionando em: https://${BASE_URL}`)
    process.exit(0)
  } else {
    console.log(`⚠️  VALIDAÇÃO DE PRODUÇÃO: ${falhas} PROBLEMA(S)`)
    console.log('')
    console.log('Verifique os itens marcados acima.')
    console.log('Alguns problemas podem ser não-críticos (ex: recursos opcionais).')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('\n❌ ERRO FATAL:', err)
  process.exit(1)
})
