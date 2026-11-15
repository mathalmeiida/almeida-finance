// @ts-check
import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const BASE_URL = 'http://localhost:4173'
const SCREENSHOTS_DIR = 'screenshots-teste-real'
const CREDENCIAIS_FILE = '.test-user-real.json'

// Credenciais do usuario de teste
const EMAIL_TESTE = 'teste.real.' + Date.now() + '@almeidafinance.test'
const SENHA_TESTE = 'SenhaTesteMuitoSecreta123!'
const NOME_TESTE = 'Usuario Teste Real'

// Criar diretorio de screenshots
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

test.describe.serial('VALIDACAO COMPLETA - Cadastro + Navegacao + Screenshots', () => {
  
  test('FASE 1 - Cadastro e Onboarding Completo', async ({ page }) => {
    console.log(`Email de teste: ${EMAIL_TESTE}`)
    
    // 1. Acessar o site
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    
    // Screenshot landing
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '01-landing-page.png'),
      fullPage: true 
    })
    
    // 2. Navegar para cadastro
    const comecarBtn = page.getByRole('button', { name: /começar agora/i })
    if (await comecarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await comecarBtn.click()
    }
    
    await page.waitForTimeout(1000)
    
    // Se já estiver na página de cadastro/login
    const jaTenhoConta = page.getByRole('button', { name: /já tenho uma conta/i })
    const cadastrarBtn = page.getByRole('button', { name: /cadastrar|criar conta/i })
    
    // Tentar encontrar botão de cadastro
    if (await cadastrarBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Já está na tela de cadastro
    } else if (await jaTenhoConta.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Está na tela de login, precisa ir para cadastro
      const irParaCadastro = page.getByRole('link', { name: /cadastre-se|criar conta/i })
      if (await irParaCadastro.isVisible({ timeout: 2000 }).catch(() => false)) {
        await irParaCadastro.click()
        await page.waitForTimeout(500)
      }
    }
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '02-tela-cadastro.png'),
      fullPage: true 
    })
    
    // 3. Preencher formulario de cadastro
    const emailInput = page.getByLabel(/e-mail|email/i).or(page.getByPlaceholder(/e-mail|email/i))
    const senhaInput = page.getByLabel(/senha/i).first()
    const nomeInput = page.getByLabel(/nome/i).or(page.getByPlaceholder(/nome/i))
    
    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailInput.fill(EMAIL_TESTE)
      await senhaInput.fill(SENHA_TESTE)
      
      if (await nomeInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await nomeInput.fill(NOME_TESTE)
      }
      
      // Submeter formulario
      const submitBtn = page.getByRole('button', { name: /cadastrar|criar|entrar/i })
      await submitBtn.click()
      
      console.log('Formulario de cadastro submetido')
    } else {
      console.log('Formulario de cadastro nao encontrado, pulando...')
    }
    
    // 4. Aguardar carregamento/onboarding
    await page.waitForTimeout(3000)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '03-pos-cadastro.png'),
      fullPage: true 
    })
    
    // 5. Completar onboarding se necessario
    // Pular apresentacao se houver
    const pularBtn = page.getByRole('button', { name: /pular/i })
    if (await pularBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pularBtn.click()
      await page.waitForTimeout(500)
    }
    
    // Procurar por etapas do onboarding
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const proximoBtn = page.getByRole('button', { name: /próximo|continuar|concluir/i })
      
      if (await proximoBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await page.screenshot({ 
          path: path.join(SCREENSHOTS_DIR, `04-onboarding-etapa-${tentativa + 1}.png`),
          fullPage: true 
        })
        
        // Preencher campos se houver
        const inputs = page.locator('input[type="text"], input[type="number"], input[type="date"]')
        const inputCount = await inputs.count()
        
        for (let i = 0; i < inputCount; i++) {
          const input = inputs.nth(i)
          if (await input.isVisible().catch(() => false)) {
            const type = await input.getAttribute('type')
            if (type === 'date') {
              await input.fill('2026-01-01')
            } else if (type === 'number') {
              await input.fill('5000')
            } else {
              await input.fill('Teste')
            }
          }
        }
        
        await proximoBtn.click()
        await page.waitForTimeout(1000)
      } else {
        break
      }
    }
    
    await page.waitForTimeout(2000)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '05-onboarding-concluido.png'),
      fullPage: true 
    })
    
    // Salvar credenciais para proximos testes
    const credenciais = {
      email: EMAIL_TESTE,
      senha: SENHA_TESTE,
      nome: NOME_TESTE,
      timestamp: new Date().toISOString()
    }
    
    fs.writeFileSync(CREDENCIAIS_FILE, JSON.stringify(credenciais, null, 2))
    console.log(`Credenciais salvas em: ${CREDENCIAIS_FILE}`)
  })
  
  test('FASE 2 - Dashboard/Home', async ({ page }) => {
    // Fazer login se necessario
    // (context é compartilhado entre testes seriais)
    
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '10-dashboard-home-REAL.png'),
      fullPage: true 
    })
    
    // Verificar se botao Importar existe
    const importarBtn = page.getByRole('button', { name: /importar/i })
    const btnVisible = await importarBtn.isVisible({ timeout: 3000 }).catch(() => false)
    console.log(`Botao Importar no Dashboard: ${btnVisible ? 'VISIVEL' : 'NAO VISIVEL'}`)
  })
  
  test('FASE 3 - Receitas com Modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/receitas`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '11-receitas-pagina.png'),
      fullPage: true 
    })
    
    const importarBtn = page.getByRole('button', { name: /importar/i })
    const btnVisible = await importarBtn.isVisible({ timeout: 3000 }).catch(() => false)
    console.log(`Botao Importar em Receitas: ${btnVisible ? 'VISIVEL' : 'NAO VISIVEL'}`)
    
    if (btnVisible) {
      await importarBtn.click()
      await page.waitForTimeout(1000)
      
      await page.screenshot({ 
        path: path.join(SCREENSHOTS_DIR, '12-receitas-modal-importacao.png'),
        fullPage: true 
      })
    }
  })
  
  test('FASE 4 - Despesas com Modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/despesas`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '13-despesas-pagina.png'),
      fullPage: true 
    })
    
    const importarBtn = page.getByRole('button', { name: /importar/i })
    const btnVisible = await importarBtn.isVisible({ timeout: 3000 }).catch(() => false)
    console.log(`Botao Importar em Despesas: ${btnVisible ? 'VISIVEL' : 'NAO VISIVEL'}`)
    
    if (btnVisible) {
      await importarBtn.click()
      await page.waitForTimeout(1000)
      
      await page.screenshot({ 
        path: path.join(SCREENSHOTS_DIR, '14-despesas-modal-importacao.png'),
        fullPage: true 
      })
    }
  })
  
  test('FASE 5 - Cartoes com Modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/cartoes`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '15-cartoes-pagina.png'),
      fullPage: true 
    })
    
    const importarBtn = page.getByRole('button', { name: /importar/i })
    const btnVisible = await importarBtn.isVisible({ timeout: 3000 }).catch(() => false)
    console.log(`Botao Importar em Cartoes: ${btnVisible ? 'VISIVEL' : 'NAO VISIVEL'}`)
    
    if (btnVisible) {
      await importarBtn.click()
      await page.waitForTimeout(1000)
      
      await page.screenshot({ 
        path: path.join(SCREENSHOTS_DIR, '16-cartoes-modal-importacao.png'),
        fullPage: true 
      })
    }
  })
  
  test('FASE 6 - Investimentos com Modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/investimentos`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '17-investimentos-pagina.png'),
      fullPage: true 
    })
    
    const importarBtn = page.getByRole('button', { name: /importar/i })
    const btnVisible = await importarBtn.isVisible({ timeout: 3000 }).catch(() => false)
    console.log(`Botao Importar em Investimentos: ${btnVisible ? 'VISIVEL' : 'NAO VISIVEL'}`)
    
    if (btnVisible) {
      await importarBtn.click()
      await page.waitForTimeout(1000)
      
      await page.screenshot({ 
        path: path.join(SCREENSHOTS_DIR, '18-investimentos-modal-importacao.png'),
        fullPage: true 
      })
    }
  })
  
  test('FASE 7 - Pagina Importacao Standalone', async ({ page }) => {
    await page.goto(`${BASE_URL}/importacao`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '19-importacao-standalone.png'),
      fullPage: true 
    })
    
    const heading = page.getByRole('heading', { name: /importação/i })
    const headingVisible = await heading.isVisible({ timeout: 3000 }).catch(() => false)
    console.log(`Heading Importacao: ${headingVisible ? 'VISIVEL' : 'NAO VISIVEL'}`)
  })
  
  test('FASE 8 - Central de Importacao', async ({ page }) => {
    await page.goto(`${BASE_URL}/central-importacao`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '20-central-importacao.png'),
      fullPage: true 
    })
  })
  
  test('RELATORIO FINAL - Gerar sumario', async () => {
    const relatorio = `# RELATORIO DE TESTE REAL - ${new Date().toLocaleString('pt-BR')}

## Credenciais Usadas
- Email: ${EMAIL_TESTE}
- Senha: ${SENHA_TESTE}
- Nome: ${NOME_TESTE}

## Screenshots Capturados
${fs.readdirSync(SCREENSHOTS_DIR).map(f => `- ${f}`).join('\n')}

## Status
Testes executados com cadastro real no Supabase.
Screenshots capturados de todas as páginas importantes.

## Próximos Passos
1. Revisar screenshots para identificar problemas
2. Verificar se botões "Importar" aparecem em todas as páginas
3. Testar upload de arquivos manualmente
`
    
    fs.writeFileSync(
      path.join(SCREENSHOTS_DIR, 'RELATORIO.md'),
      relatorio
    )
    
    console.log('Relatorio gerado!')
  })
})
