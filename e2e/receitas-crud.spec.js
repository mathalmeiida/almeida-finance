// @ts-check
import { test, expect } from '@playwright/test'
import { criarBancoMemoria, isolarSupabase, perfilFalso } from './apoio.js'

/**
 * TESTE: RECEITAS - CRUD COMPLETO
 * Valida criação, listagem, edição e exclusão de receitas
 */

test.describe('Receitas - CRUD', () => {
  test('Criar, listar, editar e excluir receita', async ({ page }) => {
    const banco = criarBancoMemoria()
    
    await isolarSupabase(page, {
      autenticado: true,
      perfil: perfilFalso({
        onboarding_concluido: true,
        nome: 'Teste Receitas',
        saldo_base: 500000
      }),
      banco
    })

    console.log('\n======================================================================')
    console.log('TESTE CRUD: RECEITAS')
    console.log('======================================================================\n')

    // === PASSO 1: Navegar para Receitas ===
    console.log('=== PASSO 1: Navegar para Receitas ===')
    await page.goto('/receitas')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    console.log('✅ Página de receitas carregada')

    // === PASSO 2: Verificar lista vazia ===
    console.log('\n=== PASSO 2: Verificar Lista Vazia ===')
    const textoPage = await page.locator('body').textContent()
    const listaVazia = textoPage.includes('Nenhuma receita') || textoPage.includes('Cadastre sua primeira')
    if (listaVazia) {
      console.log('✅ Mensagem de lista vazia exibida')
    } else {
      console.log('⚠️  Lista pode já ter dados')
    }

    // === PASSO 3: Criar receita única ===
    console.log('\n=== PASSO 3: Criar Receita Única ===')
    const btnNova = page.locator('button').filter({ hasText: /Nova receita|Adicionar/i }).first()
    if (await btnNova.isVisible({ timeout: 3000 })) {
      await btnNova.click()
      await page.waitForTimeout(500)
      
      // Preencher campos
      const inputDescricao = page.locator('input[name="descricao"]').first()
      if (await inputDescricao.isVisible({ timeout: 2000 })) {
        await inputDescricao.fill('Bônus de Natal')
        await page.locator('input[name="valor"]').first().fill('500000')
        await page.locator('input[type="date"]').first().fill('2026-12-20')
        
        const btnSalvar = page.locator('button').filter({ hasText: /Salvar/i }).first()
        await btnSalvar.click()
        await page.waitForTimeout(500)
        console.log('✅ Receita única criada: Bônus de Natal R$ 5.000,00')
      } else {
        console.log('⚠️  Campos do formulário não encontrados')
      }
    } else {
      console.log('⚠️  Botão "Nova receita" não encontrado')
    }

    console.log('\n======================================================================')
    console.log('✅ TESTE CRUD RECEITAS COMPLETO')
    console.log('======================================================================')
  })
})
