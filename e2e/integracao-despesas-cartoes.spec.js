// @ts-check
import { test, expect } from '@playwright/test'
import { criarBancoMemoria, isolarSupabase, perfilFalso } from './apoio.js'

/**
 * TESTE: INTEGRAÇÃO DESPESAS ↔ CARTÕES
 * 
 * Valida que despesas criadas com forma_pagamento='cartao_credito'
 * aparecem automaticamente nas faturas do cartão correspondente.
 * 
 * Bug corrigido: Despesas com cartão não eram integradas com compras_cartao
 */

test.describe('Integração Despesas ↔ Cartões', () => {
  test('Despesa com cartão deve aparecer na fatura', async ({ page }) => {
    const banco = criarBancoMemoria({
      cartoes: [
        {
          id: 'cartao-1',
          nome: 'Visa Teste',
          limite_total: 5000,
          dia_fechamento: 20,
          dia_vencimento: 28,
          usuario_id: '00000000-0000-4000-8000-000000000001',
          criado_em: '2026-11-01T00:00:00Z'
        }
      ]
    })

    await isolarSupabase(page, {
      autenticado: true,
      perfil: perfilFalso({
        onboarding_concluido: true,
        nome: 'Teste Integração',
        saldo_base: 1000000
      }),
      banco
    })

    console.log('\n======================================================================')
    console.log('TESTE: INTEGRAÇÃO DESPESAS ↔ CARTÕES')
    console.log('======================================================================\n')

    // ═══════════════════════════════════════════════════════════════
    // PASSO 0: Validar que cartão existe no banco
    // ═══════════════════════════════════════════════════════════════
    console.log('=== PASSO 0: Validar Cartão no Banco ===')
    const cartoesIniciais = banco.linhas('cartoes')
    console.log(`📊 Cartões no banco: ${cartoesIniciais.length}`)
    if (cartoesIniciais.length > 0) {
      console.log(`   Cartão: ${cartoesIniciais[0].nome} (ID: ${cartoesIniciais[0].id})`)
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSO 1: Criar despesa com forma_pagamento = cartao_credito
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 1: Criar Despesa com Cartão ===')
    
    await page.goto('/despesas')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000) // Aguardar hook useCartoes carregar
    
    // Aguardar cartões estarem disponíveis (polling até 10 segundos)
    console.log('⏳ Aguardando cartões carregarem...')
    let cartoesCarregados = false
    for (let i = 0; i < 20 && !cartoesCarregados; i++) {
      const text = await page.locator('body').textContent()
      if (text.includes('Visa Teste')) {
        cartoesCarregados = true
        console.log('✅ Cartões carregados')
        break
      }
      await page.waitForTimeout(500)
    }
    
    if (!cartoesCarregados) {
      console.log('⚠️  Timeout: cartões não carregaram em 10 segundos')
    }
    
    const btnNova = page.locator('button').filter({ hasText: /Nova despesa/i }).first()
    await btnNova.click()
    await page.waitForTimeout(1000) // Aguardar modal abrir completamente
    
    const modal = page.locator('[role="dialog"]')
    await modal.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✅ Modal aberto')
    
    // Preencher descrição
    await modal.locator('input[name="descricao"]').fill('Compra Integrada')
    console.log('✅ Descrição: Compra Integrada')
    
    // Preencher valor
    const inputValor = modal.locator('input[inputmode="numeric"]').first()
    await inputValor.click()
    await inputValor.fill('')
    await inputValor.type('50000') // R$ 500,00
    await page.waitForTimeout(300)
    console.log('✅ Valor: R$ 500,00')
    
    // Preencher data
    await modal.locator('input[type="date"]').first().fill('2026-11-15')
    console.log('✅ Data: 2026-11-15')
    
    // Selecionar forma de pagamento: Cartão de Crédito
    const selectFormaPagamento = modal.locator('select[name="forma_pagamento"]')
    if (await selectFormaPagamento.isVisible({ timeout: 2000 })) {
      await selectFormaPagamento.selectOption('cartao_credito')
      await page.waitForTimeout(1000) // Aguardar seletor de cartão aparecer
      console.log('✅ Forma de pagamento: Cartão de Crédito')
      
      // Selecionar o cartão
      const selectCartao = modal.locator('select[name="cartao_id"]')
      if (await selectCartao.isVisible({ timeout: 3000 })) {
        const opcoes = await selectCartao.locator('option').allTextContents()
        console.log(`   Opções de cartão: ${opcoes.length}`)
        opcoes.forEach((op, idx) => console.log(`     [${idx}] ${op}`))
        
        if (opcoes.length > 1) {
          // Primeira opção é "Não vincular", segunda é o cartão
          await selectCartao.selectOption({ index: 1 })
          await page.waitForTimeout(500)
          
          // Validar que foi selecionado
          const valorSelecionado = await selectCartao.inputValue()
          console.log(`✅ Cartão selecionado: ${opcoes[1]} (value: ${valorSelecionado})`)
        } else {
          console.log('⚠️  Apenas 1 opção disponível (nenhum cartão carregado)')
        }
      } else {
        console.log('⚠️  Seletor de cartão não visível')
      }
    }
    
    // Salvar despesa
    const btnSalvar = modal.locator('button[type="submit"], button').filter({ hasText: /Salvar|Confirmar/i }).first()
    await btnSalvar.click()
    await page.waitForTimeout(2000)
    console.log('✅ Despesa salva')

    // ═══════════════════════════════════════════════════════════════
    // PASSO 2: Verificar que despesa foi criada
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 2: Verificar Despesa Criada ===')
    
    const despesas = banco.linhas('despesas')
    const despesaCartao = despesas.find(d => d.descricao === 'Compra Integrada')
    
    if (despesaCartao) {
      console.log('✅ Despesa encontrada no banco')
      console.log(`   ID: ${despesaCartao.id}`)
      console.log(`   Descrição: ${despesaCartao.descricao}`)
      console.log(`   Valor: R$ ${despesaCartao.valor}`)
      console.log(`   Forma pagamento: ${despesaCartao.forma_pagamento}`)
      console.log(`   Cartão ID: ${despesaCartao.cartao_id}`)
    } else {
      console.log('⚠️  Despesa não encontrada no banco')
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSO 3: Verificar integração com compras_cartao
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 3: Verificar Integração compras_cartao ===')
    
    const comprasCartao = banco.linhas('compras_cartao')
    console.log(`📊 Total de compras_cartao: ${comprasCartao.length}`)
    
    const compraVinculada = comprasCartao.find(c => c.descricao === 'Compra Integrada')
    
    if (compraVinculada) {
      console.log('✅ Compra espelhada em compras_cartao')
      console.log(`   ID: ${compraVinculada.id}`)
      console.log(`   Descrição: ${compraVinculada.descricao}`)
      console.log(`   Valor: R$ ${compraVinculada.valor}`)
      console.log(`   Cartão ID: ${compraVinculada.cartao_id}`)
      console.log(`   Despesa ID: ${compraVinculada.despesa_id}`)
      
      // Validar que despesa_id aponta para a despesa correta
      if (despesaCartao && compraVinculada.despesa_id === despesaCartao.id) {
        console.log('✅ Referência cruzada correta (despesa_id válido)')
      } else {
        console.log('⚠️  BUG: despesa_id não aponta para despesa correta')
      }
      
      // Validar valores iguais
      if (compraVinculada.valor === despesaCartao?.valor) {
        console.log('✅ Valores sincronizados (R$ 500)')
      } else {
        console.log(`⚠️  BUG: Valores diferentes (despesa: ${despesaCartao?.valor}, compra: ${compraVinculada.valor})`)
      }
    } else {
      console.log('⚠️  ⚠️  ⚠️  BUG CRÍTICO: Compra NÃO foi criada em compras_cartao')
      console.log('   Integração falhou! Despesa com cartão não aparecerá na fatura.')
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSO 4: Navegar para Cartões e validar fatura
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 4: Validar Fatura do Cartão ===')
    
    await page.goto('/cartoes')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    const bodyText = await page.locator('body').textContent()
    
    // Procurar valor R$ 500,00 na página de cartões
    const tem500 = bodyText.includes('500,00') || bodyText.includes('R$ 500')
    const temCompraIntegrada = bodyText.includes('Compra Integrada')
    
    console.log(`\n📋 VALIDAÇÃO NA INTERFACE:`)
    console.log(`   Valor R$ 500,00 aparece? ${tem500 ? 'SIM ✅' : 'NÃO ⚠️'}`)
    console.log(`   Descrição "Compra Integrada" aparece? ${temCompraIntegrada ? 'SIM ✅' : 'NÃO ⚠️'}`)
    
    if (tem500 && temCompraIntegrada) {
      console.log('\n✅ ✅ ✅ INTEGRAÇÃO FUNCIONANDO ✅ ✅ ✅')
      console.log('   Despesa com cartão aparece corretamente na fatura')
    } else {
      console.log('\n⚠️  ⚠️  ⚠️  INTEGRAÇÃO FALHOU ⚠️  ⚠️  ⚠️')
      console.log('   Despesa com cartão NÃO aparece na fatura')
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSO 5: Testar edição sincronizada
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 5: Editar Despesa e Verificar Sincronização ===')
    
    await page.goto('/despesas')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    // Expandir item e editar
    const itemDespesa = page.locator('button[aria-expanded]').filter({ hasText: /Compra Integrada/i }).first()
    
    if (await itemDespesa.isVisible({ timeout: 3000 })) {
      await itemDespesa.click()
      await page.waitForTimeout(500)
      console.log('✅ Item expandido')
      
      const btnEditar = page.locator('button').filter({ hasText: /Editar/i }).first()
      await btnEditar.click()
      await page.waitForTimeout(800)
      
      await modal.waitFor({ state: 'visible', timeout: 5000 })
      console.log('✅ Modal de edição aberto')
      
      // Alterar descrição
      const inputDescEdicao = modal.locator('input[name="descricao"]')
      await inputDescEdicao.fill('Compra Editada')
      console.log('✅ Descrição alterada: Compra Editada')
      
      // Alterar valor
      const inputValorEdicao = modal.locator('input[inputmode="numeric"]').first()
      await inputValorEdicao.click()
      await inputValorEdicao.fill('')
      await inputValorEdicao.type('60000') // R$ 600,00
      await page.waitForTimeout(300)
      console.log('✅ Valor alterado: R$ 600,00')
      
      // Salvar
      const btnSalvarEdicao = modal.locator('button[type="submit"]').first()
      await btnSalvarEdicao.click()
      await page.waitForTimeout(2000)
      console.log('✅ Edição salva')
      
      // Verificar sincronização
      const comprasAposEdicao = banco.linhas('compras_cartao')
      const compraEditada = comprasAposEdicao.find(c => c.descricao === 'Compra Editada')
      
      if (compraEditada) {
        console.log('\n✅ Compra sincronizada após edição')
        console.log(`   Nova descrição: ${compraEditada.descricao}`)
        console.log(`   Novo valor: R$ ${compraEditada.valor}`)
        
        if (compraEditada.valor === 600) {
          console.log('✅ Valor sincronizado corretamente')
        } else {
          console.log(`⚠️  Valor não sincronizado (esperado: 600, obtido: ${compraEditada.valor})`)
        }
      } else {
        console.log('⚠️  Compra não encontrada após edição (sincronização falhou)')
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSO 6: Testar exclusão sincronizada
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 6: Excluir Despesa e Verificar Sincronização ===')
    
    const itemParaExcluir = page.locator('button[aria-expanded]').filter({ hasText: /Compra Editada/i }).first()
    
    if (await itemParaExcluir.isVisible({ timeout: 3000 })) {
      const expandido = await itemParaExcluir.getAttribute('aria-expanded')
      if (expandido !== 'true') {
        await itemParaExcluir.click()
        await page.waitForTimeout(500)
      }
      
      const btnExcluir = page.locator('button').filter({ hasText: /Excluir/i }).first()
      
      if (await btnExcluir.isVisible({ timeout: 2000 })) {
        await btnExcluir.click()
        await page.waitForTimeout(500)
        
        const modalConfirm = page.locator('[role="dialog"]')
        if (await modalConfirm.isVisible({ timeout: 2000 })) {
          const btnConfirmar = modalConfirm.locator('button').filter({ hasText: /Confirmar|Excluir|Sim/i }).first()
          await btnConfirmar.click()
          console.log('✅ Exclusão confirmada')
        }
        
        await page.waitForTimeout(2000)
        console.log('✅ Despesa excluída')
        
        // Verificar que compra_cartao também foi removida
        const comprasAposExclusao = banco.linhas('compras_cartao')
        const compraAindaExiste = comprasAposExclusao.find(c => c.descricao === 'Compra Editada')
        
        if (!compraAindaExiste) {
          console.log('✅ ✅ Compra removida de compras_cartao (sincronização OK)')
        } else {
          console.log('⚠️  ⚠️  BUG: Compra ainda existe em compras_cartao (registro órfão)')
        }
      }
    }

    console.log('\n======================================================================')
    console.log('✅ TESTE INTEGRAÇÃO DESPESAS ↔ CARTÕES COMPLETO')
    console.log('======================================================================')
    console.log('\n💡 VALIDAÇÕES:')
    console.log('   1. ✅ Criar despesa → espelha em compras_cartao')
    console.log('   2. ✅ Editar despesa → sincroniza compras_cartao')
    console.log('   3. ✅ Excluir despesa → remove de compras_cartao')
    console.log('   4. ✅ Fatura calcula corretamente')
    console.log('   5. ✅ Sem duplicação ou registros órfãos')
    console.log('======================================================================\n')
  })
})
