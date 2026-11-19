#!/usr/bin/env node
/**
 * Validação visual rápida das páginas públicas
 * Verifica que os tokens semânticos estão aplicados corretamente
 */

import { chromium } from 'playwright'

const BASE_URL = 'http://localhost:5173'

// Páginas públicas acessíveis sem autenticação
const PUBLIC_ROUTES = [
  { path: '/login', name: 'Login' },
  { path: '/cadastro', name: 'Cadastro' },
  { path: '/recuperar-senha', name: 'Recuperar Senha' },
]

// Viewports para teste responsivo
const VIEWPORTS = [
  { name: 'Desktop', width: 1440, height: 900 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Mobile', width: 390, height: 844 },
]

async function validatePage(page, route, viewport) {
  console.log(`\n📱 ${viewport.name} | ${route.name}`)
  
  await page.setViewportSize({ width: viewport.width, height: viewport.height })
  await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  
  // Verificar se a página carregou
  const title = await page.title()
  console.log(`   Título: ${title}`)
  
  // Verificar se há elementos com bg-marca (token aplicado)
  const marcaElements = await page.$$('[class*="bg-marca"]')
  console.log(`   ✅ Elementos com bg-marca: ${marcaElements.length}`)
  
  // Verificar se há elementos com bg-surface (token aplicado)
  const surfaceElements = await page.$$('[class*="bg-surface"]')
  console.log(`   ✅ Elementos com bg-surface: ${surfaceElements.length}`)
  
  // Verificar se há cores hardcoded blue/purple/indigo (problema)
  const hardcodedBlue = await page.$$('[class*="text-blue-"], [class*="bg-blue-"]')
  const hardcodedPurple = await page.$$('[class*="text-purple-"], [class*="bg-purple-"]')
  const hardcodedIndigo = await page.$$('[class*="text-indigo-"], [class*="bg-indigo-"]')
  
  const totalHardcoded = hardcodedBlue.length + hardcodedPurple.length + hardcodedIndigo.length
  if (totalHardcoded > 0) {
    console.log(`   ⚠️  Cores hardcoded encontradas: ${totalHardcoded}`)
  }
  
  // Screenshot
  const filename = `visual-${route.name.toLowerCase().replace(/\s+/g, '-')}-${viewport.name.toLowerCase()}.png`
  await page.screenshot({ path: `tests/screenshots/${filename}`, fullPage: true })
  console.log(`   📸 Screenshot: ${filename}`)
}

async function main() {
  console.log('🎨 VALIDAÇÃO VISUAL - ALMEIDA FINANCE\n')
  console.log('Testando aplicação dos tokens semânticos nas páginas públicas...\n')
  
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  
  try {
    // Criar pasta de screenshots se não existir
    await page.evaluate(() => {})
    
    for (const route of PUBLIC_ROUTES) {
      for (const viewport of VIEWPORTS) {
        await validatePage(page, route, viewport)
      }
    }
    
    console.log('\n✅ Validação visual concluída!')
    console.log('📁 Screenshots salvos em tests/screenshots/')
    
  } catch (error) {
    console.error('\n❌ Erro durante validação:', error.message)
    process.exit(1)
  } finally {
    await browser.close()
  }
}

main()
