import { chromium } from 'playwright'

(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  
  const errors = []
  const logs = []
  
  page.on('console', msg => {
    logs.push(`${msg.type()}: ${msg.text()}`)
  })
  
  page.on('pageerror', err => {
    errors.push(err.toString())
    console.log('ERROR:', err.toString())
  })
  
  await page.goto('http://localhost:5173/')
  await page.waitForTimeout(3000)
  
  if (errors.length > 0) {
    console.log('\n❌ ERROS ENCONTRADOS:')
    errors.forEach(e => console.log(e))
  } else {
    console.log('\n✅ NENHUM ERRO DE RENDERIZAÇÃO')
  }
  
  const title = await page.title()
  console.log('\nTítulo:', title)
  
  const html = await page.content()
  if (html.includes('Algo deu errado')) {
    console.log('❌ ErrorBoundary ativo')
  } else if (html.includes('Vamos organizar')) {
    console.log('✅ Onboarding visível')
  } else if (html.includes('Entrar')) {
    console.log('✅ Tela de login')
  }
  
  await browser.close()
})()
