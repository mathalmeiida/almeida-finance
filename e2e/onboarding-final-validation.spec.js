// @ts-check
// Validação final das últimas etapas do onboarding
import { test, expect } from '@playwright/test'
import { isolarSupabase, perfilFalso, pularApresentacao, criarBancoMemoria } from './apoio.js'

test.describe('Onboarding - Validação Final Completa', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('Fluxo completo: receitas → despesas → conclusão → reload', async ({ page }) => {
    const banco = criarBancoMemoria()
    
    await pularApresentacao(page)
    
    await page.addInitScript(() => {
      // Preservar flag de configuração se existir
      const flagConfigurando = localStorage.getItem('almeida_configurando_onboarding')
      const flagEtapa = localStorage.getItem('almeida_onboarding_etapa')
      
      localStorage.clear()
      localStorage.setItem('almeida_apresentacao_publica_vista', '1')
      
      // Restaurar flags se existiam
      if (flagConfigurando) localStorage.setItem('almeida_configurando_onboarding', flagConfigurando)
      if (flagEtapa) localStorage.setItem('almeida_onboarding_etapa', flagEtapa)
    })
    
    const { escritasPerfil } = await isolarSupabase(page, { 
      autenticado: true, 
      perfil: perfilFalso({ 
        onboarding_concluido: false,
        nome: 'Teste Validação Final',
        saldo_base: null
      }),
      banco 
    })
    
    // Capturar logs do console
    page.on('console', msg => {
      if (msg.text().includes('[App.jsx]')) {
        console.log('BROWSER:', msg.text())
      }
    })

    // Iniciar onboarding
    console.log('\n=== INICIAR ONBOARDING ===')
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    let texto = await page.locator('body').textContent()
    expect(texto.includes('Vamos organizar suas finanças'), 'Deve mostrar onboarding').toBeTruthy()
    console.log('✅ Onboarding iniciado')

    // Escolher configuração manual
    const btnManual = page.locator('button').filter({ hasText: /Configurar manualmente/i }).first()
    await btnManual.waitFor({ state: 'visible', timeout: 5000 })
    await btnManual.click()
    await page.waitForTimeout(1000)
    console.log('✅ Configuração manual escolhida')

    // === TESTE 1: CADASTRAR RECEITA ===
    console.log('\n=== TESTE 1: CADASTRAR RECEITA ===')
    
    // Garantir que flag está setada antes de navegar
    await page.evaluate(() => {
      localStorage.setItem('almeida_configurando_onboarding', '1')
    })
    
    // Buscar botão de Receitas (pode conter mais texto)
    const btnReceitas = page.locator('button').filter({ hasText: 'Receitas' }).first()
    const temBtnReceitas = await btnReceitas.isVisible({ timeout: 3000 }).catch(() => false)
    
    if (!temBtnReceitas) {
      // Debug: listar botões disponíveis
      const botoes = await page.locator('button:visible').allTextContents()
      console.log('Botões disponíveis:', botoes)
      throw new Error('Botão "Receitas" não encontrado na central')
    }
    
    await btnReceitas.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    
    // Verificar que navegou para /receitas
    const urlReceitas = page.url()
    expect(urlReceitas.includes('/receitas'), 'Deve navegar para /receitas').toBeTruthy()
    console.log('✅ Navegou para módulo Receitas')

    // Verificar parâmetro origem=onboarding
    expect(urlReceitas.includes('origem=onboarding'), 'Deve ter origem=onboarding').toBeTruthy()
    console.log('✅ Parâmetro origem=onboarding presente')

    // Aguardar página carregar completamente
    await page.waitForTimeout(2000)
    
    // Debug: ver botões disponíveis
    const botoesReceitas = await page.locator('button:visible').allTextContents()
    console.log('Botões na página Receitas:', botoesReceitas.slice(0, 10))

    // Abrir modal de nova receita
    const btnNovaReceita = page.locator('button').filter({ hasText: /Nova receita/i }).first()
    const temBtnNovaReceita = await btnNovaReceita.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (!temBtnNovaReceita) {
      const textoReceitas = await page.locator('body').textContent()
      console.log('Texto na página:', textoReceitas.substring(0, 500))
      throw new Error('Botão "Nova receita" não encontrado')
    }
    
    await btnNovaReceita.click()
    await page.waitForTimeout(1000)

    // Verificar que modal abriu
    const modalReceita = page.locator('[role="dialog"]').first()
    const temModal = await modalReceita.isVisible({ timeout: 3000 }).catch(() => false)
    expect(temModal, 'Modal de receita deve abrir').toBeTruthy()
    console.log('✅ Modal de nova receita aberto')

    // Preencher receita fictícia
    const campoDescricao = page.locator('input[type="text"]').first()
    await campoDescricao.fill('Salário Teste')
    
    const campoValor = page.locator('input').filter({ hasText: '' }).nth(1)
    await campoValor.click()
    await campoValor.fill('5000')
    
    console.log('✅ Receita preenchida: Salário Teste - R$ 5.000')

    // Salvar receita
    const btnSalvarReceita = page.locator('button').filter({ hasText: /salvar/i }).first()
    await btnSalvarReceita.click()
    await page.waitForTimeout(2000)

    console.log('✅ Receita salva')

    // Verificar que onboarding_concluido permanece false
    const perfilAposReceita = escritasPerfil[escritasPerfil.length - 1]?.body
    if (perfilAposReceita && 'onboarding_concluido' in perfilAposReceita) {
      expect(perfilAposReceita.onboarding_concluido, 'onboarding_concluido deve ser false').not.toBe(true)
      console.log('✅ onboarding_concluido permanece false')
    }

    // Retornar ao onboarding
    console.log('\n=== RETORNAR AO ONBOARDING (após receita) ===')
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    texto = await page.locator('body').textContent()
    const voltouOnboarding = texto.includes('Configure suas finanças')
    const foiParaDashboard = texto.includes('Planeje suas decisões')

    expect(voltouOnboarding, 'Deve voltar ao onboarding').toBeTruthy()
    expect(foiParaDashboard, 'NÃO deve ir para Dashboard').toBeFalsy()
    console.log('✅ Retornou corretamente ao onboarding')

    // === TESTE 2: CADASTRAR DESPESA ===
    console.log('\n=== TESTE 2: CADASTRAR DESPESA ===')
    
    const btnDespesas = page.locator('button').filter({ hasText: 'Despesas' }).first()
    const temBtnDespesas = await btnDespesas.isVisible({ timeout: 3000 }).catch(() => false)
    
    if (!temBtnDespesas) {
      const botoes = await page.locator('button:visible').allTextContents()
      console.log('Botões disponíveis:', botoes)
      throw new Error('Botão "Despesas" não encontrado na central')
    }
    
    await btnDespesas.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    
    // Verificar que navegou para /despesas
    const urlDespesas = page.url()
    expect(urlDespesas.includes('/despesas'), 'Deve navegar para /despesas').toBeTruthy()
    console.log('✅ Navegou para módulo Despesas')

    // Verificar parâmetro origem=onboarding
    expect(urlDespesas.includes('origem=onboarding'), 'Deve ter origem=onboarding').toBeTruthy()
    console.log('✅ Parâmetro origem=onboarding presente')

    // Abrir modal de nova despesa
    const btnNovaDespesa = page.locator('button').filter({ hasText: /Nova despesa/i }).first()
    await btnNovaDespesa.waitFor({ state: 'visible', timeout: 5000 })
    await btnNovaDespesa.click()
    await page.waitForTimeout(1000)

    // Verificar que modal abriu
    const modalDespesa = page.locator('[role="dialog"]').first()
    const temModalDespesa = await modalDespesa.isVisible({ timeout: 3000 }).catch(() => false)
    expect(temModalDespesa, 'Modal de despesa deve abrir').toBeTruthy()
    console.log('✅ Modal de nova despesa aberto')

    // Preencher despesa fictícia
    const campoDescDespesa = page.locator('input[type="text"]').first()
    await campoDescDespesa.fill('Aluguel Teste')
    
    const campoValorDespesa = page.locator('input').filter({ hasText: '' }).nth(1)
    await campoValorDespesa.click()
    await campoValorDespesa.fill('1500')
    
    console.log('✅ Despesa preenchida: Aluguel Teste - R$ 1.500')

    // Salvar despesa
    const btnSalvarDespesa = page.locator('button').filter({ hasText: /salvar/i }).first()
    await btnSalvarDespesa.click()
    await page.waitForTimeout(2000)

    console.log('✅ Despesa salva')

    // Verificar que onboarding_concluido permanece false
    const perfilAposDespesa = escritasPerfil[escritasPerfil.length - 1]?.body
    if (perfilAposDespesa && 'onboarding_concluido' in perfilAposDespesa) {
      expect(perfilAposDespesa.onboarding_concluido, 'onboarding_concluido deve ser false').not.toBe(true)
      console.log('✅ onboarding_concluido permanece false')
    }

    // Retornar ao onboarding
    console.log('\n=== RETORNAR AO ONBOARDING (após despesa) ===')
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    texto = await page.locator('body').textContent()
    const voltouOnboarding2 = texto.includes('Configure suas finanças')
    const foiParaDashboard2 = texto.includes('Planeje suas decisões')

    expect(voltouOnboarding2, 'Deve voltar ao onboarding').toBeTruthy()
    expect(foiParaDashboard2, 'NÃO deve ir para Dashboard').toBeFalsy()
    console.log('✅ Retornou corretamente ao onboarding')

    // === TESTE 3: FINALIZAÇÃO EXPLÍCITA ===
    console.log('\n=== TESTE 3: FINALIZAÇÃO EXPLÍCITA ===')
    
    // Procurar botão "Concluir configuração"
    const btnConcluirConfig = page.locator('button').filter({ hasText: /Concluir configuração/i }).first()
    const temBtnConcluir = await btnConcluirConfig.isVisible({ timeout: 3000 }).catch(() => false)
    
    if (!temBtnConcluir) {
      throw new Error('Botão "Concluir configuração" não encontrado')
    }
    
    console.log('✅ Botão "Concluir configuração" encontrado')

    // Clicar em concluir
    const countPerfilAntes = escritasPerfil.length
    await btnConcluirConfig.click()
    await page.waitForTimeout(2000)

    // Verificar que foi para tela de conclusão/resumo
    texto = await page.locator('body').textContent()
    const temConclusao = texto.includes('Parabéns') || texto.includes('Tudo pronto') || texto.includes('conclu')
    
    if (temConclusao) {
      console.log('✅ Tela de conclusão/resumo exibida')
      
      // Procurar botão final de conclusão
      const btnFinalizar = page.locator('button').filter({ hasText: /começar|finalizar|ir para|dashboard/i }).first()
      const temBtnFinalizar = await btnFinalizar.isVisible({ timeout: 3000 }).catch(() => false)
      
      if (temBtnFinalizar) {
        await btnFinalizar.click()
        await page.waitForTimeout(2000)
        console.log('✅ Botão de finalização clicado')
      }
    }

    // Verificar que foi para Dashboard
    await page.waitForTimeout(1000)
    texto = await page.locator('body').textContent()
    const agoraDashboard = texto.includes('Planeje suas decisões')
    
    expect(agoraDashboard, 'Deve abrir Dashboard após conclusão').toBeTruthy()
    console.log('✅ Dashboard aberto após conclusão explícita')

    // Verificar que onboarding_concluido foi marcado como true
    await page.waitForTimeout(500)
    const countPerfilDepois = escritasPerfil.length
    
    if (countPerfilDepois > countPerfilAntes) {
      const ultimaEscrita = escritasPerfil[escritasPerfil.length - 1]?.body
      if (ultimaEscrita && 'onboarding_concluido' in ultimaEscrita) {
        expect(ultimaEscrita.onboarding_concluido, 'onboarding_concluido deve ser true').toBe(true)
        console.log('✅ onboarding_concluido marcado como true no perfil')
      }
    }

    // Verificar que flags foram limpas
    const flagConfigurando = await page.evaluate(() => localStorage.getItem('almeida_configurando_onboarding'))
    const flagEtapa = await page.evaluate(() => localStorage.getItem('almeida_onboarding_etapa'))
    
    expect(flagConfigurando, 'Flag CHAVE_CONFIGURANDO deve ser limpa').toBeNull()
    expect(flagEtapa, 'Flag almeida_onboarding_etapa deve ser limpa').toBeNull()
    console.log('✅ Flags temporárias limpas')

    // === TESTE 4: RELOAD E PERSISTÊNCIA ===
    console.log('\n=== TESTE 4: RELOAD E PERSISTÊNCIA ===')
    
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    texto = await page.locator('body').textContent()
    const voltouDashboard = texto.includes('Planeje suas decisões')
    const voltouOnboarding3 = texto.includes('Vamos organizar suas finanças')

    expect(voltouDashboard, 'Deve permanecer no Dashboard').toBeTruthy()
    expect(voltouOnboarding3, 'NÃO deve voltar ao onboarding').toBeFalsy()
    console.log('✅ Permaneceu no Dashboard após reload')

    // Verificar que flags continuam limpas
    const flagConfigurandoFinal = await page.evaluate(() => localStorage.getItem('almeida_configurando_onboarding'))
    const flagEtapaFinal = await page.evaluate(() => localStorage.getItem('almeida_onboarding_etapa'))
    
    expect(flagConfigurandoFinal, 'Flag CHAVE_CONFIGURANDO deve continuar limpa').toBeNull()
    expect(flagEtapaFinal, 'Flag almeida_onboarding_etapa deve continuar limpa').toBeNull()
    console.log('✅ Flags não retornaram após reload')

    console.log('\n✅ VALIDAÇÃO FINAL COMPLETA: TODOS OS PASSOS PASSARAM')
  })
})
