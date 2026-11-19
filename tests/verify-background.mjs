#!/usr/bin/env node
/**
 * Verificar se o fundo vinho ocupa 100% da tela
 * Analisa a cor do fundo nos cantos da viewport
 */

import { chromium } from 'playwright'

const BASE_URL = 'http://localhost:5173'

async function verifyBackground() {
  console.log('🎨 VERIFICAÇÃO DE FUNDO - LOGIN\n')
  
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  
  try {
    // Marcar apresentação como vista
    await page.goto(BASE_URL)
    await page.evaluate(() => {
      localStorage.setItem('almeida_apresentacao_publica_vista', '1')
    })
    
    // Testar em 1920px (tela grande)
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    
    console.log('📐 Resolução: 1920x1080')
    
    // Verificar cor de fundo em diferentes pontos
    const colors = await page.evaluate(() => {
      const points = [
        { x: 10, y: 10, name: 'Canto superior esquerdo' },
        { x: window.innerWidth - 10, y: 10, name: 'Canto superior direito' },
        { x: 10, y: window.innerHeight - 10, name: 'Canto inferior esquerdo' },
        { x: window.innerWidth - 10, y: window.innerHeight - 10, name: 'Canto inferior direito' },
        { x: window.innerWidth / 2, y: window.innerHeight / 2, name: 'Centro' }
      ]
      
      return points.map(point => {
        const element = document.elementFromPoint(point.x, point.y)
        const computed = window.getComputedStyle(element)
        const bg = computed.backgroundColor
        
        return {
          name: point.name,
          color: bg,
          isWhite: bg === 'rgb(255, 255, 255)' || bg === 'rgba(255, 255, 255, 1)',
          element: element.tagName
        }
      })
    })
    
    console.log('\n🎯 Análise de cores:\n')
    
    let hasWhiteBackground = false
    colors.forEach(c => {
      const status = c.isWhite ? '❌ BRANCO' : '✅ Colorido'
      console.log(`${status} | ${c.name}`)
      console.log(`   Cor: ${c.color}`)
      console.log(`   Elemento: ${c.element}\n`)
      
      if (c.isWhite) hasWhiteBackground = true
    })
    
    // Screenshot para análise visual
    await page.screenshot({ 
      path: 'tests/screenshots/verify-bg-1920.png',
      fullPage: false
    })
    
    if (hasWhiteBackground) {
      console.log('❌ PROBLEMA: Faixas brancas detectadas!')
      console.log('   Estrutura precisa de dois contêineres separados.\n')
    } else {
      console.log('✅ CORRETO: Fundo vinho ocupa toda a tela')
      console.log('   Não há faixas brancas laterais ou inferiores.\n')
    }
    
    // Testar também em 1440px
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    
    await page.screenshot({ 
      path: 'tests/screenshots/verify-bg-1440.png',
      fullPage: false
    })
    
    console.log('📸 Screenshots salvos:')
    console.log('   verify-bg-1920.png')
    console.log('   verify-bg-1440.png')
    
  } catch (error) {
    console.error('❌ Erro:', error.message)
  } finally {
    await browser.close()
  }
}

verifyBackground()
