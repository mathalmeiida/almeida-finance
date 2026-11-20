import { test, expect } from '@playwright/test'
import { criarBancoMemoria, isolarSupabase, perfilFalso, pularApresentacao } from './apoio.js'
import path from 'path'

const SCREENSHOTS_DIR = path.join(process.cwd(), 'test-results', 'bug-onboarding-saldo')

/**
 * TESTE: BUG CRÍTICO - Digitar saldo redireciona automaticamente para Home
 * 
 * Descrição do bug:
 * "Quando o usuário zera seus dados, acessa o onboarding e começa a digitar o saldo,
 * o aplicativo redireciona imediatamente para a Home."
 * 
 * Este teste DEVE FALHAR se o bug existir.
 * 
 * Comportamento esperado:
 * - Usuário pode digitar qualquer valor no campo de saldo
 * - Usuário pode salvar o saldo
 * - Aplicativo NÃO redireciona automaticamente para Home
 * - Usuário permanece no onboarding até clicar em "Concluir configuração"
 */

test.describe('BUG CRÍTICO: Onboarding Saldo Redireciona', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('Digitar e salvar saldo NÃO deve finalizar onboarding automaticamente', async ({ page }) => {
    const banco = criarBancoMemoria()
    
    const resultado = await isolarSupabase(page, {
      autenticado: true,
      perfil: perfilFalso({
        onboarding_concluido: false,  // ← Onboarding NÃO concluído
        nome: 'Teste Bug Saldo',
        saldo_base: null  // ← Sem saldo inicial
      }),
      banco
    })

    await pularApresentacao(page)

    console.log('\n' + '='.repeat(70))
    console.log('TESTE DE REPRODUÇÃO DO BUG: Saldo redireciona para Home')
    console.log('='.repeat(70))

    // ═══════════════════════════════════════════════════════════════
    // PASSO 1: Acessar onboarding
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 1: Acessar Onboarding ===')
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    const textoInicial = await page.locator('body').textContent()
    const estaNoOnboarding = textoInicial.includes('Vamos organizar suas finanças') ||
                              textoInicial.includes('Planeje suas decisões') ||
                              textoInicial.includes('Configurar manualmente')
    
    expect(estaNoOnboarding, 'Deve estar no onboarding').toBe(true)
    console.log('✅ Onboarding carregado')
    
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-onboarding-inicial.png'), fullPage: true })

    // ═══════════════════════════════════════════════════════════════
    // PASSO 2: Escolher configuração manual
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 2: Escolher Configuração Manual ===')
    
    const btnManual = page.locator('button').filter({ hasText: /Configurar manualmente/i }).first()
    const temBtnManual = await btnManual.isVisible({ timeout: 3000 }).catch(() => false)
    
    if (temBtnManual) {
      await btnManual.click()
      await page.waitForTimeout(1500)
      console.log('✅ Botão "Configurar manualmente" clicado')
    } else {
      console.log('⚠  Já está na central de configuração')
    }
    
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-central-configuracao.png'), fullPage: true })

    // ═══════════════════════════════════════════════════════════════
    // PASSO 3: Abrir formulário de saldo
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 3: Abrir Formulário de Saldo ===')
    
    const btnSaldo = page.locator('button').filter({ hasText: /Saldo e Contas/i }).first()
    await btnSaldo.click()
    await page.waitForTimeout(1500)
    
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-formulario-saldo.png'), fullPage: true })
    
    const textoFormulario = await page.locator('body').textContent()
    const formularioAberto = textoFormulario.includes('Saldo inicial') ||
                             textoFormulario.includes('saldo bancário')
    
    expect(formularioAberto, 'Formulário de saldo deve estar aberto').toBe(true)
    console.log('✅ Formulário de saldo aberto')

    // ═══════════════════════════════════════════════════════════════
    // PASSO 4: TESTAR DIFERENTES VALORES (bug pode ocorrer em qualquer um)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 4: Testar Digitação de Valores ===')
    
    const valoresTeste = [
      { digitos: '5000', esperado: 'R$ 50,00', desc: 'R$ 50' },
      { digitos: '50000', esperado: 'R$ 500,00', desc: 'R$ 500' },
      { digitos: '500000', esperado: 'R$ 5.000,00', desc: 'R$ 5.000' },
      { digitos: '5000000', esperado: 'R$ 50.000,00', desc: 'R$ 50.000' }
    ]
    
    for (const valorTeste of valoresTeste) {
      console.log(`\n--- Testando valor: ${valorTeste.desc} ---`)
      
      const campoSaldo = page.locator('input[type="text"]').first()
      
      // Limpar campo
      await campoSaldo.clear()
      await page.waitForTimeout(300)
      
      // Digitar valor
      await campoSaldo.fill(valorTeste.digitos)
      await page.waitForTimeout(500)
      
      console.log(`Digitado: ${valorTeste.digitos}`)
      
      // Verificar que ainda está no onboarding
      const urlAposDigitar = page.url()
      const textoAposDigitar = await page.locator('body').textContent()
      
      const aindaNoOnboarding = textoAposDigitar.includes('Saldo inicial') ||
                                 textoAposDigitar.includes('Voltar para central') ||
                                 urlAposDigitar.includes('/') && !urlAposDigitar.includes('/home')
      
      if (!aindaNoOnboarding) {
        console.log('❌ BUG DETECTADO: Redirecionou após digitar!')
        console.log(`URL atual: ${urlAposDigitar}`)
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `04-bug-redireciona-${valorTeste.desc.replace(/[^0-9]/g, '')}.png`), fullPage: true })
        throw new Error(`BUG: Aplicativo redirecionou para Home após digitar ${valorTeste.desc}`)
      }
      
      console.log(`✅ Permaneceu no onboarding após digitar ${valorTeste.desc}`)
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSO 5: Salvar saldo (último valor: R$ 50.000)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 5: Salvar Saldo ===')
    
    const btnSalvar = page.locator('button').filter({ hasText: /Salvar|Continuar/i }).last()
    
    const urlAntesSalvar = page.url()
    console.log(`URL antes de salvar: ${urlAntesSalvar}`)
    
    await btnSalvar.click()
    await page.waitForTimeout(3000)  // Aguardar salvamento no Supabase
    
    const urlAposSalvar = page.url()
    const textoAposSalvar = await page.locator('body').textContent()
    
    console.log(`URL após salvar: ${urlAposSalvar}`)
    
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-apos-salvar-saldo.png'), fullPage: true })
    
    // Verificar que voltou para central (não para Home/Dashboard)
    const voltouCentral = textoAposSalvar.includes('Configure suas finanças') ||
                          textoAposSalvar.includes('Concluir configuração') ||
                          textoAposSalvar.includes('Receitas') && textoAposSalvar.includes('Despesas')
    
    const foiParaHome = textoAposSalvar.includes('Saldo disponível') ||
                        textoAposSalvar.includes('Limite diário') ||
                        urlAposSalvar.includes('/home')
    
    if (foiParaHome) {
      console.log('❌ BUG CRÍTICO DETECTADO: Redirecionou para Home após salvar saldo!')
      console.log('❌ Onboarding foi finalizado automaticamente sem ação explícita do usuário')
      throw new Error('BUG CRÍTICO: Salvar saldo finalizou onboarding automaticamente')
    }
    
    if (!voltouCentral) {
      console.log('⚠  Não voltou para central, verificando estado atual')
      console.log('Primeiros 300 caracteres:', textoAposSalvar.substring(0, 300))
    }
    
    expect(voltouCentral, 'Deve voltar para central de configuração').toBe(true)
    console.log('✅ Voltou para central (não foi para Home)')

    // ═══════════════════════════════════════════════════════════════
    // PASSO 6: Verificar que onboarding_concluido ainda é FALSE
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 6: Verificar Flag onboarding_concluido ===')
    
    const escritasPerfil = resultado.escritasPerfil || []
    const ultimaEscrita = escritasPerfil[escritasPerfil.length - 1]
    
    console.log(`Total de escritas no perfil: ${escritasPerfil.length}`)
    
    if (ultimaEscrita) {
      console.log('Última escrita no perfil:', {
        saldo_base: ultimaEscrita.saldo_base,
        onboarding_concluido: ultimaEscrita.onboarding_concluido
      })
      
      // Verificar que onboarding_concluido NÃO foi alterado para true
      if (ultimaEscrita.onboarding_concluido === true) {
        console.log('❌ BUG: onboarding_concluido foi marcado como TRUE ao salvar saldo!')
        throw new Error('BUG: onboarding_concluido alterado para true sem ação explícita')
      }
      
      console.log('✅ onboarding_concluido permanece FALSE (correto)')
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSO 7: Verificar botão "Concluir configuração" está disponível
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 7: Verificar Botão de Conclusão ===')
    
    const btnConcluir = page.locator('button').filter({ hasText: /Concluir configuração/i }).first()
    const temBtnConcluir = await btnConcluir.isVisible({ timeout: 3000 }).catch(() => false)
    
    if (!temBtnConcluir) {
      console.log('❌ Botão "Concluir configuração" não encontrado')
      console.log('❌ Usuário não pode finalizar onboarding explicitamente')
      throw new Error('Botão "Concluir configuração" ausente')
    }
    
    console.log('✅ Botão "Concluir configuração" disponível')
    console.log('✅ Usuário pode finalizar onboarding quando desejar')

    // ═══════════════════════════════════════════════════════════════
    // RESUMO FINAL
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + '='.repeat(70))
    console.log('✅ TESTE PASSOU: BUG NÃO REPRODUZIDO')
    console.log('='.repeat(70))
    console.log('\n✅ Comportamentos Validados:')
    console.log('  1. ✅ Usuário pode digitar valores no campo de saldo')
    console.log('  2. ✅ Digitação não causa redirecionamento automático')
    console.log('  3. ✅ Usuário pode salvar o saldo')
    console.log('  4. ✅ Salvar saldo não finaliza onboarding automaticamente')
    console.log('  5. ✅ Usuário volta para central de configuração')
    console.log('  6. ✅ onboarding_concluido permanece FALSE')
    console.log('  7. ✅ Botão "Concluir configuração" disponível')
    console.log('\n🎯 Conclusão: Onboarding está funcionando corretamente')
  })
})
