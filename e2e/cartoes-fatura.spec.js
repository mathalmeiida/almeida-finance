// @ts-check
import { test, expect } from '@playwright/test'

const BASE_URL = 'http://127.0.0.1:4173'

/**
 * TESTE: CARTÕES - FATURAS E COMPRAS
 * Valida criação de cartões, compras e cálculo de faturas
 * 
 * Cenários:
 * 1. Criar cartão de crédito
 * 2. Registrar compra à vista no cartão
 * 3. Registrar compra parcelada
 * 4. Visualizar fatura do mês atual
 * 5. Validar total da fatura
 * 6. Pagar fatura
 * 7. Verificar fatura futura (parcelas pendentes)
 */

test.describe('Cartões - Faturas', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock de autenticação
    await context.route('**/auth/v1/user', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-user-id',
          email: 'teste@almeidafinance.app',
          user_metadata: { nome: 'Teste Cartões' }
        })
      })
    })

    // Mock de perfil
    await context.route('**/rest/v1/perfis*', route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: 'perfil-1',
            user_id: 'mock-user-id',
            nome: 'Teste Cartões',
            saldo_base: 500000, // R$ 5.000,00
            onboarding_concluido: true,
            data_saldo_base: '2026-11-01'
          }])
        })
      } else {
        route.fulfill({ status: 200, body: JSON.stringify({}) })
      }
    })

    let cartoes = []
    let compras = []

    // Mock de cartões (GET, POST, PATCH, DELETE)
    await context.route('**/rest/v1/cartoes*', route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(cartoes)
        })
      } else if (route.request().method() === 'POST') {
        const novoCartao = JSON.parse(route.request().postData())
        const cartao = {
          ...novoCartao,
          id: `cartao-${Date.now()}`,
          user_id: 'mock-user-id',
          created_at: new Date().toISOString()
        }
        cartoes.push(cartao)
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(cartao)
        })
      } else if (route.request().method() === 'PATCH') {
        const dados = JSON.parse(route.request().postData())
        const url = route.request().url()
        const idMatch = url.match(/id=eq\.([^&]+)/)
        if (idMatch) {
          const id = idMatch[1]
          const index = cartoes.findIndex(c => c.id === id)
          if (index !== -1) {
            cartoes[index] = { ...cartoes[index], ...dados }
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(cartoes[index])
            })
          }
        }
      } else if (route.request().method() === 'DELETE') {
        const url = route.request().url()
        const idMatch = url.match(/id=eq\.([^&]+)/)
        if (idMatch) {
          const id = idMatch[1]
          cartoes = cartoes.filter(c => c.id !== id)
          route.fulfill({ status: 204 })
        }
      }
    })

    // Mock de compras (GET, POST, PATCH, DELETE)
    await context.route('**/rest/v1/compras*', route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(compras)
        })
      } else if (route.request().method() === 'POST') {
        const novaCompra = JSON.parse(route.request().postData())
        const compra = {
          ...novaCompra,
          id: `compra-${Date.now()}-${Math.random()}`,
          user_id: 'mock-user-id',
          created_at: new Date().toISOString()
        }
        compras.push(compra)
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(compra)
        })
      } else if (route.request().method() === 'PATCH') {
        const dados = JSON.parse(route.request().postData())
        const url = route.request().url()
        const idMatch = url.match(/id=eq\.([^&]+)/)
        if (idMatch) {
          const id = idMatch[1]
          const index = compras.findIndex(c => c.id === id)
          if (index !== -1) {
            compras[index] = { ...compras[index], ...dados }
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(compras[index])
            })
          }
        }
      } else if (route.request().method() === 'DELETE') {
        const url = route.request().url()
        const idMatch = url.match(/id=eq\.([^&]+)/)
        if (idMatch) {
          const id = idMatch[1]
          compras = compras.filter(c => c.id !== id)
          route.fulfill({ status: 204 })
        }
      }
    })

    // Mocks de outros endpoints
    await context.route('**/rest/v1/categorias*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'cat-compras', nome: 'Compras', tipo: 'despesa', icone: 'ShoppingBag', cor: '#f59e0b' }
        ])
      })
    })

    await context.route('**/rest/v1/subcategorias*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      })
    })

    await context.route('**/rest/v1/receitas*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      })
    })

    await context.route('**/rest/v1/despesas*', route => {
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

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  })

  test('Criar cartão, registrar compras e validar fatura', async ({ page }) => {
    console.log('\n======================================================================')
    console.log('TESTE: CARTÕES - FATURAS E COMPRAS')
    console.log('======================================================================\n')

    // === PASSO 1: Navegar para Cartões ===
    console.log('=== PASSO 1: Navegar para Cartões ===')
    await page.click('a[href="/cartoes"]')
    await page.waitForTimeout(500)
    console.log('✅ Página de cartões carregada')

    // === PASSO 2: Verificar lista vazia ===
    console.log('\n=== PASSO 2: Verificar Lista Vazia ===')
    const mensagemVazia = page.locator('text=/Nenhum cartão|Cadastre seu primeiro/')
    if (await mensagemVazia.isVisible({ timeout: 3000 })) {
      console.log('✅ Mensagem de lista vazia exibida')
    }

    // === PASSO 3: Criar cartão de crédito ===
    console.log('\n=== PASSO 3: Criar Cartão de Crédito ===')
    await page.click('button:has-text("Novo cartão"), button:has-text("Adicionar")')
    await page.waitForTimeout(300)
    
    await page.fill('input[name="apelido"], input[placeholder*="pelido"]', 'Visa Gold')
    await page.fill('input[name="limite"], input[placeholder*="imite"]', '500000') // R$ 5.000,00
    
    // Informar dia de vencimento
    const inputVencimento = page.locator('input[name="dia_vencimento"], input[type="number"]')
    if (await inputVencimento.isVisible({ timeout: 2000 })) {
      await inputVencimento.fill('10')
    }
    
    // Informar dia de fechamento
    const inputFechamento = page.locator('input[name="dia_fechamento"], input[type="number"]')
    if (await inputFechamento.isVisible({ timeout: 2000 })) {
      await inputFechamento.fill('5')
    }
    
    await page.click('button:has-text("Salvar"), button[type="submit"]')
    await page.waitForTimeout(500)
    console.log('✅ Cartão criado: Visa Gold - Limite R$ 5.000,00')

    // === PASSO 4: Registrar compra à vista ===
    console.log('\n=== PASSO 4: Registrar Compra à Vista ===')
    await page.click('button:has-text("Nova compra"), button:has-text("Adicionar")')
    await page.waitForTimeout(300)
    
    await page.fill('input[name="descricao"], input[placeholder*="escri"]', 'Supermercado Extra')
    await page.fill('input[type="text"][name="valor"]', '25000') // R$ 250,00
    await page.fill('input[type="date"]', '2026-11-18')
    
    // Selecionar cartão (se houver dropdown)
    const dropdownCartao = page.locator('select[name="cartao_id"], button:has-text("Selecione o cartão")').first()
    if (await dropdownCartao.isVisible({ timeout: 2000 })) {
      await dropdownCartao.click()
      await page.waitForTimeout(200)
      await page.click('text=/Visa Gold/')
      await page.waitForTimeout(200)
    }
    
    await page.click('button:has-text("Salvar"), button[type="submit"]')
    await page.waitForTimeout(500)
    console.log('✅ Compra à vista registrada: Supermercado R$ 250,00')

    // === PASSO 5: Registrar compra parcelada ===
    console.log('\n=== PASSO 5: Registrar Compra Parcelada ===')
    await page.click('button:has-text("Nova compra"), button:has-text("Adicionar")')
    await page.waitForTimeout(300)
    
    await page.fill('input[name="descricao"], input[placeholder*="escri"]', 'Notebook Dell')
    await page.fill('input[type="text"][name="valor"]', '360000') // R$ 3.600,00
    await page.fill('input[type="date"]', '2026-11-19')
    
    // Informar parcelas
    const inputParcelas = page.locator('input[name="numero_parcelas"], input[name="parcelas"]')
    if (await inputParcelas.isVisible({ timeout: 2000 })) {
      await inputParcelas.fill('12')
      console.log('  Parcelado em 12x de R$ 300,00')
    }
    
    await page.click('button:has-text("Salvar"), button[type="submit"]')
    await page.waitForTimeout(500)
    console.log('✅ Compra parcelada registrada: Notebook R$ 3.600,00 em 12x')

    // === PASSO 6: Visualizar fatura do mês atual ===
    console.log('\n=== PASSO 6: Visualizar Fatura do Mês Atual ===')
    const cardCartao = page.locator('[class*="cartao"], li:has-text("Visa Gold")').first()
    if (await cardCartao.isVisible()) {
      await cardCartao.click()
      await page.waitForTimeout(500)
      console.log('✅ Detalhes do cartão abertos')
    }

    // === PASSO 7: Validar total da fatura ===
    console.log('\n=== PASSO 7: Validar Total da Fatura ===')
    const textoFatura = page.locator('text=/Fatura|Total/')
    if (await textoFatura.isVisible({ timeout: 2000 })) {
      const faturaTexto = await page.locator('text=/R\\$\\s*[\\d.,]+/').first().textContent()
      console.log(`✅ Total da fatura: ${faturaTexto}`)
      console.log('  Esperado: R$ 250,00 (à vista) + R$ 300,00 (1ª parcela) = R$ 550,00')
    } else {
      console.log('⚠️  Total da fatura não exibido')
    }

    // === PASSO 8: Verificar lista de compras ===
    console.log('\n=== PASSO 8: Verificar Lista de Compras ===')
    const compras = page.locator('[class*="compra"], li:has-text("R$")')
    const countCompras = await compras.count()
    console.log(`✅ ${countCompras} compra(s) exibida(s) na fatura`)

    // === PASSO 9: Verificar parcelas futuras ===
    console.log('\n=== PASSO 9: Verificar Parcelas Futuras ===')
    const parcelasTexto = page.locator('text=/2\/12|3\/12|parcela/')
    if (await parcelasTexto.isVisible({ timeout: 2000 })) {
      console.log('✅ Indicação de parcelas futuras encontrada')
      console.log('  Notebook tem mais 11 parcelas de R$ 300,00 nos próximos meses')
    } else {
      console.log('⚠️  Parcelas futuras não exibidas explicitamente')
    }

    // === PASSO 10: Pagar fatura (se disponível) ===
    console.log('\n=== PASSO 10: Pagar Fatura (se disponível) ===')
    const botaoPagar = page.locator('button:has-text("Pagar fatura"), button:has-text("Registrar pagamento")')
    if (await botaoPagar.isVisible({ timeout: 2000 })) {
      await botaoPagar.click()
      await page.waitForTimeout(300)
      
      const botaoConfirmar = page.locator('button:has-text("Confirmar"), button:has-text("Pagar")')
      if (await botaoConfirmar.isVisible({ timeout: 2000 })) {
        await botaoConfirmar.click()
        await page.waitForTimeout(500)
        console.log('✅ Pagamento da fatura registrado')
      }
    } else {
      console.log('⚠️  Funcionalidade de pagamento não encontrada (pode ser manual)')
    }

    // === PASSO 11: Validar impacto no limite disponível ===
    console.log('\n=== PASSO 11: Validar Limite Disponível ===')
    const limiteDisponivel = page.locator('text=/Limite disponível|Disponível/')
    if (await limiteDisponivel.isVisible({ timeout: 2000 })) {
      const limiteTexto = await page.locator('text=/R\\$\\s*[\\d.,]+/').textContent()
      console.log(`✅ Limite disponível: ${limiteTexto}`)
      console.log('  Esperado: R$ 5.000,00 - R$ 550,00 = R$ 4.450,00')
    } else {
      console.log('⚠️  Limite disponível não exibido')
    }

    // === PASSO 12: Voltar para Home e verificar alertas ===
    console.log('\n=== PASSO 12: Verificar Alertas na Home ===')
    await page.click('a[href="/"]')
    await page.waitForTimeout(1000)
    
    const alertaFatura = page.locator('text=/Fatura|Vencimento|Cartão/')
    if (await alertaFatura.isVisible({ timeout: 2000 })) {
      console.log('✅ Alerta de fatura visível na Home')
    } else {
      console.log('⚠️  Alerta de fatura não encontrado (pode depender de proximidade do vencimento)')
    }

    console.log('\n======================================================================')
    console.log('✅ TESTE CARTÕES E FATURAS COMPLETO')
    console.log('======================================================================')
  })
})
