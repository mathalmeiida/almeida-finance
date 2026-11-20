// @ts-check
import { test, expect } from '@playwright/test'
import { criarBancoMemoria, isolarSupabase, perfilFalso } from './apoio.js'

/**
 * TESTE: DASHBOARD - PROJEÇÃO DO PRÓXIMO MÊS
 * Investiga bug: "Compromissos previstos" mostra R$ 0,00 quando deveria
 * mostrar despesas recorrentes + parcelas + faturas do próximo mês.
 */

test.describe('Dashboard - Projeção', () => {
  test('Deve exibir despesas recorrentes no próximo mês', async ({ page }) => {
    const banco = criarBancoMemoria()
    
    await isolarSupabase(page, {
      autenticado: true,
      perfil: perfilFalso({
        onboarding_concluido: true,
        nome: 'Teste Dashboard',
        saldo_base: 500000
      }),
      banco
    })

    console.log('\n======================================================================')
    console.log('TESTE: DASHBOARD - PROJEÇÃO DO PRÓXIMO MÊS')
    console.log('======================================================================\n')

    // ═══════════════════════════════════════════════════════════════
    // PASSO 1: Criar despesa recorrente mensal
    // ═══════════════════════════════════════════════════════════════
    console.log('=== PASSO 1: Criar Despesa Recorrente ===')
    await page.goto('/despesas')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    const btnNova = page.locator('button').filter({ hasText: /Nova despesa/i }).first()
    await btnNova.click()
    await page.waitForTimeout(800)
    
    const modal = page.locator('[role="dialog"]')
    await modal.waitFor({ state: 'visible', timeout: 5000 })
    
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
    
    const btnSalvar = modal.locator('button[type="submit"]').first()
    await btnSalvar.click()
    await page.waitForTimeout(1500)
    console.log('✅ Despesa recorrente criada')
    
    // Verificar no banco
    const despesas = banco.linhas('despesas')
    const despesaRecorrente = despesas.find(d => d.descricao === 'Aluguel Mensal')
    console.log('\n📊 DADOS NO BANCO:')
    console.log(`   - ID: ${despesaRecorrente?.id}`)
    console.log(`   - Descrição: ${despesaRecorrente?.descricao}`)
    console.log(`   - Valor: ${despesaRecorrente?.valor}`)
    console.log(`   - Recorrente: ${despesaRecorrente?.recorrente}`)
    console.log(`   - Frequência: ${despesaRecorrente?.frequencia}`)
    console.log(`   - Data: ${despesaRecorrente?.data}`)

    // ═══════════════════════════════════════════════════════════════
    // PASSO 2: Navegar para Dashboard/Home
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 2: Navegar para Dashboard ===')
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000) // Aguardar hook calcular projeção
    console.log('✅ Dashboard carregado')

    // ═══════════════════════════════════════════════════════════════
    // PASSO 3: Verificar card "Resumo de [próximo mês]"
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 3: Verificar Projeção do Próximo Mês ===')
    
    const bodyText = await page.locator('body').textContent()
    
    // Procurar por "Resumo de [mês]" no card
    const textoResumo = bodyText.match(/Resumo de (\w+) \(próximo mês\)/i)
    if (textoResumo) {
      console.log(`✅ Card encontrado: "${textoResumo[0]}"`)
      console.log(`   Próximo mês: ${textoResumo[1]}`)
    } else {
      console.log('⚠️  Card "Resumo de [mês]" não encontrado')
    }
    
    // Procurar valores no card
    console.log('\n📊 VALORES EXIBIDOS NO CARD:')
    
    // Receitas previstas
    const receitasMatch = bodyText.match(/Receitas previstas[\s\S]{0,100}?(R\$\s*[\d.,]+|Nenhuma)/i)
    if (receitasMatch) {
      console.log(`   Receitas previstas: ${receitasMatch[1]}`)
    }
    
    // Compromissos previstos
    const compromissosMatch = bodyText.match(/Compromissos previstos[\s\S]{0,100}?(R\$\s*[\d.,]+|Nenhum)/i)
    if (compromissosMatch) {
      console.log(`   Compromissos previstos: ${compromissosMatch[1]}`)
      
      if (compromissosMatch[1].includes('R$ 0,00') || compromissosMatch[1] === 'Nenhum') {
        console.log('\n⚠️  🐛 BUG IDENTIFICADO:')
        console.log('   Compromissos previstos está R$ 0,00 ou "Nenhum"')
        console.log('   Mas temos despesa recorrente mensal de R$ 1.200,00')
        console.log('   Esperado: R$ 1.200,00 no próximo mês')
      }
    }
    
    // Reserva planejada
    const reservaMatch = bodyText.match(/Reserva planejada[\s\S]{0,100}?(R\$\s*[\d.,]+|Nenhuma)/i)
    if (reservaMatch) {
      console.log(`   Reserva planejada: ${reservaMatch[1]}`)
    }
    
    // Disponível para gastar
    const disponivelMatch = bodyText.match(/Disponível para gastar[\s\S]{0,100}?(R\$\s*[\d.,]+|-R\$\s*[\d.,]+)/i)
    if (disponivelMatch) {
      console.log(`   Disponível para gastar: ${disponivelMatch[1]}`)
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSO 4: Investigar array projecao no hook useProjecao
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 4: Investigar Hook useProjecao ===')
    
    // Adicionar script para logar dados da projeção
    const projecaoData = await page.evaluate(() => {
      // @ts-ignore - acessar dados do React DevTools
      const fibers = document.querySelectorAll('[data-reactroot]')
      return {
        temReactRoot: fibers.length > 0,
        // Tentar extrair dados do hook (não funciona sem React DevTools)
        info: 'Hook useProjecao não acessível via evaluate'
      }
    })
    
    console.log('ℹ️  Dados React:', JSON.stringify(projecaoData, null, 2))
    console.log('\n💡 PRÓXIMO PASSO: Adicionar console.log no código-fonte')
    console.log('   para debugar valores retornados por useProjecao()')

    // ═══════════════════════════════════════════════════════════════
    // PASSO 5: Dump completo do banco de dados mockado
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== PASSO 5: Dump Banco de Dados Mockado ===')
    
    const despesasTotal = banco.linhas('despesas')
    console.log(`\n📊 DESPESAS (${despesasTotal.length} registros):`)
    despesasTotal.forEach((d, idx) => {
      console.log(`\n   [${idx + 1}]`)
      console.log(`   ID: ${d.id}`)
      console.log(`   Descrição: ${d.descricao}`)
      console.log(`   Valor: ${d.valor}`)
      console.log(`   Data: ${d.data}`)
      console.log(`   Recorrente: ${d.recorrente}`)
      console.log(`   Frequência: ${d.frequencia || 'N/A'}`)
      console.log(`   Tipo: ${d.tipo_despesa || 'N/A'}`)
    })

    console.log('\n======================================================================')
    console.log('✅ TESTE DASHBOARD PROJEÇÃO COMPLETO')
    console.log('======================================================================\n')
  })
})
