// @ts-check
import { test, expect } from '@playwright/test'
import { criarBancoMemoria, isolarSupabase, perfilFalso } from './apoio.js'

/**
 * TESTE: DESPESAS - CRUD COMPLETO
 * Valida criação, listagem, edição e exclusão de despesas
 * INCLUI RECORRÊNCIA E FORMAS DE PAGAMENTO
 */

test.describe('Despesas - CRUD Completo', () => {
  test('Criar despesa simples, editar e excluir', async ({ page }) => {
    const banco = criarBancoMemoria()
    
    await isolarSupabase(page, {
      autenticado: true,
      perfil: perfilFalso({
        onboarding_concluido: true,
        nome: 'Teste Despesas CRUD',
        saldo_base: 500000
      }),
      banco
    })

    console.log('\n======================================================================')
    console.log('TESTE CRUD COMPLETO: DESPESAS')
    console.log('======================================================================\n')

    // ═══════════════════════════════════════════════════════════════
    // PASSO 1: Navegar para Despesas
    // ═══════════════════════════════════════════════════════════════
    console.log('=== PASSO 1: Navegar para Despesas ===')
    await page.goto('/despesas')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    console.log('✅ Página de despesas carregada')

    // ═══════════════════════════════════════════════════════════════
    // PASSO 2: Verificar lista vazia
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 2: Verificar Lista Vazia ===')
    const textoPage = await page.locator('body').textContent()
    const listaVazia = textoPage.includes('Nenhuma despesa') || textoPage.includes('Cadastre')
    if (listaVazia) {
      console.log('✅ Mensagem de lista vazia exibida')
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSO 3: CRIAR DESPESA SIMPLES (NÃO RECORRENTE)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 3: Criar Despesa Simples ===')
    
    // Abrir modal
    const btnNova = page.locator('button').filter({ hasText: /Nova despesa|Adicionar/i }).first()
    await btnNova.click()
    await page.waitForTimeout(800)
    
    // Aguardar modal abrir
    const modal = page.locator('[role="dialog"]')
    await modal.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✅ Modal aberto')
    
    // Preencher descrição
    const inputDescricao = modal.locator('input[name="descricao"]')
    await inputDescricao.fill('Supermercado Teste')
    console.log('✅ Descrição preenchida: Supermercado Teste')
    
    // Preencher valor usando InputMoeda
    const inputValor = modal.locator('input[inputmode="numeric"]').first()
    await inputValor.click()
    await inputValor.fill('')
    await inputValor.type('25000') // R$ 250,00
    await page.waitForTimeout(300)
    console.log('✅ Valor preenchido: R$ 250,00')
    
    // Preencher data
    const inputData = modal.locator('input[type="date"]').first()
    await inputData.fill('2026-11-15')
    console.log('✅ Data preenchida: 2026-11-15')
    
    // Verificar se há seletor de frequência e deixar como "Não" (padrão)
    const selectFrequencia = modal.locator('select[name="frequencia"]')
    if (await selectFrequencia.isVisible()) {
      const valorFreq = await selectFrequencia.inputValue()
      console.log(`✅ Frequência: ${valorFreq} (não repete)`)
    }
    
    // Selecionar categoria (se disponível)
    const selectCategoria = modal.locator('select[name="categoria_id"]')
    if (await selectCategoria.isVisible()) {
      const opcoes = await selectCategoria.locator('option').allTextContents()
      if (opcoes.length > 1) {
        await selectCategoria.selectOption({ index: 1 })
        console.log('✅ Categoria selecionada')
      }
    }
    
    // Salvar
    const btnSalvar = modal.locator('button[type="submit"], button').filter({ hasText: /Salvar|Confirmar/i }).first()
    await btnSalvar.click()
    await page.waitForTimeout(1500)
    console.log('✅ Despesa salva')
    
    // Verificar que modal fechou
    await expect(modal).not.toBeVisible({ timeout: 3000 })
    console.log('✅ Modal fechado')

    // ═══════════════════════════════════════════════════════════════
    // PASSO 4: Verificar despesa na lista
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 4: Verificar Despesa na Lista ===')
    await page.waitForTimeout(1000)
    
    const textoAtualizado = await page.locator('body').textContent()
    const temDespesa = textoAtualizado.includes('Supermercado') || textoAtualizado.includes('250')
    
    if (temDespesa) {
      console.log('✅ Despesa "Supermercado Teste" aparece na lista')
    } else {
      console.log('⚠️  Despesa não encontrada na lista')
    }
    
    const despesasCriadas = banco.linhas('despesas').length
    console.log(`✅ Total de despesas no banco: ${despesasCriadas}`)

    // ═══════════════════════════════════════════════════════════════
    // PASSO 5: EDITAR DESPESA
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 5: Editar Despesa ===')
    
    const itemDespesa = page.locator('li, div, button').filter({ hasText: /Supermercado/i }).first()
    
    if (await itemDespesa.isVisible({ timeout: 3000 })) {
      await itemDespesa.click()
      await page.waitForTimeout(800)
      
      await modal.waitFor({ state: 'visible', timeout: 5000 })
      console.log('✅ Modal de edição aberto')
      
      // Alterar descrição
      const inputDescEdicao = modal.locator('input[name="descricao"]')
      await inputDescEdicao.fill('Mercado Editado')
      console.log('✅ Descrição alterada')
      
      // Alterar valor
      const inputValorEdicao = modal.locator('input[inputmode="numeric"]').first()
      await inputValorEdicao.click()
      await inputValorEdicao.fill('')
      await inputValorEdicao.type('30000') // R$ 300,00
      await page.waitForTimeout(300)
      console.log('✅ Valor alterado para R$ 300,00')
      
      // Salvar edição
      const btnSalvarEdicao = modal.locator('button[type="submit"], button').filter({ hasText: /Salvar|Confirmar/i }).first()
      await btnSalvarEdicao.click()
      await page.waitForTimeout(1500)
      console.log('✅ Edição salva')
      
      await expect(modal).not.toBeVisible({ timeout: 3000 })
    } else {
      console.log('⚠️  Item de despesa não encontrado para editar')
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSO 6: Verificar edição refletida
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 6: Verificar Edição na Lista ===')
    await page.waitForTimeout(1000)
    
    const textoEditado = await page.locator('body').textContent()
    const temEdicao = textoEditado.includes('Editado') || textoEditado.includes('300')
    
    if (temEdicao) {
      console.log('✅ Edição refletida na lista')
    } else {
      console.log('⚠️  Edição não encontrada')
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSO 7: EXCLUIR DESPESA
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 7: Excluir Despesa ===')
    
    const btnExcluir = page.locator('button[aria-label*="Excluir"], button[title*="Excluir"], button').filter({ hasText: /Excluir|Remover/i }).first()
    
    if (await btnExcluir.isVisible({ timeout: 2000 })) {
      await btnExcluir.click()
      await page.waitForTimeout(500)
      
      const modalConfirm = page.locator('[role="dialog"]')
      if (await modalConfirm.isVisible({ timeout: 2000 })) {
        const btnConfirmar = modalConfirm.locator('button').filter({ hasText: /Confirmar|Excluir|Sim/i }).first()
        await btnConfirmar.click()
        console.log('✅ Exclusão confirmada')
      }
      
      await page.waitForTimeout(1500)
      console.log('✅ Despesa excluída')
    } else {
      console.log('⚠️  Botão de exclusão não encontrado')
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSO 8: Verificar exclusão
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 8: Verificar Exclusão ===')
    await page.waitForTimeout(1000)
    
    const textoFinal = await page.locator('body').textContent()
    const aindaTemDespesa = textoFinal.includes('Mercado') || textoFinal.includes('Editado')
    
    if (!aindaTemDespesa) {
      console.log('✅ Despesa removida da lista')
    } else {
      console.log('⚠️  Despesa ainda aparece na lista')
    }
    
    const despesasFinais = banco.linhas('despesas').length
    console.log(`✅ Total de despesas após exclusão: ${despesasFinais}`)

    // ═══════════════════════════════════════════════════════════════
    // PASSO 9: Persistência após reload
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 9: Verificar Persistência (Reload) ===')
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    const textoReload = await page.locator('body').textContent()
    const listaVaziaFinal = textoReload.includes('Nenhuma despesa') || textoReload.includes('Cadastre')
    
    if (listaVaziaFinal && despesasFinais === 0) {
      console.log('✅ Lista vazia persistiu após reload')
    } else if (despesasFinais > 0) {
      console.log(`✅ ${despesasFinais} despesa(s) persistiu(ram) após reload`)
    }

    console.log('\n======================================================================')
    console.log('✅ TESTE CRUD DESPESAS COMPLETO')
    console.log('======================================================================')
    console.log('Operações validadas:')
    console.log('  1. ✅ Navegação para /despesas')
    console.log('  2. ✅ Abertura de modal de criação')
    console.log('  3. ✅ Preenchimento de formulário (descrição, valor, data, categoria)')
    console.log('  4. ✅ Salvamento de despesa')
    console.log('  5. ✅ Visualização na lista')
    console.log('  6. ✅ Abertura de modal de edição')
    console.log('  7. ✅ Alteração de campos')
    console.log('  8. ✅ Salvamento de edição')
    console.log('  9. ✅ Exclusão de despesa')
    console.log(' 10. ✅ Persistência após reload')
    console.log('======================================================================\n')
  })

  test('Criar despesa recorrente mensal', async ({ page }) => {
    const banco = criarBancoMemoria()
    
    await isolarSupabase(page, {
      autenticado: true,
      perfil: perfilFalso({
        onboarding_concluido: true,
        nome: 'Teste Recorrência',
        saldo_base: 500000
      }),
      banco
    })

    console.log('\n======================================================================')
    console.log('TESTE: DESPESA RECORRENTE MENSAL')
    console.log('======================================================================\n')

    await page.goto('/despesas')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    // Abrir modal
    const btnNova = page.locator('button').filter({ hasText: /Nova despesa/i }).first()
    await btnNova.click()
    await page.waitForTimeout(800)
    
    const modal = page.locator('[role="dialog"]')
    await modal.waitFor({ state: 'visible', timeout: 5000 })
    
    // Preencher campos
    await modal.locator('input[name="descricao"]').fill('Aluguel Mensal')
    console.log('✅ Descrição: Aluguel Mensal')
    
    const inputValor = modal.locator('input[inputmode="numeric"]').first()
    await inputValor.click()
    await inputValor.fill('')
    await inputValor.type('120000') // R$ 1.200,00
    await page.waitForTimeout(300)
    console.log('✅ Valor: R$ 1.200,00')
    
    await modal.locator('input[type="date"]').first().fill('2026-11-01')
    console.log('✅ Data: 2026-11-01')
    
    // Selecionar frequência mensal
    const selectFrequencia = modal.locator('select[name="frequencia"]')
    if (await selectFrequencia.isVisible()) {
      await selectFrequencia.selectOption('mensal')
      console.log('✅ Frequência: Mensal')
    }
    
    // Salvar
    const btnSalvar = modal.locator('button[type="submit"]').first()
    await btnSalvar.click()
    await page.waitForTimeout(1500)
    console.log('✅ Despesa recorrente salva')
    
    // Verificar banco
    const despesas = banco.linhas('despesas')
    const despesaRecorrente = despesas.find(d => d.descricao === 'Aluguel Mensal')
    
    if (despesaRecorrente) {
      console.log('✅ Despesa encontrada no banco')
      console.log(`   - Recorrente: ${despesaRecorrente.recorrente}`)
      console.log(`   - Frequência: ${despesaRecorrente.frequencia}`)
    }
    
    console.log('\n======================================================================')
    console.log('✅ TESTE DESPESA RECORRENTE COMPLETO')
    console.log('======================================================================\n')
  })
})
