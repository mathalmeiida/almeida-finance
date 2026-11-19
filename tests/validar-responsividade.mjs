// Validação visual de responsividade - páginas principais
import { chromium } from '@playwright/test'

const VIEWPORTS = [
  { name: 'mobile-small', width: 375, height: 667 },   // iPhone SE
  { name: 'mobile-large', width: 430, height: 932 },   // iPhone 14 Pro Max
  { name: 'desktop-medium', width: 1366, height: 768 }, // Laptop comum
  { name: 'desktop-large', width: 1920, height: 1080 }, // Full HD
]

const PAGINAS = [
  { nome: 'Login', url: '/login', publica: true },
  { nome: 'Planos', url: '/planos', publica: false },
  { nome: 'Mais', url: '/mais', publica: false },
]

async function validarResponsividade() {
  console.log('🔍 Iniciando validação de responsividade\n')
  
  const browser = await chromium.launch({ headless: true })
  const problemas = []

  try {
    for (const viewport of VIEWPORTS) {
      console.log(`📱 Testando ${viewport.name} (${viewport.width}x${viewport.height})`)
      
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
      })
      const page = await context.newPage()

      for (const pagina of PAGINAS) {
        if (!pagina.publica) {
          console.log(`  ⚠️  ${pagina.nome}: pula (requer autenticação)`)
          continue
        }

        try {
          console.log(`  📄 ${pagina.nome}...`)
          await page.goto(`http://localhost:5173${pagina.url}`, { 
            waitUntil: 'networkidle',
            timeout: 10000 
          })
          
          // Verifica overflow horizontal
          const hasHorizontalScroll = await page.evaluate(() => {
            return document.documentElement.scrollWidth > window.innerWidth
          })
          
          if (hasHorizontalScroll) {
            problemas.push(`${viewport.name} - ${pagina.nome}: scroll horizontal detectado`)
            console.log(`     ❌ Scroll horizontal (${document.documentElement.scrollWidth}px > ${window.innerWidth}px)`)
          } else {
            console.log(`     ✅ Sem scroll horizontal`)
          }

          // Verifica se .af-container não está muito estreito em desktop
          if (viewport.width >= 1366) {
            const containerWidth = await page.evaluate(() => {
              const container = document.querySelector('.af-container')
              return container ? container.offsetWidth : 0
            })
            
            const percentual = Math.round((containerWidth / viewport.width) * 100)
            console.log(`     📏 Container: ${containerWidth}px (${percentual}% da tela)`)
            
            if (percentual < 70) {
              problemas.push(`${viewport.name} - ${pagina.nome}: container muito estreito (${percentual}%)`)
              console.log(`     ⚠️  Container ocupa apenas ${percentual}% da largura`)
            }
          }

          await page.waitForTimeout(500)
          
        } catch (err) {
          console.log(`     ⚠️  Erro: ${err.message}`)
        }
      }

      await context.close()
      console.log()
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message)
  } finally {
    await browser.close()
  }

  console.log('\n📊 RESULTADO:')
  if (problemas.length === 0) {
    console.log('✅ Nenhum problema detectado')
    return true
  } else {
    console.log(`❌ ${problemas.length} problema(s):`)
    problemas.forEach(p => console.log(`   - ${p}`))
    return false
  }
}

// Verifica se dev server está rodando
console.log('⚠️  NOTA: Este teste requer dev server rodando em http://localhost:5173')
console.log('⚠️  Execute: npm run dev (em outro terminal)\n')

const ok = await validarResponsividade()
process.exit(ok ? 0 : 1)
