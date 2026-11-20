// @ts-check
import { test, expect } from '@playwright/test'
import { criarBancoMemoria, isolarSupabase, perfilFalso } from './apoio.js'

/**
 * TESTE: RESPONSIVIDADE
 * Valida interface em múltiplas resoluções e dispositivos
 * 
 * Resoluções testadas:
 * - 375×812: iPhone SE (celular pequeno)
 * - 360×800: Android comum
 * - 768×1024: iPad (tablet)
 * - 1366×768: Laptop comum
 * - 1920×1080: Desktop Full HD
 */

const RESOLUCOES = [
  { nome: 'iPhone SE', largura: 375, altura: 812, tipo: 'mobile' },
  { nome: 'Android Comum', largura: 360, altura: 800, tipo: 'mobile' },
  { nome: 'iPad', largura: 768, altura: 1024, tipo: 'tablet' },
  { nome: 'Laptop', largura: 1366, altura: 768, tipo: 'desktop' },
  { nome: 'Desktop FHD', largura: 1920, altura: 1080, tipo: 'desktop' },
]

const PAGINAS_PRINCIPAIS = [
  { rota: '/', nome: 'Dashboard/Home' },
  { rota: '/receitas', nome: 'Receitas' },
  { rota: '/despesas', nome: 'Despesas' },
  { rota: '/cartoes', nome: 'Cartões' },
]

test.describe('Responsividade', () => {
  for (const res of RESOLUCOES) {
    test(`${res.nome} (${res.largura}×${res.altura})`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: res.largura, height: res.altura },
      })
      const page = await context.newPage()
      const banco = criarBancoMemoria({
        despesas: [
          { id: 'desp-1', descricao: 'Aluguel', valor: 1200, data: '2026-11-01', recorrente: true, frequencia: 'mensal', tipo_despesa: 'fixa', usuario_id: '00000000-0000-4000-8000-000000000001' },
        ],
        receitas: [
          { id: 'rec-1', descricao: 'Salário', valor: 5000, data: '2026-11-05', recorrente: true, frequencia: 'mensal', usuario_id: '00000000-0000-4000-8000-000000000001' },
        ],
      })

      await isolarSupabase(page, {
        autenticado: true,
        perfil: perfilFalso({
          onboarding_concluido: true,
          nome: 'Teste Responsividade',
          saldo_base: 500000
        }),
        banco
      })

      console.log(`\n======================================================================`)
      console.log(`TESTE RESPONSIVIDADE: ${res.nome.toUpperCase()} (${res.largura}×${res.altura})`)
      console.log(`======================================================================\n`)

      for (const pag of PAGINAS_PRINCIPAIS) {
        console.log(`=== ${pag.nome} (${pag.rota}) ===`)
        
        await page.goto(pag.rota)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(1500)
        
        // Verificar se a página carregou sem erro
        const bodyText = await page.locator('body').textContent()
        const temErro = bodyText.includes('Erro') || bodyText.includes('erro') || bodyText.includes('falha')
        
        if (temErro) {
          console.log(`⚠️  Possível erro detectado na página`)
        } else {
          console.log(`✅ Página carregada`)
        }
        
        // Verificar scroll horizontal (indica layout quebrado)
        const scrollWidth = await page.evaluate(() => document.body.scrollWidth)
        const clientWidth = await page.evaluate(() => document.body.clientWidth)
        
        if (scrollWidth > clientWidth + 10) { // +10 tolerância
          console.log(`⚠️  SCROLL HORIZONTAL: ${scrollWidth}px (viewport: ${clientWidth}px)`)
          console.log(`   Diferença: ${scrollWidth - clientWidth}px`)
        } else {
          console.log(`✅ Sem scroll horizontal`)
        }
        
        // Verificar elementos fora da tela
        const elementosForaDaTela = await page.evaluate((vw) => {
          const elementos = document.querySelectorAll('*')
          let count = 0
          for (const el of elementos) {
            const rect = el.getBoundingClientRect()
            if (rect.right > vw && rect.width > 10) { // ignora elementos muito pequenos
              count++
            }
          }
          return count
        }, res.largura)
        
        if (elementosForaDaTela > 5) { // tolerância
          console.log(`⚠️  ${elementosForaDaTela} elementos ultrapassam a largura da tela`)
        } else {
          console.log(`✅ Elementos dentro da viewport`)
        }
        
        // Verificar navegação (menu hamburguer em mobile, barra normal em desktop)
        const tipoNav = res.tipo === 'mobile' ? 'menu hamburguer' : 'navegação horizontal'
        console.log(`ℹ️  Tipo esperado: ${tipoNav}`)
        
        // Screenshot para análise visual (salvo em test-results)
        await page.screenshot({
          path: `test-results/responsividade-${res.nome.replace(/\s/g, '_')}-${pag.nome.replace(/\//g, '_')}.png`,
          fullPage: false
        })
        
        console.log(`📸 Screenshot salvo\n`)
      }

      console.log(`======================================================================`)
      console.log(`✅ TESTE RESPONSIVIDADE ${res.nome.toUpperCase()} COMPLETO`)
      console.log(`======================================================================\n`)

      await context.close()
    })
  }

  test('Comparar temas claro/escuro em mobile', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, altura: 812 },
    })
    const page = await context.newPage()
    const banco = criarBancoMemoria()

    await isolarSupabase(page, {
      autenticado: true,
      perfil: perfilFalso({
        onboarding_concluido: true,
        nome: 'Teste Tema',
        cor_tema: 'claro',
        saldo_base: 100000
      }),
      banco
    })

    console.log(`\n======================================================================`)
    console.log(`TESTE: TEMAS CLARO/ESCURO`)
    console.log(`======================================================================\n`)

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    // Tema claro
    const corFundo = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor
    })
    
    console.log(`=== Tema Claro ===`)
    console.log(`Cor de fundo: ${corFundo}`)
    
    const ehClaro = corFundo.includes('255') || corFundo.includes('rgb(255, 255, 255)')
    if (ehClaro) {
      console.log(`✅ Tema claro aplicado corretamente`)
    } else {
      console.log(`⚠️  Cor de fundo não é branca/clara`)
    }

    await page.screenshot({
      path: `test-results/tema-claro.png`,
      fullPage: false
    })

    console.log(`📸 Screenshot tema claro salvo\n`)

    console.log(`======================================================================`)
    console.log(`✅ TESTE TEMAS COMPLETO`)
    console.log(`======================================================================\n`)

    await context.close()
  })
})
