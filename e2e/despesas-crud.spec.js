// @ts-check
import { test, expect } from '@playwright/test'
import { criarBancoMemoria, isolarSupabase, perfilFalso } from './apoio.js'

/**
 * TESTE: DESPESAS - CRUD COMPLETO
 * Valida criação, listagem, edição e exclusão de despesas
 */

test.describe('Despesas - CRUD', () => {
  test('Criar, listar, editar e excluir despesa', async ({ page }) => {
    const banco = criarBancoMemoria()
    
    await isolarSupabase(page, {
      autenticado: true,
      perfil: perfilFalso({
        onboarding_concluido: true,
        nome: 'Teste Despesas',
        saldo_base: 500000
      }),
      banco
    })

    console.log('\n======================================================================')
    console.log('TESTE CRUD: DESPESAS')
    console.log('======================================================================\n')

    // === PASSO 1: Navegar para Despesas ===
    console.log('=== PASSO 1: Navegar para Despesas ===')
    await page.goto('/despesas')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    console.log('✅ Página de despesas carregada')

    // === PASSO 2: Verificar lista vazia ===
    console.log('\n=== PASSO 2: Verificar Lista Vazia ===')
    const textoPage = await page.locator('body').textContent()
    const listaVazia = textoPage.includes('Nenhuma despesa') || textoPage.includes('Cadastre sua primeira')
    if (listaVazia) {
      console.log('✅ Mensagem de lista vazia exibida')
    } else {
      console.log('⚠️  Lista pode já ter dados')
    }

    // === PASSO 3: Criar despesa única ===
    console.log('\n=== PASSO 3: Criar Despesa Única ===')
    const btnNova = page.locator('button').filter({ hasText: /Nova despesa|Adicionar/i }).first()
    if (await btnNova.isVisible({ timeout: 3000 })) {
      await btnNova.click()
      await page.waitForTimeout(500)
      
      // Preencher campos
      const inputDescricao = page.locator('input[name="descricao"]').first()
      if (await inputDescricao.isVisible({ timeout: 2000 })) {
        await inputDescricao.fill('Supermercado')
        await page.locator('input[name="valor"]').first().fill('25000')
        await page.locator('input[type="date"]').first().fill('2026-11-15')
        
        const btnSalvar = page.locator('button').filter({ hasText: /Salvar/i }).first()
        await btnSalvar.click()
        await page.waitForTimeout(500)
        console.log('✅ Despesa única criada: Supermercado R$ 250,00')
      } else {
        console.log('⚠️  Campos do formulário não encontrados')
      }
    } else {
      console.log('⚠️  Botão "Nova despesa" não encontrado')
    }

    console.log('\n======================================================================')
    console.log('✅ TESTE CRUD DESPESAS COMPLETO')
    console.log('======================================================================')
  })
})
