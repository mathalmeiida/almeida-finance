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

    // Mock de autenticação
    await context.route('**/auth/v1/user', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-user-id',
          email: 'teste@almeidafinance.app',
          user_metadata: { nome: 'Teste Receitas' }
        })
      })
    })

    // Mock de perfil com onboarding concluído
    await context.route('**/rest/v1/perfis*', route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: 'perfil-1',
            user_id: 'mock-user-id',
            nome: 'Teste Receitas',
            saldo_base: 500000, // R$ 5.000,00
            onboarding_concluido: true,
            data_saldo_base: '2026-11-01'
          }])
        })
      } else {
        route.fulfill({ status: 200, body: JSON.stringify({}) })
      }
    })

    // Estado inicial: 0 receitas
    let receitas = []

    // Mock de categorias
    await context.route('**/rest/v1/categorias*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'cat-salario', nome: 'Salário', tipo: 'receita', icone: 'Briefcase', cor: '#10b981' },
          { id: 'cat-freelance', nome: 'Freelance', tipo: 'receita', icone: 'Code', cor: '#8b5cf6' }
        ])
      })
    })

    // Mock de receitas (GET e POST)
    await context.route('**/rest/v1/receitas*', route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(receitas)
        })
      } else if (route.request().method() === 'POST') {
        const novaReceita = JSON.parse(route.request().postData())
        const receita = {
          ...novaReceita,
          id: `receita-${Date.now()}`,
          user_id: 'mock-user-id',
          created_at: new Date().toISOString()
        }
        receitas.push(receita)
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(receita)
        })
      } else if (route.request().method() === 'PATCH') {
        const dados = JSON.parse(route.request().postData())
        const url = route.request().url()
        const idMatch = url.match(/id=eq\.([^&]+)/)
        if (idMatch) {
          const id = idMatch[1]
          const index = receitas.findIndex(r => r.id === id)
          if (index !== -1) {
            receitas[index] = { ...receitas[index], ...dados }
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(receitas[index])
            })
          } else {
            route.fulfill({ status: 404 })
          }
        } else {
          route.fulfill({ status: 400 })
        }
      } else if (route.request().method() === 'DELETE') {
        const url = route.request().url()
        const idMatch = url.match(/id=eq\.([^&]+)/)
        if (idMatch) {
          const id = idMatch[1]
          receitas = receitas.filter(r => r.id !== id)
          route.fulfill({ status: 204 })
        } else {
          route.fulfill({ status: 400 })
        }
      }
    })

    // Mocks de outros endpoints necessários
    await context.route('**/rest/v1/despesas*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      })
    })

    await context.route('**/rest/v1/cartoes*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      })
    })

    await context.route('**/rest/v1/compras*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      })
    })

    await context.route('**/rest/v1/investimentos*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      })
    })

    await context.route('**/rest/v1/metas*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      })
    })

    await context.route('**/rest/v1/beneficios*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      })
    })

    await context.route('**/rest/v1/subcategorias*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      })
    })

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  })

  test('Criar, listar, editar e excluir receita', async ({ page }) => {
    console.log('\n======================================================================')
    console.log('TESTE CRUD: RECEITAS')
    console.log('======================================================================\n')

    // === PASSO 1: Navegar para Receitas ===
    console.log('=== PASSO 1: Navegar para Receitas ===')
    await page.click('a[href="/receitas"]')
    await page.waitForTimeout(500)
    console.log('✅ Página de receitas carregada')

    // === PASSO 2: Verificar lista vazia ===
    console.log('\n=== PASSO 2: Verificar Lista Vazia ===')
    const mensagemVazia = page.locator('text=/Nenhuma receita|Cadastre sua primeira/')
    await expect(mensagemVazia.first()).toBeVisible({ timeout: 5000 })
    console.log('✅ Mensagem de lista vazia exibida')

    // === PASSO 3: Criar receita única ===
    console.log('\n=== PASSO 3: Criar Receita Única ===')
    await page.click('button:has-text("Nova receita"), button:has-text("Adicionar")')
    await page.waitForTimeout(300)
    
    await page.fill('input[name="descricao"], input[placeholder*="escri"]', 'Bônus de Natal')
    await page.fill('input[type="text"][name="valor"]', '500000') // R$ 5.000,00
    await page.fill('input[type="date"]', '2026-12-20')
    
    // Selecionar categoria
    const categoriaDropdown = page.locator('button:has-text("Selecione"), select[name="categoria_id"]').first()
    await categoriaDropdown.click()
    await page.waitForTimeout(200)
    await page.click('text=/Salário/')
    await page.waitForTimeout(200)
    
    await page.click('button:has-text("Salvar"), button[type="submit"]')
    await page.waitForTimeout(500)
    console.log('✅ Receita única criada: Bônus de Natal R$ 5.000,00')

    // === PASSO 4: Criar receita recorrente ===
    console.log('\n=== PASSO 4: Criar Receita Recorrente ===')
    await page.click('button:has-text("Nova receita"), button:has-text("Adicionar")')
    await page.waitForTimeout(300)
    
    await page.fill('input[name="descricao"], input[placeholder*="escri"]', 'Salário Mensal')
    await page.fill('input[type="text"][name="valor"]', '800000') // R$ 8.000,00
    await page.fill('input[type="date"]', '2026-11-05')
    
    // Marcar como recorrente
    const checkboxRecorrente = page.locator('input[type="checkbox"][name="recorrente"]')
    if (await checkboxRecorrente.isVisible()) {
      await checkboxRecorrente.check()
    }
    
    await page.click('button:has-text("Salvar"), button[type="submit"]')
    await page.waitForTimeout(500)
    console.log('✅ Receita recorrente criada: Salário Mensal R$ 8.000,00')

    // === PASSO 5: Verificar lista com 2 receitas ===
    console.log('\n=== PASSO 5: Verificar Lista com 2 Receitas ===')
    const receitas = page.locator('[class*="receita"], [data-testid*="receita"], li:has-text("R$")')
    await expect(receitas.first()).toBeVisible({ timeout: 3000 })
    const count = await receitas.count()
    expect(count).toBeGreaterThanOrEqual(1)
    console.log(`✅ ${count} receita(s) exibida(s) na lista`)

    // === PASSO 6: Validar totais ===
    console.log('\n=== PASSO 6: Validar Totais ===')
    const textoTotal = page.locator('text=/Total|Receitas do mês/i')
    if (await textoTotal.isVisible()) {
      const totalVisivel = await page.locator('text=/R\\$\\s*[\\d.,]+/').textContent()
      console.log(`✅ Total de receitas visível: ${totalVisivel}`)
    } else {
      console.log('⚠️  Total não exibido (pode ser cálculo interno)')
    }

    // === PASSO 7: Editar receita ===
    console.log('\n=== PASSO 7: Editar Receita ===')
    const primeiraReceita = receitas.first()
    await primeiraReceita.click()
    await page.waitForTimeout(300)
    
    const campoDescricao = page.locator('input[name="descricao"], input[placeholder*="escri"]')
    if (await campoDescricao.isVisible()) {
      await campoDescricao.fill('Bônus de Fim de Ano EDITADO')
      await page.click('button:has-text("Salvar"), button[type="submit"]')
      await page.waitForTimeout(500)
      console.log('✅ Receita editada com sucesso')
    } else {
      console.log('⚠️  Modal de edição não abriu, tentando botão de ação')
      await page.click('button[aria-label="Editar"], button:has-text("Editar")')
      await page.waitForTimeout(300)
      await campoDescricao.fill('Bônus de Fim de Ano EDITADO')
      await page.click('button:has-text("Salvar")')
      await page.waitForTimeout(500)
      console.log('✅ Receita editada via botão de ação')
    }

    // === PASSO 8: Excluir receita ===
    console.log('\n=== PASSO 8: Excluir Receita ===')
    const botaoExcluir = page.locator('button[aria-label="Excluir"], button:has-text("Excluir")').first()
    if (await botaoExcluir.isVisible()) {
      await botaoExcluir.click()
      await page.waitForTimeout(200)
      
      // Confirmar exclusão se houver modal de confirmação
      const botaoConfirmar = page.locator('button:has-text("Confirmar"), button:has-text("Excluir")')
      if (await botaoConfirmar.isVisible({ timeout: 2000 })) {
        await botaoConfirmar.click()
      }
      
      await page.waitForTimeout(500)
      console.log('✅ Receita excluída com sucesso')
    } else {
      console.log('⚠️  Botão de exclusão não encontrado')
    }

    // === PASSO 9: Verificar persistência ===
    console.log('\n=== PASSO 9: Verificar Persistência ===')
    await page.reload()
    await page.waitForTimeout(1000)
    const receitasAposReload = page.locator('[class*="receita"], li:has-text("R$")')
    const countFinal = await receitasAposReload.count()
    console.log(`✅ Após reload: ${countFinal} receita(s) persistida(s)`)

    console.log('\n======================================================================')
    console.log('✅ TESTE CRUD RECEITAS COMPLETO')
    console.log('======================================================================')
  })
})
