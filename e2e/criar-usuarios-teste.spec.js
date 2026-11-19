// CRIAÇÃO DE USUÁRIOS DE TESTE VIA INTERFACE WEB
// Executa apenas uma vez para criar as contas
import { test, expect } from '@playwright/test'

const BASE_URL = 'https://almeida-finance.vercel.app'

const USUARIOS = [
  {
    nome: 'Alice RLS Test',
    email: 'alice.rls.test@almeidafinance.app',
    senha: 'TestRLS2026!Alice'
  },
  {
    nome: 'Bob RLS Test',
    email: 'bob.rls.test@almeidafinance.app',
    senha: 'TestRLS2026!Bob'
  }
]

test.describe.serial('Criar Usuários de Teste', () => {
  
  for (const usuario of USUARIOS) {
    test(`Criar conta: ${usuario.nome}`, async ({ page }) => {
      console.log(`\n## Criando conta: ${usuario.email}`)
      
      await page.goto(`${BASE_URL}/cadastro`)
      await page.waitForLoadState('networkidle')
      
      // Fechar apresentação se aparecer
      const fecharApres = page.locator('button:has-text("Começar"), button:has-text("Pular")').first()
      if (await fecharApres.isVisible({ timeout: 2000 }).catch(() => false)) {
        await fecharApres.click()
        await page.waitForTimeout(1000)
      }
      
      // Aguardar formulário
      await page.waitForSelector('input[name="nome"], input[placeholder*="nome"]', { timeout: 5000 })
      
      // Preencher formulário de cadastro
      await page.fill('input[name="nome"], input[placeholder*="nome"]', usuario.nome)
      await page.fill('input[type="email"], input[name="email"]', usuario.email)
      
      // Preencher senha
      const senhaInputs = page.locator('input[type="password"]')
      await senhaInputs.first().fill(usuario.senha)
      
      // Se tiver confirmação de senha
      if (await senhaInputs.count() > 1) {
        await senhaInputs.last().fill(usuario.senha)
      }
      
      // Aceitar termos (se houver checkbox)
      const termosCheckbox = page.locator('input[type="checkbox"]').first()
      if (await termosCheckbox.isVisible({ timeout: 1000 }).catch(() => false)) {
        await termosCheckbox.check()
      }
      
      // Clicar em cadastrar
      const cadastrarBtn = page.locator('button:has-text("Cadastrar"), button:has-text("Criar conta"), button[type="submit"]').first()
      await cadastrarBtn.click()
      
      // Aguardar resposta (sucesso ou erro)
      await page.waitForTimeout(5000)
      
      // Verificar se caiu no onboarding/dashboard (sucesso) ou se há mensagem de erro
      const url = page.url()
      const temErro = await page.locator('text=/já existe|já cadastrado|error|inválido/i').isVisible({ timeout: 2000 }).catch(() => false)
      
      if (temErro) {
        const msgErro = await page.locator('text=/já existe|já cadastrado|error|inválido/i').first().textContent()
        console.log(`   ⚠️  Erro ao criar: ${msgErro}`)
        console.log(`   ℹ️  Conta pode já existir, testando login...`)
        
        // Tentar fazer login
        await page.goto(`${BASE_URL}/login`)
        await page.waitForLoadState('networkidle')
        
        // Fechar apresentação
        const fecharApresLogin = page.locator('button:has-text("Já tenho"), button:has-text("Pular")').first()
        if (await fecharApresLogin.isVisible({ timeout: 2000 }).catch(() => false)) {
          await fecharApresLogin.click()
          await page.waitForTimeout(1000)
        }
        
        await page.fill('input[type="email"], input[name="email"]', usuario.email)
        await page.fill('input[type="password"], input[name="senha"]', usuario.senha)
        
        const entrarBtn = page.locator('button:has-text("Entrar"), button[type="submit"]').first()
        await entrarBtn.click()
        await page.waitForTimeout(3000)
        
        const urlLogin = page.url()
        if (urlLogin.includes('login')) {
          console.log(`   ❌ Conta não existe e não foi possível criar`)
        } else {
          console.log(`   ✅ Conta já existe e login funcionou: ${urlLogin}`)
        }
        
      } else if (url.includes('onboarding') || url.includes('home') || url.includes('dashboard') || url.includes('receitas')) {
        console.log(`   ✅ Conta criada com sucesso: ${usuario.email}`)
        console.log(`   URL redirecionada: ${url}`)
      } else {
        console.log(`   ⚠️  Status incerto. URL: ${url}`)
        console.log(`   Tentando navegar para testar...`)
        
        await page.goto(`${BASE_URL}/receitas`)
        await page.waitForTimeout(2000)
        
        const urlTeste = page.url()
        if (urlTeste.includes('login')) {
          console.log(`   ❌ Não está autenticado, conta não foi criada`)
        } else {
          console.log(`   ✅ Está autenticado, conta OK: ${urlTeste}`)
        }
      }
    })
  }
})
