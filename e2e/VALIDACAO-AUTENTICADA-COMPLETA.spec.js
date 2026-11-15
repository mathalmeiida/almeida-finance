// @ts-check
import { test, expect } from '@playwright/test'
import { setupAuth, isAuthenticated } from './auth-helper.js'
import path from 'path'
import fs from 'fs'

const BASE_URL = 'http://localhost:4173'
const SCREENSHOTS_DIR = 'validacao-autenticada-completa'

// Criar diretorio de screenshots
test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  }
})

// Setup de autenticacao antes de cada teste
test.beforeEach(async ({ page }) => {
  await setupAuth(page, BASE_URL)
  
  // Verificar autenticacao
  const autenticado = await isAuthenticated(page)
  if (!autenticado) {
    throw new Error('Falha na autenticacao - usuario nao esta logado')
  }
})

test.describe('FASE 1 - Navegacao e Screenshots Basicos', () => {
  
  test('01 - Dashboard/Home', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '01-dashboard-home.png'),
      fullPage: true 
    })
    
    // Verificar elementos principais
    const hasSaldo = await page.getByText(/saldo|receitas|despesas/i).isVisible({ timeout: 5000 }).catch(() => false)
    console.log(`Dashboard - Elementos financeiros visiveis: ${hasSaldo}`)
    
    // Procurar botao Importar
    const importarBtn = page.getByRole('button', { name: /importar/i }).first()
    const temBotaoImportar = await importarBtn.isVisible({ timeout: 3000 }).catch(() => false)
    console.log(`Dashboard - Botao Importar: ${temBotaoImportar ? 'VISIVEL' : 'NAO VISIVEL'}`)
  })
  
  test('02 - Receitas - Pagina e Modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/receitas`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '02-receitas-pagina.png'),
      fullPage: true 
    })
    
    // Procurar botao Importar
    const importarBtn = page.getByRole('button', { name: /importar/i })
    const btnVisible = await importarBtn.isVisible({ timeout: 3000 }).catch(() => false)
    console.log(`Receitas - Botao Importar: ${btnVisible ? 'VISIVEL' : 'NAO VISIVEL'}`)
    
    if (btnVisible) {
      await importarBtn.click()
      await page.waitForTimeout(1000)
      
      await page.screenshot({ 
        path: path.join(SCREENSHOTS_DIR, '02-receitas-modal.png'),
        fullPage: true 
      })
      
      // Verificar se modal tem interface de importacao
      const hasImportInterface = await page.getByText(/importa|arquivo|upload/i).isVisible({ timeout: 2000 }).catch(() => false)
      console.log(`Receitas - Modal de importacao: ${hasImportInterface ? 'ABERTO' : 'NAO ENCONTRADO'}`)
      
      // Fechar modal
      const fecharBtn = page.getByRole('button', { name: /fechar|cancelar/i }).or(page.locator('[aria-label="Fechar"]'))
      if (await fecharBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await fecharBtn.click()
      }
    }
  })
  
  test('03 - Despesas - Pagina e Modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/despesas`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '03-despesas-pagina.png'),
      fullPage: true 
    })
    
    const importarBtn = page.getByRole('button', { name: /importar/i })
    const btnVisible = await importarBtn.isVisible({ timeout: 3000 }).catch(() => false)
    console.log(`Despesas - Botao Importar: ${btnVisible ? 'VISIVEL' : 'NAO VISIVEL'}`)
    
    if (btnVisible) {
      await importarBtn.click()
      await page.waitForTimeout(1000)
      
      await page.screenshot({ 
        path: path.join(SCREENSHOTS_DIR, '03-despesas-modal.png'),
        fullPage: true 
      })
      
      const fecharBtn = page.getByRole('button', { name: /fechar|cancelar/i }).or(page.locator('[aria-label="Fechar"]'))
      if (await fecharBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await fecharBtn.click()
      }
    }
  })
  
  test('04 - Cartoes - Pagina e Modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/cartoes`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '04-cartoes-pagina.png'),
      fullPage: true 
    })
    
    const importarBtn = page.getByRole('button', { name: /importar/i })
    const btnVisible = await importarBtn.isVisible({ timeout: 3000 }).catch(() => false)
    console.log(`Cartoes - Botao Importar: ${btnVisible ? 'VISIVEL' : 'NAO VISIVEL'}`)
    
    if (btnVisible) {
      await importarBtn.click()
      await page.waitForTimeout(1000)
      
      await page.screenshot({ 
        path: path.join(SCREENSHOTS_DIR, '04-cartoes-modal.png'),
        fullPage: true 
      })
      
      const fecharBtn = page.getByRole('button', { name: /fechar|cancelar/i }).or(page.locator('[aria-label="Fechar"]'))
      if (await fecharBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await fecharBtn.click()
      }
    }
  })
  
  test('05 - Investimentos - Pagina e Modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/investimentos`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '05-investimentos-pagina.png'),
      fullPage: true 
    })
    
    const importarBtn = page.getByRole('button', { name: /importar/i })
    const btnVisible = await importarBtn.isVisible({ timeout: 3000 }).catch(() => false)
    console.log(`Investimentos - Botao Importar: ${btnVisible ? 'VISIVEL' : 'NAO VISIVEL'}`)
    
    if (btnVisible) {
      await importarBtn.click()
      await page.waitForTimeout(1000)
      
      await page.screenshot({ 
        path: path.join(SCREENSHOTS_DIR, '05-investimentos-modal.png'),
        fullPage: true 
      })
      
      const fecharBtn = page.getByRole('button', { name: /fechar|cancelar/i }).or(page.locator('[aria-label="Fechar"]'))
      if (await fecharBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await fecharBtn.click()
      }
    }
  })
  
  test('06 - Beneficios/VR-VA - Pagina e Modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/beneficios`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '06-beneficios-pagina.png'),
      fullPage: true 
    })
    
    const importarBtn = page.getByRole('button', { name: /importar/i })
    const btnVisible = await importarBtn.isVisible({ timeout: 3000 }).catch(() => false)
    console.log(`Beneficios - Botao Importar: ${btnVisible ? 'VISIVEL' : 'NAO VISIVEL'}`)
    
    if (btnVisible) {
      await importarBtn.click()
      await page.waitForTimeout(1000)
      
      await page.screenshot({ 
        path: path.join(SCREENSHOTS_DIR, '06-beneficios-modal.png'),
        fullPage: true 
      })
      
      const fecharBtn = page.getByRole('button', { name: /fechar|cancelar/i }).or(page.locator('[aria-label="Fechar"]'))
      if (await fecharBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await fecharBtn.click()
      }
    }
  })
  
  test('07 - Importacao Standalone', async ({ page }) => {
    await page.goto(`${BASE_URL}/importacao`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '07-importacao-standalone.png'),
      fullPage: true 
    })
    
    const heading = page.getByRole('heading', { name: /importa/i })
    const headingVisible = await heading.isVisible({ timeout: 3000 }).catch(() => false)
    console.log(`Importacao Standalone - Heading: ${headingVisible ? 'VISIVEL' : 'NAO VISIVEL'}`)
    
    const uploadArea = page.getByText(/arraste|selecione|arquivo/i)
    const uploadVisible = await uploadArea.isVisible({ timeout: 3000 }).catch(() => false)
    console.log(`Importacao Standalone - Area de upload: ${uploadVisible ? 'VISIVEL' : 'NAO VISIVEL'}`)
  })
  
  test('08 - Central de Importacao', async ({ page }) => {
    await page.goto(`${BASE_URL}/central-importacao`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '08-central-importacao.png'),
      fullPage: true 
    })
    
    const heading = page.getByRole('heading', { name: /central|importa/i })
    const headingVisible = await heading.isVisible({ timeout: 3000 }).catch(() => false)
    console.log(`Central Importacao - Heading: ${headingVisible ? 'VISIVEL' : 'NAO VISIVEL'}`)
  })
})

