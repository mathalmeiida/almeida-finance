#!/usr/bin/env node
import { chromium } from 'playwright'

const BASE_URL = 'http://localhost:5173'

const VIEWPORTS = [
  { name: 'Mobile-390', width: 390, height: 844 },
  { name: 'Tablet-768', width: 768, height: 1024 },
  { name: 'Desktop-1024', width: 1024, height: 768 },
  { name: 'Desktop-1440', width: 1440, height: 900 },
  { name: 'Desktop-Full', width: 1920, height: 1080 }
]

async function testLoginLayout() {
  console.log('🎨 VALIDAÇÃO DE LAYOUT - LOGIN\n')
  
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  
  try {
    // Marcar apresentação como vista
    await page.goto(BASE_URL)
    await page.evaluate(() => {
      localStorage.setItem('almeida_apresentacao_publica_vista', '1')
    })
    
    for (const vp of VIEWPORTS) {
      console.log(`📐 ${vp.name} (${vp.width}x${vp.height})`)
      
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1000)
      
      // Verificar overflow horizontal
      const metrics = await page.evaluate(() => {
        const body = document.body
        const root = document.getElementById('root')
        return {
          bodyWidth: body.scrollWidth,
          viewportWidth: window.innerWidth,
          rootWidth: root?.scrollWidth || 0,
          hasHorizontalScroll: body.scrollWidth > window.innerWidth
        }
      })
      
      if (metrics.hasHorizontalScroll) {
        console.log(`   ⚠️  Overflow: ${metrics.bodyWidth}px > ${metrics.viewportWidth}px`)
      } else {
        console.log(`   ✅ Layout: ${metrics.bodyWidth}px = ${metrics.viewportWidth}px`)
      }
      
      // Screenshot
      const filename = `login-layout-${vp.name.toLowerCase()}.png`
      await page.screenshot({
        path: `tests/screenshots/${filename}`,
        fullPage: true
      })
      console.log(`   📸 ${filename}\n`)
    }
    
    console.log('✅ Validação concluída')
    console.log('📁 Screenshots em tests/screenshots/')
    
  } catch (error) {
    console.error('❌ Erro:', error.message)
  } finally {
    await browser.close()
  }
}

testLoginLayout()
