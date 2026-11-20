// @ts-check
import { test, expect } from '@playwright/test'

/**
 * TESTE: REPRODUZIR BUG ONBOARDING NO SUPABASE DEV REAL
 * 
 * Este teste NÃO usa mocks. Ele conecta ao Supabase DEV real para
 * reproduzir o bug reportado:
 * 
 * "Quando zero meus dados, entro no onboarding e começo a digitar o saldo,
 *  o aplicativo me redireciona para a Home antes de concluir."
 * 
 * Fluxo:
 * 1. Fazer login no DEV
 * 2. Zerar dados (RPC zerar_dados_financeiros)
 * 3. Entrar no onboarding
 * 4. Digitar saldo (R$ 5.000,00)
 * 5. VERIFICAR: usuário NÃO deve ser redirecionado para Home
 * 6. Salvar saldo
 * 7. VERIFICAR: usuário volta para central, NÃO para Home
 * 8. Verificar onboarding_concluido = false
 */

const BASE_URL = 'http://localhost:5173'

// Credenciais de teste no DEV (não usar em produção)
const USUARIO_TESTE = {
  email: 'teste.auditoria@almeidafinance.app',
  senha: 'TesteAuditoria2026!'
}

test.describe('BUG ONBOARDING - Supabase DEV Real', () => {
  test.beforeEach(async ({ page }) => {
    // Capturar logs do console para análise
    page.on('console', msg => {
      const text = msg.text()
      if (text.includes('[AuthContext]') || 
          text.includes('[useOnboarding]') || 
          text.includes('[App]') ||
          text.includes('atualizarPreferenciasLimite') ||
          text.includes('precisaOnboarding')) {
        console.log(`[BROWSER] ${text}`)
      }
    })
  })

  test('Reproduzir bug: digitar saldo não deve redirecionar para Home', async ({ page }) => {
    console.log('\n======================================================================')
    console.log('TESTE COM SUPABASE DEV REAL - BUG ONBOARDING')
    console.log('======================================================================\n')

    // === PASSO 1: Login ===
    console.log('=== PASSO 1: Login no DEV ===')
    await page.goto(BASE_URL)
    await page.waitForTimeout(2000)

    // Verificar se já está logado
    const urlAtual = page.url()
    if (!urlAtual.includes('/login')) {
      console.log('  ✅ Já está logado')
    } else {
      console.log('  Fazendo login...')
      await page.fill('input[type="email"]', USUARIO_TESTE.email)
      await page.fill('input[type="password"]', USUARIO_TESTE.senha)
      await page.click('button[type="submit"]')
      await page.waitForTimeout(3000)
      console.log('  ✅ Login realizado')
    }

    // === PASSO 2: Zerar dados financeiros ===
    console.log('\n=== PASSO 2: Zerar Dados Financeiros ===')
    await page.goto(`${BASE_URL}/configuracoes`)
    await page.waitForTimeout(1000)

    // Procurar botão "Zerar dados" ou "Reiniciar"
    const botaoZerar = page.locator('button:has-text("Zerar"), button:has-text("Reiniciar")')
    if (await botaoZerar.isVisible({ timeout: 3000 })) {
      await botaoZerar.click()
      await page.waitForTimeout(500)

      // Confirmar (pode ter modal de confirmação)
      const botaoConfirmar = page.locator('button:has-text("Confirmar"), button:has-text("Sim")')
      if (await botaoConfirmar.isVisible({ timeout: 2000 })) {
        await botaoConfirmar.click()
      }

      await page.waitForTimeout(2000)
      console.log('  ✅ Dados zerados')
    } else {
      console.log('  ⚠️  Botão de zerar não encontrado, dados podem já estar zerados')
    }

    // === PASSO 3: Entrar no onboarding ===
    console.log('\n=== PASSO 3: Acessar Onboarding ===')
    await page.goto(BASE_URL)
    await page.waitForTimeout(1500)

    const urlAposZerar = page.url()
    console.log('  URL após zerar:', urlAposZerar)

    if (urlAposZerar === `${BASE_URL}/`) {
      console.log('  ✅ Onboarding foi aberto automaticamente')
    } else {
      console.log('  ⚠️  Não foi redirecionado para onboarding, tentando acessar manualmente')
    }

    // === PASSO 4: Escolher configuração manual ===
    console.log('\n=== PASSO 4: Escolher Configuração Manual ===')
    const botaoManual = page.locator('button:has-text("Configurar manualmente"), button:has-text("Manual")')
    if (await botaoManual.isVisible({ timeout: 3000 })) {
      await botaoManual.click()
      await page.waitForTimeout(1000)
      console.log('  ✅ Configuração manual escolhida')
    } else {
      console.log('  ⚠️  Botão de configuração manual não encontrado, pode já estar na central')
    }

    // === PASSO 5: Abrir formulário de saldo ===
    console.log('\n=== PASSO 5: Abrir Formulário de Saldo ===')
    const cardSaldo = page.locator('button:has-text("Saldo"), [data-card="saldo"]')
    if (await cardSaldo.isVisible({ timeout: 3000 })) {
      await cardSaldo.click()
      await page.waitForTimeout(500)
      console.log('  ✅ Formulário de saldo aberto')
    } else {
      console.log('  ⚠️  Card de saldo não encontrado')
    }

    // === PASSO 6: MOMENTO CRÍTICO - Digitar saldo ===
    console.log('\n=== PASSO 6: DIGITAR SALDO (MOMENTO CRÍTICO) ===')
    const inputSaldo = page.locator('input[type="text"][name="saldo"], input[placeholder*="aldo"]')
    
    if (await inputSaldo.isVisible({ timeout: 2000 })) {
      console.log('  Digitando valor: 500000 (R$ 5.000,00)')
      
      // MONITORAR mudanças de URL durante a digitação
      let urlMudou = false
      page.on('framenavigated', (frame) => {
        if (frame === page.mainFrame()) {
          const novaUrl = frame.url()
          if (novaUrl.includes('/home') || novaUrl === `${BASE_URL}/`) {
            console.log(`  ⚠️  REDIRECIONAMENTO DETECTADO DURANTE DIGITAÇÃO: ${novaUrl}`)
            urlMudou = true
          }
        }
      })

      await inputSaldo.fill('500000')
      await page.waitForTimeout(1000)

      const urlAposDigitar = page.url()
      console.log('  URL após digitar:', urlAposDigitar)

      if (urlMudou || urlAposDigitar === `${BASE_URL}/` || urlAposDigitar.includes('/home')) {
        console.log('  ❌ BUG REPRODUZIDO: Redirecionado para Home ao digitar saldo!')
        console.log('  ❌ FALHA CRÍTICA: Onboarding foi interrompido indevidamente')
      } else {
        console.log('  ✅ Permaneceu no formulário de saldo após digitar')
      }

      // === PASSO 7: Salvar saldo ===
      console.log('\n=== PASSO 7: Salvar Saldo ===')
      const botaoSalvar = page.locator('button:has-text("Salvar"), button[type="submit"]')
      if (await botaoSalvar.isVisible({ timeout: 2000 })) {
        const urlAntesSalvar = page.url()
        console.log('  URL antes de salvar:', urlAntesSalvar)

        await botaoSalvar.click()
        await page.waitForTimeout(2000)

        const urlAposSalvar = page.url()
        console.log('  URL após salvar:', urlAposSalvar)

        if (urlAposSalvar === `${BASE_URL}/` && !urlAposSalvar.includes('onboarding')) {
          console.log('  ❌ BUG REPRODUZIDO: Redirecionado para Home ao salvar saldo!')
          console.log('  ❌ FALHA CRÍTICA: Deveria voltar para central de configuração')
        } else if (urlAposSalvar === urlAntesSalvar || urlAposSalvar.includes('onboarding')) {
          console.log('  ✅ Permaneceu no onboarding após salvar (esperado)')
        } else {
          console.log('  ⚠️  URL inesperada:', urlAposSalvar)
        }
      } else {
        console.log('  ⚠️  Botão Salvar não encontrado')
      }

      // === PASSO 8: Verificar estado do onboarding_concluido ===
      console.log('\n=== PASSO 8: Verificar Estado onboarding_concluido ===')
      
      // Executar script no contexto do browser para acessar o perfil
      const estadoPerfil = await page.evaluate(() => {
        // Tentar acessar o perfil através do window (exposto para debug)
        const perfil = window.__ALMEIDA_DEBUG_PERFIL__ || null
        return {
          onboarding_concluido: perfil?.onboarding_concluido,
          saldo_base: perfil?.saldo_base,
          temPerfil: !!perfil
        }
      })

      console.log('  Estado do perfil:', estadoPerfil)

      if (estadoPerfil.onboarding_concluido === true) {
        console.log('  ❌ BUG CONFIRMADO: onboarding_concluido foi setado como TRUE indevidamente!')
      } else if (estadoPerfil.onboarding_concluido === false) {
        console.log('  ✅ onboarding_concluido permanece FALSE (correto)')
      } else {
        console.log('  ⚠️  Não foi possível verificar onboarding_concluido')
      }

      // === PASSO 9: Verificar botão de conclusão ===
      console.log('\n=== PASSO 9: Verificar Botão de Conclusão ===')
      await page.goto(BASE_URL)
      await page.waitForTimeout(1000)

      const botaoConcluir = page.locator('button:has-text("Concluir"), button:has-text("Finalizar")')
      if (await botaoConcluir.isVisible({ timeout: 3000 })) {
        console.log('  ✅ Botão de conclusão disponível (correto)')
      } else {
        console.log('  ⚠️  Botão de conclusão não encontrado')
        console.log('  URL atual:', page.url())
      }

    } else {
      console.log('  ❌ Input de saldo não encontrado')
    }

    console.log('\n======================================================================')
    console.log('FIM DO TESTE COM SUPABASE DEV REAL')
    console.log('======================================================================')
  })
})