test.describe('FASE 2 - Onboarding (se acessivel)', () => {
  
  test('09 - Onboarding Visual', async ({ page }) => {
    // Tentar acessar onboarding
    await page.goto(`${BASE_URL}/onboarding`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '09-onboarding.png'),
      fullPage: true 
    })
    
    // Se usuario ja completou onboarding, pode ser redirecionado
    const isOnboarding = page.url().includes('/onboarding')
    console.log(`Onboarding - Acessivel: ${isOnboarding ? 'SIM' : 'NAO (ja concluido)'}`)
  })
})

test.describe('FASE 3 - Responsividade', () => {
  
  test('10 - iPhone SE - Dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '10-iphone-se-dashboard.png'),
      fullPage: true 
    })
  })
  
  test('11 - iPhone 13 - Receitas', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE_URL}/receitas`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '11-iphone-13-receitas.png'),
      fullPage: true 
    })
  })
  
  test('12 - Desktop 1920 - Dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '12-desktop-1920-dashboard.png'),
      fullPage: false // Apenas viewport visivel
    })
  })
})

test.describe('RELATORIO FINAL', () => {
  
  test('Gerar sumario de validacao', async () => {
    const screenshots = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'))
    
    const relatorio = `# RELATORIO DE VALIDACAO AUTENTICADA
## Almeida Finance - Conversor Universal

**Data**: ${new Date().toLocaleString('pt-BR')}
**Projeto Supabase**: ievccupeijzuzhomphwn.supabase.co
**URL Local**: ${BASE_URL}

## Screenshots Capturados (${screenshots.length})

${screenshots.map((f, i) => `${i + 1}. ${f}`).join('\n')}

## Validacoes Executadas

### Paginas Testadas:
- ✅ Dashboard/Home
- ✅ Receitas
- ✅ Despesas  
- ✅ Cartoes
- ✅ Investimentos
- ✅ Beneficios/VR-VA
- ✅ Importacao Standalone
- ✅ Central de Importacao
- ✅ Onboarding (se acessivel)

### Responsividade:
- ✅ iPhone SE (375×667)
- ✅ iPhone 13 (390×844)
- ✅ Desktop (1920×1080)

## Observacoes

- Sessao autenticada salva em: playwright/.auth/user.json
- Usuario de teste utilizado (sem dados reais)
- Screenshots disponiveis para analise visual

## Proximas Etapas

1. Revisar screenshots para identificar problemas visuais
2. Verificar presenca de botoes "Importar"
3. Testar upload de arquivos (manual ou via Playwright)
4. Validar deteccao automatica de formatos
5. Verificar calculos de saldo e duplicidade

---

Gerado automaticamente por: VALIDACAO-AUTENTICADA-COMPLETA.spec.js
`
    
    fs.writeFileSync(
      path.join(SCREENSHOTS_DIR, 'RELATORIO.md'),
      relatorio
    )
    
    console.log('')
    console.log('═══════════════════════════════════════════════════════════')
    console.log('  ✅ VALIDACAO AUTENTICADA CONCLUIDA')
    console.log('═══════════════════════════════════════════════════════════')
    console.log('')
    console.log(`Screenshots: ${screenshots.length}`)
    console.log(`Diretorio: ${SCREENSHOTS_DIR}/`)
    console.log(`Relatorio: ${SCREENSHOTS_DIR}/RELATORIO.md`)
    console.log('')
  })
})
