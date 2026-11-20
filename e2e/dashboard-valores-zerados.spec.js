// @ts-check
import { test } from '@playwright/test'
import { criarBancoMemoria, isolarSupabase, perfilFalso } from './apoio.js'

/**
 * TESTE: DASHBOARD - BUSCAR "DESPESAS R$ 0,00"
 * Objetivo: Encontrar exatamente onde está o texto "Despesas R$ 0,00"
 * quando há despesas cadastradas no banco.
 */

test.describe('Dashboard - Valores Zerados', () => {
  test('Buscar origem de "Despesas R$ 0,00" com dados no banco', async ({ page }) => {
    const banco = criarBancoMemoria({
      despesas: [
        {
          id: 'desp-1',
          descricao: 'Aluguel Mensal',
          valor: 1200,
          data: '2026-11-05',
          recorrente: true,
          frequencia: 'mensal',
          tipo_despesa: 'fixa',
          usuario_id: '00000000-0000-4000-8000-000000000001'
        },
        {
          id: 'desp-2',
          descricao: 'Supermercado',
          valor: 350,
          data: '2026-11-10',
          recorrente: false,
          tipo_despesa: 'variavel',
          usuario_id: '00000000-0000-4000-8000-000000000001'
        },
      ],
      receitas: [
        {
          id: 'rec-1',
          descricao: 'Salário',
          valor: 5000,
          data: '2026-11-05',
          recorrente: true,
          frequencia: 'mensal',
          usuario_id: '00000000-0000-4000-8000-000000000001'
        },
      ],
    })

    await isolarSupabase(page, {
      autenticado: true,
      perfil: perfilFalso({
        onboarding_concluido: true,
        nome: 'Teste Dashboard Zerado',
        saldo_base: 500000, // R$ 5.000,00
        saldo_base_data: '2026-11-01',
      }),
      banco
    })

    console.log('\n======================================================================')
    console.log('TESTE: DASHBOARD - BUSCAR "DESPESAS R$ 0,00"')
    console.log('======================================================================\n')

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000) // Aguardar todos os cálculos

    console.log('=== PASSO 1: Dump do banco de dados ===')
    const despesas = banco.linhas('despesas')
    const receitas = banco.linhas('receitas')
    
    console.log(`\n📊 DESPESAS (${despesas.length} registros):`)
    despesas.forEach((d, idx) => {
      console.log(`   [${idx + 1}] ${d.descricao}: R$ ${d.valor} (${d.data}) - ${d.recorrente ? 'Recorrente' : 'Única'}`)
    })
    
    console.log(`\n📊 RECEITAS (${receitas.length} registros):`)
    receitas.forEach((r, idx) => {
      console.log(`   [${idx + 1}] ${r.descricao}: R$ ${r.valor} (${r.data}) - ${r.recorrente ? 'Recorrente' : 'Única'}`)
    })

    console.log('\n=== PASSO 2: Buscar todas ocorrências de "R$ 0,00" ===\n')
    
    // Buscar todos elementos que contêm "R$ 0,00"
    const elementosZerados = await page.locator('*').evaluateAll((elements) => {
      const resultados = []
      for (const el of elements) {
        const texto = el.textContent || ''
        if (texto.includes('R$ 0,00') || texto.includes('R$0,00') || texto.includes('R$ 0') || texto.includes('0,00')) {
          // Pegar contexto (label anterior ou título do card)
          let contexto = el.textContent?.substring(0, 100) || ''
          
          // Tentar encontrar label/título acima
          let parent = el.parentElement
          let tentativas = 0
          while (parent && tentativas < 5) {
            const parentText = parent.textContent || ''
            if (parentText.includes('Despesas') || parentText.includes('despesas') ||
                parentText.includes('Compromissos') || parentText.includes('compromissos') ||
                parentText.includes('Receitas') || parentText.includes('receitas') ||
                parentText.includes('Saldo') || parentText.includes('saldo') ||
                parentText.includes('Disponível') || parentText.includes('disponível')) {
              contexto = parentText.substring(0, 150)
              break
            }
            parent = parent.parentElement
            tentativas++
          }
          
          resultados.push({
            tag: el.tagName,
            classe: el.className,
            contexto: contexto.replace(/\s+/g, ' ').trim()
          })
        }
      }
      return resultados
    })

    console.log(`🔍 Encontradas ${elementosZerados.length} ocorrências de valores zerados:\n`)
    
    elementosZerados.forEach((elem, idx) => {
      console.log(`[${idx + 1}] <${elem.tag}> classe="${elem.classe}"`)
      console.log(`    Contexto: "${elem.contexto}"`)
      console.log('')
    })

    console.log('\n=== PASSO 3: Buscar textos específicos ===\n')
    
    const termosBusca = [
      'Despesas previstas',
      'Compromissos previstos',
      'Despesas este mês',
      'Despesas do mês',
      'Total de despesas',
      'Gastos do mês',
      'Resumo de',
      'próximo mês'
    ]
    
    const bodyText = await page.locator('body').textContent()
    
    for (const termo of termosBusca) {
      if (bodyText.includes(termo)) {
        console.log(`✅ Encontrado: "${termo}"`)
        
        // Buscar o valor após o termo
        const regex = new RegExp(`${termo}[\\s\\S]{0,200}?(R\\$\\s*[\\d.,]+|Nenhum|Nenhuma)`, 'i')
        const match = bodyText.match(regex)
        if (match) {
          console.log(`   Valor: ${match[1]}`)
        }
      } else {
        console.log(`❌ Não encontrado: "${termo}"`)
      }
    }

    console.log('\n=== PASSO 4: Extrair estrutura de cards ===\n')
    
    const cards = await page.locator('.card, [class*="card"]').evaluateAll((elements) => {
      return elements.slice(0, 10).map(el => { // Limitar aos 10 primeiros cards
        const texto = (el.textContent || '').replace(/\s+/g, ' ').trim()
        return {
          classe: el.className,
          texto: texto.substring(0, 200) + (texto.length > 200 ? '...' : '')
        }
      })
    })
    
    console.log(`📦 Primeiros ${cards.length} cards encontrados:\n`)
    
    cards.forEach((card, idx) => {
      console.log(`[${idx + 1}] classe: "${card.classe}"`)
      console.log(`    Conteúdo: "${card.texto}"`)
      console.log('')
    })

    console.log('\n======================================================================')
    console.log('✅ TESTE DASHBOARD VALORES ZERADOS COMPLETO')
    console.log('======================================================================')
    console.log('\n💡 ANÁLISE:')
    console.log('   - Se encontrar "Despesas R$ 0,00" com dados no banco: BUG CONFIRMADO')
    console.log('   - Se encontrar "Compromissos previstos R$ 0,00": hook useProjecao')
    console.log('   - Se encontrar "Nenhum/Nenhuma": filtro incorreto ou data inválida')
    console.log('======================================================================\n')
  })
})
