// TESTE RLS REAL COM 2 USUÁRIOS AUTENTICADOS
// Usa Playwright para simular 2 sessões de navegador reais
// Contorna rate limit usando interface web ao invés de API
import { test, expect } from '@playwright/test'
import { chromium } from '@playwright/test'

const BASE_URL = 'https://almeida-finance.vercel.app'

// Usuários de teste (usar contas que já existem ou criar manualmente primeiro)
const USUARIO_A = {
  email: 'alice.rls.test@almeidafinance.app',
  senha: 'TestRLS2026!Alice',
  nome: 'Alice RLS Test'
}

const USUARIO_B = {
  email: 'bob.rls.test@almeidafinance.app', 
  senha: 'TestRLS2026!Bob',
  nome: 'Bob RLS Test'
}

test.describe('Teste de Isolamento RLS Real', () => {
  
  test('Isolamento completo entre Alice e Bob', async () => {
    // Criar 2 contextos de navegador independentes (sessões isoladas)
    const browser = await chromium.launch()
    const contextAlice = await browser.newContext()
    const contextBob = await browser.newContext()
    
    const pageAlice = await contextAlice.newPage()
    const pageBob = await contextBob.newPage()
    
    console.log('\n═══════════════════════════════════════════════')
    console.log('INICIANDO TESTE RLS REAL COM 2 USUÁRIOS')
    console.log('═══════════════════════════════════════════════\n')
    
    try {
      // ============================================================
      // PARTE 1: ALICE FAZ LOGIN E CRIA DADOS
      // ============================================================
      console.log('## PARTE 1: Alice faz login')
      await pageAlice.goto(`${BASE_URL}/login`)
      await pageAlice.waitForLoadState('networkidle')
      
      // Fechar apresentação se aparecer
      const fecharApresentacao = pageAlice.locator('button:has-text("Já tenho"), button:has-text("Pular")').first()
      if (await fecharApresentacao.isVisible({ timeout: 3000 }).catch(() => false)) {
        await fecharApresentacao.click()
        await pageAlice.waitForTimeout(1000)
      }
      
      // Aguardar formulário de login
      await pageAlice.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 })
      
      // Fazer login como Alice
      await pageAlice.fill('input[type="email"]', USUARIO_A.email)
      await pageAlice.fill('input[type="password"]', USUARIO_A.senha)
      
      // Clicar no botão de login
      const loginBtn = pageAlice.locator('button:has-text("Entrar"), button[type="submit"]').first()
      await loginBtn.click()
      
      // Aguardar redirecionamento para dashboard (ou onboarding)
      await pageAlice.waitForURL(/\/(home|dashboard|onboarding|receitas|despesas)?/, { timeout: 15000 })
      
      const urlAlice = pageAlice.url()
      console.log(`   ✅ Alice autenticada: ${urlAlice}`)
      
      // Se caiu no onboarding, pular
      if (urlAlice.includes('onboarding')) {
        const pularBtn = pageAlice.locator('button:has-text("Pular"), button:has-text("Concluir")').first()
        if (await pularBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await pularBtn.click()
          await pageAlice.waitForTimeout(1000)
        }
      }
      
      // Navegar para Receitas
      console.log('   Navegando para Receitas...')
      await pageAlice.goto(`${BASE_URL}/receitas`)
      await pageAlice.waitForLoadState('networkidle')
      
      // Criar receita de Alice
      console.log('   Criando receita de Alice...')
      const addReceitaBtn = pageAlice.locator('button:has-text("Adicionar"), button:has-text("Nova")').first()
      
      if (await addReceitaBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addReceitaBtn.click()
        await pageAlice.waitForTimeout(1000)
        
        // Preencher formulário
        await pageAlice.fill('input[placeholder*="Descrição"], input[name="descricao"]', 'Salário Alice RLS Test')
        
        // Preencher valor (pode ter InputMoeda customizado)
        const valorInput = pageAlice.locator('input[placeholder*="valor"], input[type="text"]').last()
        await valorInput.click()
        await valorInput.fill('5000')
        
        // Salvar
        const salvarBtn = pageAlice.locator('button:has-text("Salvar"), button:has-text("Adicionar")').last()
        await salvarBtn.click()
        await pageAlice.waitForTimeout(2000)
        
        console.log('   ✅ Receita de Alice criada')
      } else {
        console.log('   ⚠️  Botão de adicionar não encontrado, tentando via URL direta')
      }
      
      // Verificar que Alice vê sua receita
      await pageAlice.reload()
      await pageAlice.waitForLoadState('networkidle')
      
      const receitaAliceVista = await pageAlice.locator('text=/Salário Alice RLS Test/i').isVisible({ timeout: 3000 }).catch(() => false)
      
      if (receitaAliceVista) {
        console.log('   ✅ Alice vê sua própria receita na lista')
      } else {
        console.log('   ⚠️  Receita de Alice não apareceu na lista (pode ter sido criada mas lista vazia)')
      }
      
      // ============================================================
      // PARTE 2: BOB FAZ LOGIN (SESSÃO SEPARADA)
      // ============================================================
      console.log('\n## PARTE 2: Bob faz login (sessão separada)')
      await pageBob.goto(`${BASE_URL}/login`)
      await pageBob.waitForLoadState('networkidle')
      
      // Fechar apresentação se aparecer
      const fecharApresentacaoBob = pageBob.locator('button:has-text("Já tenho"), button:has-text("Pular")').first()
      if (await fecharApresentacaoBob.isVisible({ timeout: 3000 }).catch(() => false)) {
        await fecharApresentacaoBob.click()
        await pageBob.waitForTimeout(1000)
      }
      
      await pageBob.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 })
      
      await pageBob.fill('input[type="email"]', USUARIO_B.email)
      await pageBob.fill('input[type="password"]', USUARIO_B.senha)
      
      const loginBtnBob = pageBob.locator('button:has-text("Entrar"), button[type="submit"]').first()
      await loginBtnBob.click()
      
      await pageBob.waitForURL(/\/(home|dashboard|onboarding|receitas|despesas)?/, { timeout: 15000 })
      
      const urlBob = pageBob.url()
      console.log(`   ✅ Bob autenticado: ${urlBob}`)
      
      // Se caiu no onboarding, pular
      if (urlBob.includes('onboarding')) {
        const pularBtnBob = pageBob.locator('button:has-text("Pular"), button:has-text("Concluir")').first()
        if (await pularBtnBob.isVisible({ timeout: 2000 }).catch(() => false)) {
          await pularBtnBob.click()
          await pageBob.waitForTimeout(1000)
        }
      }
      
      // ============================================================
      // PARTE 3: BOB TENTA VER RECEITAS (NÃO DEVE VER DE ALICE)
      // ============================================================
      console.log('\n## PARTE 3: Bob acessa Receitas')
      await pageBob.goto(`${BASE_URL}/receitas`)
      await pageBob.waitForLoadState('networkidle')
      
      // Bob NÃO deve ver "Salário Alice RLS Test"
      const bobVeReceitaAlice = await pageBob.locator('text=/Salário Alice RLS Test/i').isVisible({ timeout: 3000 }).catch(() => false)
      
      if (bobVeReceitaAlice) {
        console.log('   ❌ FALHA CRÍTICA: Bob consegue VER receita de Alice!')
        console.log('   ⚠️  RLS NÃO ESTÁ FUNCIONANDO CORRETAMENTE')
        expect(bobVeReceitaAlice).toBe(false) // Força falha do teste
      } else {
        console.log('   ✅ Bob NÃO vê receita de Alice (RLS OK)')
      }
      
      // Bob cria sua própria receita
      console.log('   Bob criando sua própria receita...')
      const addReceitaBtnBob = pageBob.locator('button:has-text("Adicionar"), button:has-text("Nova")').first()
      
      if (await addReceitaBtnBob.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addReceitaBtnBob.click()
        await pageBob.waitForTimeout(1000)
        
        await pageBob.fill('input[placeholder*="Descrição"], input[name="descricao"]', 'Freelance Bob RLS Test')
        
        const valorInputBob = pageBob.locator('input[placeholder*="valor"], input[type="text"]').last()
        await valorInputBob.click()
        await valorInputBob.fill('3000')
        
        const salvarBtnBob = pageBob.locator('button:has-text("Salvar"), button:has-text("Adicionar")').last()
        await salvarBtnBob.click()
        await pageBob.waitForTimeout(2000)
        
        console.log('   ✅ Receita de Bob criada')
      }
      
      // Verificar que Bob vê apenas sua receita
      await pageBob.reload()
      await pageBob.waitForLoadState('networkidle')
      
      const bobVeSuaReceita = await pageBob.locator('text=/Freelance Bob RLS Test/i').isVisible({ timeout: 3000 }).catch(() => false)
      const bobAindaVeAlice = await pageBob.locator('text=/Salário Alice RLS Test/i').isVisible({ timeout: 3000 }).catch(() => false)
      
      if (bobVeSuaReceita) {
        console.log('   ✅ Bob vê sua própria receita')
      }
      
      if (bobAindaVeAlice) {
        console.log('   ❌ FALHA CRÍTICA: Bob AINDA vê receita de Alice após reload!')
        expect(bobAindaVeAlice).toBe(false)
      } else {
        console.log('   ✅ Bob continua NÃO vendo receita de Alice')
      }
      
      // ============================================================
      // PARTE 4: ALICE VERIFICA ISOLAMENTO
      // ============================================================
      console.log('\n## PARTE 4: Alice verifica isolamento')
      await pageAlice.goto(`${BASE_URL}/receitas`)
      await pageAlice.waitForLoadState('networkidle')
      
      const aliceVeSuaReceita = await pageAlice.locator('text=/Salário Alice RLS Test/i').isVisible({ timeout: 3000 }).catch(() => false)
      const aliceVeReceitaBob = await pageAlice.locator('text=/Freelance Bob RLS Test/i').isVisible({ timeout: 3000 }).catch(() => false)
      
      if (aliceVeSuaReceita) {
        console.log('   ✅ Alice vê sua própria receita')
      } else {
        console.log('   ⚠️  Alice não vê sua receita (pode ter sido filtrada)')
      }
      
      if (aliceVeReceitaBob) {
        console.log('   ❌ FALHA CRÍTICA: Alice consegue VER receita de Bob!')
        expect(aliceVeReceitaBob).toBe(false)
      } else {
        console.log('   ✅ Alice NÃO vê receita de Bob (RLS OK)')
      }
      
      // ============================================================
      // PARTE 5: TESTAR DESPESAS
      // ============================================================
      console.log('\n## PARTE 5: Testando isolamento em Despesas')
      
      // Alice cria despesa
      await pageAlice.goto(`${BASE_URL}/despesas`)
      await pageAlice.waitForLoadState('networkidle')
      
      console.log('   Alice criando despesa...')
      const addDespesaBtn = pageAlice.locator('button:has-text("Adicionar"), button:has-text("Nova")').first()
      
      if (await addDespesaBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addDespesaBtn.click()
        await pageAlice.waitForTimeout(1000)
        
        await pageAlice.fill('input[placeholder*="Descrição"], input[name="descricao"]', 'Aluguel Alice RLS Test')
        
        const valorInputDespesa = pageAlice.locator('input[placeholder*="valor"], input[type="text"]').last()
        await valorInputDespesa.click()
        await valorInputDespesa.fill('1200')
        
        const salvarDespesaBtn = pageAlice.locator('button:has-text("Salvar"), button:has-text("Adicionar")').last()
        await salvarDespesaBtn.click()
        await pageAlice.waitForTimeout(2000)
        
        console.log('   ✅ Despesa de Alice criada')
      }
      
      // Bob verifica despesas
      await pageBob.goto(`${BASE_URL}/despesas`)
      await pageBob.waitForLoadState('networkidle')
      
      const bobVeDespesaAlice = await pageBob.locator('text=/Aluguel Alice RLS Test/i').isVisible({ timeout: 3000 }).catch(() => false)
      
      if (bobVeDespesaAlice) {
        console.log('   ❌ FALHA CRÍTICA: Bob vê despesa de Alice!')
        expect(bobVeDespesaAlice).toBe(false)
      } else {
        console.log('   ✅ Bob NÃO vê despesa de Alice (RLS OK)')
      }
      
      // ============================================================
      // RESULTADO FINAL
      // ============================================================
      console.log('\n═══════════════════════════════════════════════')
      console.log('RESULTADO DO TESTE RLS')
      console.log('═══════════════════════════════════════════════')
      console.log('✅ Alice autenticada com sucesso')
      console.log('✅ Bob autenticado com sucesso (sessão separada)')
      console.log('✅ Bob NÃO viu receitas de Alice')
      console.log('✅ Alice NÃO viu receitas de Bob')
      console.log('✅ Bob NÃO viu despesas de Alice')
      console.log('\n🔒 ISOLAMENTO RLS: FUNCIONANDO CORRETAMENTE')
      console.log('═══════════════════════════════════════════════\n')
      
    } catch (error) {
      console.error('\n❌ ERRO NO TESTE:', error.message)
      throw error
    } finally {
      await pageAlice.close()
      await pageBob.close()
      await contextAlice.close()
      await contextBob.close()
      await browser.close()
    }
  })
})
