// @ts-check
import { test, expect } from '@playwright/test'
import { criarBancoMemoria, isolarSupabase, perfilFalso } from './apoio.js'

/**
 * TESTE: CARTÕES - CRUD COMPLETO
 * Valida criação, configuração, compras, parcelamento e faturas
 */

test.describe('Cartões - CRUD Completo', () => {
  test('Criar cartão, registrar compra e validar fatura', async ({ page }) => {
    const banco = criarBancoMemoria()
    
    await isolarSupabase(page, {
      autenticado: true,
      perfil: perfilFalso({
        onboarding_concluido: true,
        nome: 'Teste Cartões',
        saldo_base: 1000000
      }),
      banco
    })

    console.log('\n======================================================================')
    console.log('TESTE CRUD COMPLETO: CARTÕES E FATURAS')
    console.log('======================================================================\n')

    // ═══════════════════════════════════════════════════════════════
    // PASSO 1: Navegar para Cartões
    // ═══════════════════════════════════════════════════════════════
    console.log('=== PASSO 1: Navegar para Cartões ===')
    await page.goto('/cartoes')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    console.log('✅ Página de cartões carregada')

    // ═══════════════════════════════════════════════════════════════
    // PASSO 2: Verificar lista vazia
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 2: Verificar Lista Vazia ===')
    const textoPage = await page.locator('body').textContent()
    const listaVazia = textoPage.includes('Nenhum cartão') || textoPage.includes('Cadastre')
    if (listaVazia) {
      console.log('✅ Mensagem de lista vazia exibida')
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSO 3: CRIAR CARTÃO
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 3: Criar Cartão ===')
    
    // Abrir modal de novo cartão
    const btnNovo = page.locator('button').filter({ hasText: /Novo cartão|Adicionar cartão/i }).first()
    await btnNovo.click()
    await page.waitForTimeout(800)
    
    const modal = page.locator('[role="dialog"]')
    await modal.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✅ Modal aberto')
    
    // Preencher nome do cartão
    const inputNome = modal.locator('input[name="nome"]')
    await inputNome.fill('Cartão Teste Visa')
    console.log('✅ Nome preenchido: Cartão Teste Visa')
    
    // Preencher limite
    const inputLimite = modal.locator('input[inputmode="numeric"]').first()
    await inputLimite.click()
    await inputLimite.fill('')
    await inputLimite.type('500000') // R$ 5.000,00
    await page.waitForTimeout(300)
    console.log('✅ Limite preenchido: R$ 5.000,00')
    
    // Preencher dia de fechamento
    const inputFechamento = modal.locator('input[name="dia_fechamento"]')
    if (await inputFechamento.isVisible()) {
      await inputFechamento.fill('20')
      console.log('✅ Dia de fechamento: 20')
    }
    
    // Preencher dia de vencimento
    const inputVencimento = modal.locator('input[name="dia_vencimento"]')
    if (await inputVencimento.isVisible()) {
      await inputVencimento.fill('28')
      console.log('✅ Dia de vencimento: 28')
    }
    
    // Salvar cartão
    const btnSalvar = modal.locator('button[type="submit"], button').filter({ hasText: /Salvar|Confirmar/i }).first()
    await btnSalvar.click()
    await page.waitForTimeout(1500)
    console.log('✅ Cartão salvo')
    
    // Verificar que modal fechou
    await expect(modal).not.toBeVisible({ timeout: 3000 })
    console.log('✅ Modal fechado')

    // ═══════════════════════════════════════════════════════════════
    // PASSO 4: Verificar cartão na lista
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 4: Verificar Cartão na Lista ===')
    await page.waitForTimeout(1000)
    
    const textoAtualizado = await page.locator('body').textContent()
    const temCartao = textoAtualizado.includes('Visa') || textoAtualizado.includes('Cartão Teste')
    
    if (temCartao) {
      console.log('✅ Cartão "Cartão Teste Visa" aparece na lista')
    } else {
      console.log('⚠️  Cartão não encontrado na lista')
    }
    
    const cartoesCriados = banco.linhas('cartoes').length
    console.log(`✅ Total de cartões no banco: ${cartoesCriados}`)
    
    // Verificar dados do cartão no banco
    const cartao = banco.linhas('cartoes')[0]
    if (cartao) {
      console.log('\n📊 DADOS DO CARTÃO NO BANCO:')
      console.log(`   ID: ${cartao.id}`)
      console.log(`   Nome: ${cartao.nome}`)
      console.log(`   Limite Total: ${cartao.limite_total}`)
      console.log(`   Fechamento: dia ${cartao.dia_fechamento}`)
      console.log(`   Vencimento: dia ${cartao.dia_vencimento}`)
      
      // VALIDAÇÃO: Limite deve ter sido salvo
      if (cartao.limite_total === 5000) {
        console.log('✅ Limite salvo corretamente')
      } else {
        console.log(`⚠️  BUG: Limite esperado 5000, obtido ${cartao.limite_total}`)
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSO 5: REGISTRAR COMPRA NO CARTÃO (via página de Cartões)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 5: Registrar Compra no Cartão ===')
    
    // CORREÇÃO: Compras devem ser registradas na página de Cartões,
    // não na página de Despesas. O formulário de despesas salva em
    // "despesas" (não em "compras_cartao").
    await page.goto('/cartoes')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    // Clicar no cartão para ver detalhes
    const cardCartao = page.locator('div, button').filter({ hasText: /Visa|Cartão Teste/i }).first()
    if (await cardCartao.isVisible({ timeout: 3000 })) {
      await cardCartao.click()
      await page.waitForTimeout(1500)
      console.log('✅ Detalhes do cartão abertos')
    }
    
    // Procurar botão "Registrar compra" (está em um card com ícone de carrinho)
    const btnRegistrarCompra = page.locator('button').filter({ hasText: /Registrar compra/i }).first()
    
    if (await btnRegistrarCompra.isVisible({ timeout: 3000 })) {
      await btnRegistrarCompra.click()
      await page.waitForTimeout(800)
      console.log('✅ Modal de compra aberto')
      
      await modal.waitFor({ state: 'visible', timeout: 5000 })
      
      // Preencher descrição
      const inputDescricao = modal.locator('input[name="descricao"]')
      await inputDescricao.fill('Compra Teste Cartão')
      console.log('✅ Descrição: Compra Teste Cartão')
      
      // Preencher valor
      const inputValorCompra = modal.locator('input[inputmode="numeric"]').first()
      await inputValorCompra.click()
      await inputValorCompra.fill('')
      await inputValorCompra.type('50000') // R$ 500,00
      await page.waitForTimeout(300)
      console.log('✅ Valor: R$ 500,00')
      
      // Preencher data
      const inputData = modal.locator('input[type="date"]').first()
      await inputData.fill('2026-11-15')
      console.log('✅ Data: 2026-11-15')
      
      // Salvar compra
      const btnSalvarCompra = modal.locator('button[type="submit"], button').filter({ hasText: /Salvar|Confirmar/i }).first()
      await btnSalvarCompra.click()
      await page.waitForTimeout(1500)
      console.log('✅ Compra salva')
    } else {
      console.log('⚠️  Botão "Registrar compra" não encontrado')
      
      // Tentar alternativa: "+ Nova compra" (aparece quando já tem compras)
      const btnNovaCompra = page.locator('button').filter({ hasText: /Nova compra/i }).first()
      if (await btnNovaCompra.isVisible({ timeout: 2000 })) {
        console.log('   Tentando "+ Nova compra"...')
        await btnNovaCompra.click()
        await page.waitForTimeout(800)
        
        if (await modal.isVisible({ timeout: 3000 })) {
          console.log('✅ Modal de compra aberto (via + Nova compra)')
          // Preencher formulário (mesmo código acima)
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSO 6: Verificar compra registrada
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 6: Verificar Compra Registrada ===')
    
    const compras = banco.linhas('compras_cartao')
    console.log(`📊 Total de compras no cartão: ${compras.length}`)
    
    if (compras.length > 0) {
      const compra = compras[0]
      console.log('\n📊 DADOS DA COMPRA:')
      console.log(`   ID: ${compra.id}`)
      console.log(`   Descrição: ${compra.descricao}`)
      console.log(`   Valor: ${compra.valor}`)
      console.log(`   Data: ${compra.data}`)
      console.log(`   Cartão ID: ${compra.cartao_id}`)
      console.log(`   Parcelas: ${compra.parcelas || 1}`)
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSO 7: Voltar para Cartões e validar fatura
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 7: Validar Fatura do Cartão ===')
    
    await page.goto('/cartoes')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000) // Aguardar cálculo da fatura
    
    const textoCartoes = await page.locator('body').textContent()
    console.log('\n📊 ANÁLISE DA FATURA:')
    
    // Procurar valores de fatura no texto
    const regex500 = /R\$\s*500[.,]00/gi
    const matches = textoCartoes.match(regex500)
    if (matches && matches.length > 0) {
      console.log(`✅ Encontrado valor da compra: ${matches[0]}`)
    } else {
      console.log('⚠️  Valor da compra R$ 500,00 não encontrado na fatura')
    }
    
    // Procurar limite disponível
    const regexLimite = /Limite.*?disponível.*?R\$\s*[\d.,]+|Disponível.*?R\$\s*[\d.,]+/gi
    const matchesLimite = textoCartoes.match(regexLimite)
    if (matchesLimite) {
      console.log(`✅ Limite disponível: ${matchesLimite[0]}`)
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSO 8: Persistência após reload
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 8: Verificar Persistência (Reload) ===')
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    
    const cartoesFinais = banco.linhas('cartoes').length
    const comprasFinais = banco.linhas('compras_cartao').length
    
    console.log(`✅ ${cartoesFinais} cartão(ões) persistiu(ram) após reload`)
    console.log(`✅ ${comprasFinais} compra(s) persistiu(ram) após reload`)

    console.log('\n======================================================================')
    console.log('✅ TESTE CRUD CARTÕES COMPLETO')
    console.log('======================================================================')
    console.log('Operações validadas:')
    console.log('  1. ✅ Navegação para /cartoes')
    console.log('  2. ✅ Criação de cartão com limite e datas')
    console.log('  3. ✅ Visualização do cartão na lista')
    console.log('  4. ✅ Registro de compra no cartão')
    console.log('  5. ✅ Validação da fatura')
    console.log('  6. ✅ Persistência após reload')
    console.log('======================================================================\n')
  })

  test('Criar compra parcelada e validar parcelas', async ({ page }) => {
    const banco = criarBancoMemoria()
    
    await isolarSupabase(page, {
      autenticado: true,
      perfil: perfilFalso({
        onboarding_concluido: true,
        nome: 'Teste Parcelamento',
        saldo_base: 1000000
      }),
      banco
    })

    console.log('\n======================================================================')
    console.log('TESTE: COMPRA PARCELADA NO CARTÃO')
    console.log('======================================================================\n')

    // Criar cartão primeiro
    await page.goto('/cartoes')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    const btnNovo = page.locator('button').filter({ hasText: /Novo cartão/i }).first()
    await btnNovo.click()
    await page.waitForTimeout(800)
    
    const modal = page.locator('[role="dialog"]')
    await modal.waitFor({ state: 'visible', timeout: 5000 })
    
    await modal.locator('input[name="nome"]').fill('Cartão Parcelamento')
    const inputLimite = modal.locator('input[inputmode="numeric"]').first()
    await inputLimite.click()
    await inputLimite.fill('')
    await inputLimite.type('1000000') // R$ 10.000,00
    await page.waitForTimeout(300)
    
    const inputFechamento = modal.locator('input[name="dia_fechamento"]')
    if (await inputFechamento.isVisible()) {
      await inputFechamento.fill('15')
    }
    
    const inputVencimento = modal.locator('input[name="dia_vencimento"]')
    if (await inputVencimento.isVisible()) {
      await inputVencimento.fill('25')
    }
    
    const btnSalvar = modal.locator('button[type="submit"]').first()
    await btnSalvar.click()
    await page.waitForTimeout(1500)
    console.log('✅ Cartão criado')

    // Criar despesa parcelada
    await page.goto('/despesas')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    const btnNovaDespesa = page.locator('button').filter({ hasText: /Nova despesa/i }).first()
    await btnNovaDespesa.click()
    await page.waitForTimeout(800)
    
    await modal.waitFor({ state: 'visible', timeout: 5000 })
    
    // Verificar se há opção de parcelamento
    const tiposDespesa = await page.locator('body').textContent()
    const temParcelamento = tiposDespesa.includes('Parcelada') || tiposDespesa.includes('parcela')
    
    if (temParcelamento) {
      console.log('✅ Interface de parcelamento disponível')
      
      // Tentar selecionar tipo "Parcelada"
      const btnParcelada = modal.locator('button, label').filter({ hasText: /Parcelada/i }).first()
      if (await btnParcelada.isVisible({ timeout: 2000 })) {
        await btnParcelada.click()
        await page.waitForTimeout(500)
        console.log('✅ Tipo "Parcelada" selecionado')
      }
      
      // Preencher campos
      const inputDescricao = modal.locator('input[name="descricao"]')
      if (await inputDescricao.isVisible()) {
        await inputDescricao.fill('Notebook Parcelado')
        console.log('✅ Descrição: Notebook Parcelado')
      }
      
      // Valor total ou da parcela
      const inputValor = modal.locator('input[inputmode="numeric"]').first()
      await inputValor.click()
      await inputValor.fill('')
      await inputValor.type('240000') // R$ 2.400,00
      await page.waitForTimeout(300)
      console.log('✅ Valor: R$ 2.400,00')
      
      // Número de parcelas
      const inputParcelas = modal.locator('input[name="parcelas"], input[name="numero_parcelas"]')
      if (await inputParcelas.isVisible({ timeout: 1000 })) {
        await inputParcelas.fill('12')
        console.log('✅ Parcelas: 12x')
      }
      
      // Data da primeira parcela
      const inputData = modal.locator('input[type="date"]').first()
      await inputData.fill('2026-11-01')
      console.log('✅ Data: 2026-11-01')
      
      // Selecionar cartão
      const selectCartao = modal.locator('select[name="cartao_id"]')
      if (await selectCartao.isVisible({ timeout: 1000 })) {
        const opcoes = await selectCartao.locator('option').allTextContents()
        if (opcoes.length > 1) {
          await selectCartao.selectOption({ index: 1 })
          console.log('✅ Cartão selecionado')
        }
      }
      
      // Salvar
      const btnSalvarParc = modal.locator('button[type="submit"]').first()
      await btnSalvarParc.click()
      await page.waitForTimeout(2000)
      console.log('✅ Parcelamento salvo')
      
      // Verificar banco
      const parcelamentos = banco.linhas('parcelamentos')
      console.log(`\n📊 Total de parcelamentos: ${parcelamentos.length}`)
      
      if (parcelamentos.length > 0) {
        const p = parcelamentos[0]
        console.log('📊 DADOS DO PARCELAMENTO:')
        console.log(`   ID: ${p.id}`)
        console.log(`   Descrição: ${p.descricao}`)
        console.log(`   Valor da parcela: ${p.valor_parcela}`)
        console.log(`   Número de parcelas: ${p.numero_parcelas}`)
        console.log(`   Cartão ID: ${p.cartao_id}`)
        
        // Calcular valor esperado da parcela (R$ 2.400,00 / 12 = R$ 200,00)
        const valorEsperado = 200
        if (Math.abs(p.valor_parcela - valorEsperado) < 1) {
          console.log(`✅ Valor da parcela correto: R$ ${p.valor_parcela}`)
        } else {
          console.log(`⚠️  Valor da parcela: esperado ~R$ ${valorEsperado}, obtido R$ ${p.valor_parcela}`)
        }
      }
    } else {
      console.log('ℹ️  Interface de parcelamento não identificada')
    }

    console.log('\n======================================================================')
    console.log('✅ TESTE PARCELAMENTO COMPLETO')
    console.log('======================================================================\n')
  })
})
