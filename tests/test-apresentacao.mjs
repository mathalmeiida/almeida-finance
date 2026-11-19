#!/usr/bin/env node
/**
 * Teste da apresentação inicial (primeira visita)
 */

import { chromium } from 'playwright'

const BASE_URL = 'http://localhost:5173'

async function testApresentacao() {
  console.log('🎨 TESTE DA APRESENTAÇÃO INICIAL\n')
  
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  
  const results = []
  
  try {
    const viewports = [
      { name: '390px', width: 390, height: 844 },
      { name: '1440px', width: 1440, height: 900 },
      { name: '1920px', width: 1920, height: 1080 }
    ]
    
    for (const vp of viewports) {
      console.log(`📐 Testando ${vp.name}`)
      
      // Limpar storage para simular primeira visita
      await page.goto(BASE_URL)
      await page.evaluate(() => {
        localStorage.clear()
        sessionStorage.clear()
      })
      
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1500)
      
      // Verificar se apresentação está sendo exibida
      const temApresentacao = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        const pularBtn = buttons.find(b => b.textContent.includes('Pular'))
        const conhecaBtn = buttons.find(b => b.textContent.includes('Conheça o app'))
        return !!(pularBtn || conhecaBtn)
      })
      
      if (!temApresentacao) {
        console.log(`   ⚠️  Apresentação não foi exibida`)
        results.push({
          viewport: vp.name,
          apresentacao: '❌ Não exibida',
          overflow: 'N/A',
          cantos: 'N/A'
        })
        continue
      }
      
      console.log(`   ✅ Apresentação exibida`)
      
      // Verificar layout
      const layout = await page.evaluate(() => {
        const body = document.body
        
        // Verificar cantos extremos
        const corners = [
          { x: 5, y: 5 },
          { x: window.innerWidth - 5, y: 5 },
          { x: 5, y: window.innerHeight - 5 },
          { x: window.innerWidth - 5, y: window.innerHeight - 5 }
        ]
        
        const whiteCorners = corners.filter(corner => {
          const el = document.elementFromPoint(corner.x, corner.y)
          if (!el) return false
          const bg = window.getComputedStyle(el).backgroundColor
          return bg === 'rgb(255, 255, 255)' || bg === 'rgba(255, 255, 255, 1)'
        })
        
        return {
          bodyWidth: body.scrollWidth,
          viewportWidth: window.innerWidth,
          hasOverflow: body.scrollWidth > window.innerWidth,
          whiteCorners: whiteCorners.length
        }
      })
      
      console.log(`   Largura: ${layout.bodyWidth}px / ${layout.viewportWidth}px`)
      console.log(`   Overflow: ${layout.hasOverflow ? '❌' : '✅'}`)
      console.log(`   Cantos brancos: ${layout.whiteCorners}/4 ${layout.whiteCorners > 0 ? '❌' : '✅'}`)
      
      // Screenshot
      await page.screenshot({ 
        path: `tests/screenshots/apresentacao-${vp.name}.png`,
        fullPage: true
      })
      console.log(`   📸 apresentacao-${vp.name}.png\n`)
      
      results.push({
        viewport: vp.name,
        apresentacao: '✅ Exibida',
        overflow: layout.hasOverflow ? '❌ Sim' : '✅ Não',
        cantos: layout.whiteCorners > 0 ? `❌ ${layout.whiteCorners} brancos` : '✅ OK'
      })
    }
    
    // Relatório
    console.log('━━━ RESULTADO ━━━\n')
    console.log('┌──────────┬─────────────────┬──────────┬─────────────────┐')
    console.log('│ Viewport │ Apresentação    │ Overflow │ Cantos          │')
    console.log('├──────────┼─────────────────┼──────────┼─────────────────┤')
    
    results.forEach(r => {
      const vp = r.viewport.padEnd(8)
      const apr = r.apresentacao.padEnd(15)
      const ovf = r.overflow.padEnd(8)
      const cnt = r.cantos.padEnd(15)
      console.log(`│ ${vp} │ ${apr} │ ${ovf} │ ${cnt} │`)
    })
    
    console.log('└──────────┴─────────────────┴──────────┴─────────────────┘\n')
    
    const allOk = results.every(r => 
      r.apresentacao.includes('✅') && 
      r.overflow.includes('✅') && 
      r.cantos.includes('✅')
    )
    
    if (allOk) {
      console.log('✅ APRESENTAÇÃO INICIAL: APROVADA')
    } else {
      console.log('❌ APRESENTAÇÃO INICIAL: REPROVADA')
      console.log('   Problemas encontrados nos testes acima')
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message)
  } finally {
    await browser.close()
  }
}

testApresentacao()
