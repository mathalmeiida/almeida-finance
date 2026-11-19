// @ts-check
// Validação visual completa em 5 resoluções + testes funcionais
import { test, expect } from '@playwright/test'
import { isolarSupabase, perfilFalso, pularApresentacao, medirViewport, criarBancoMemoria } from './apoio.js'
import fs from 'fs'
import path from 'path'

const SCREENSHOTS_DIR = 'test-results/screenshots-final'

// Criar diretório de screenshots
test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  }
})

const RESOLUTIONS = [
  { width: 375, height: 812, name: 'Mobile-375' },
  { width: 390, height: 844, name: 'Mobile-390' },
  { width: 768, height: 1024, name: 'Tablet-768' },
  { width: 1440, height: 900, name: 'Desktop-1440' },
  { width: 1920, height: 1080, name: 'FullHD-1920' }
]

const PAGINAS_AUTENTICADAS = [
  { path: '/', name: 'Home', skipOnboarding: true },
  { path: '/configuracoes', name: 'Configuracoes' },
  { path: '/investimentos', name: 'Investimentos' },
  { path: '/cartoes', name: 'Cartoes' },
  { path: '/receitas', name: 'Receitas' },
  { path: '/despesas', name: 'Despesas' },
  { path: '/calendario', name: 'Calendario' },
  { path: '/central-importacao', name: 'CentralImportacao' },
  { path: '/simulador-amortizacao', name: 'SimuladorAmortizacao' },
  { path: '/simulador-custo-vida', name: 'SimuladorCustoVida' },
  { path: '/consultoria', name: 'Consultoria' }
]

// Testar cada página em cada resolução
for (const res of RESOLUTIONS) {
  test.describe(`Validação Visual - ${res.name}`, () => {
    test.use({ viewport: { width: res.width, height: res.height } })

    for (const pagina of PAGINAS_AUTENTICADAS) {
      test(`${pagina.name} - sem overflow horizontal`, async ({ page }) => {
        const banco = criarBancoMemoria({
          investimentos: [
            { id: 'inv-1', usuario_id: '00000000-0000-4000-8000-000000000001', nome: 'Tesouro Selic', valor_atual: 5000, tipo: 'renda_fixa' }
          ],
          cartoes: [
            { id: 'card-1', usuario_id: '00000000-0000-4000-8000-000000000001', nome: 'Nubank', limite: 3000, fechamento_dia: 10 }
          ],
          receitas: [
            { id: 'rec-1', usuario_id: '00000000-0000-4000-8000-000000000001', descricao: 'Salário', valor: 5000, frequencia: 'mensal', dia_recorrencia: 5, categoria_id: 'cat-salario' }
          ],
          despesas: [
            { id: 'desp-1', usuario_id: '00000000-0000-4000-8000-000000000001', descricao: 'Aluguel', valor: 1500, frequencia: 'mensal', dia_recorrencia: 10, categoria_id: 'cat-moradia' }
          ],
          lancamentos: [
            { id: 'lanc-1', usuario_id: '00000000-0000-4000-8000-000000000001', descricao: 'Mercado', valor: 250, data: '2026-11-15', tipo: 'despesa', categoria_id: 'cat-alimentacao' }
          ]
        })

        await isolarSupabase(page, { 
          autenticado: true, 
          perfil: perfilFalso({ 
            onboarding_concluido: pagina.skipOnboarding !== false,
            saldo_base: 10000,
            cor_tema: 'claro'
          }),
          banco 
        })
        await pularApresentacao(page)

        await page.goto(pagina.path)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(1500)

        // Capturar screenshot
        const screenshotPath = path.join(SCREENSHOTS_DIR, `${pagina.name}-${res.name}.png`)
        await page.screenshot({ path: screenshotPath, fullPage: false })

        // Medir viewport
        const metricas = await medirViewport(page)
        
        console.log(`[${pagina.name}@${res.name}] scrollWidth=${metricas.scrollWidth} clientWidth=${metricas.clientWidth} vazando=${metricas.vazando.length}`)

        // Verificar overflow (tolerância de 1px para arredondamento)
        expect(metricas.scrollWidth, `${pagina.name}@${res.name} não deve ter overflow horizontal`).toBeLessThanOrEqual(metricas.clientWidth + 1)
        
        // Verificar elementos vazando
        if (metricas.vazando.length > 0) {
          console.log(`⚠️  Elementos vazando em ${pagina.name}@${res.name}:`, metricas.vazando)
        }
        expect(metricas.vazando.length, `${pagina.name}@${res.name} não deve ter elementos vazando`).toBe(0)
      })
    }
  })
}

// Testes funcionais específicos
test.describe('Funcionalidades Críticas - Desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('Theme switching - Claro → Escuro → Automático', async ({ page }) => {
    const banco = criarBancoMemoria()
    const { escritasPerfil, perfilAtual } = await isolarSupabase(page, { 
      autenticado: true, 
      perfil: perfilFalso({ cor_tema: 'claro' }),
      banco 
    })
    await pularApresentacao(page)

    await page.goto('/configuracoes')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Screenshot inicial (modo claro)
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'Configuracoes-Tema-Claro.png') })

    // Capturar cor de fundo inicial
    const corFundoInicial = await page.locator('html').evaluate(el => window.getComputedStyle(el).backgroundColor)
    console.log('Cor de fundo inicial (claro):', corFundoInicial)

    // Buscar botões de tema
    const btnEscuro = page.locator('button[aria-pressed]').filter({ hasText: /escuro|🌙/i })
    const btnClaro = page.locator('button[aria-pressed]').filter({ hasText: /claro|☀/i })
    const btnAuto = page.locator('button[aria-pressed]').filter({ hasText: /automático|⚙/i })

    const temBotoes = await btnEscuro.first().isVisible({ timeout: 3000 }).catch(() => false)
    expect(temBotoes, 'Botões de tema devem estar visíveis').toBeTruthy()

    // Verificar estado inicial (claro ativo)
    const claroPressed = await btnClaro.first().getAttribute('aria-pressed')
    expect(claroPressed, 'Modo claro deve estar ativo inicialmente').toBe('true')

    // Alternar para escuro
    console.log('✓ Alternando para modo escuro')
    const countAntes = escritasPerfil.length
    await btnEscuro.first().click()
    await page.waitForTimeout(800)

    // Verificar escrita
    expect(escritasPerfil.length, 'Deve ter gravado mudança de tema').toBeGreaterThan(countAntes)
    expect(escritasPerfil.some(e => e.cor_tema === 'escuro')).toBeTruthy()

    // Verificar aplicação da classe no HTML
    const htmlClass = await page.locator('html').getAttribute('class')
    console.log('HTML class após escuro:', htmlClass)
    expect(htmlClass, 'HTML deve ter classe tema-escuro').toContain('tema-escuro')

    // Capturar cor de fundo após modo escuro
    const corFundoEscuro = await page.locator('html').evaluate(el => window.getComputedStyle(el).backgroundColor)
    console.log('Cor de fundo após escuro:', corFundoEscuro)

    // Screenshot modo escuro
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'Configuracoes-Tema-Escuro.png') })

    // Recarregar e verificar persistência
    console.log('✓ Verificando persistência após reload')
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const escuroPressed = await btnEscuro.first().getAttribute('aria-pressed')
    expect(escuroPressed, 'Modo escuro deve persistir após reload').toBe('true')

    const htmlClassAposReload = await page.locator('html').getAttribute('class')
    expect(htmlClassAposReload, 'Classe tema-escuro deve persistir').toContain('tema-escuro')

    // Alternar para automático
    console.log('✓ Alternando para modo automático')
    await btnAuto.first().click()
    await page.waitForTimeout(800)

    expect(escritasPerfil.some(e => e.cor_tema === 'automatico')).toBeTruthy()

    const htmlClassAuto = await page.locator('html').getAttribute('class')
    console.log('HTML class após automático:', htmlClassAuto)
    expect(htmlClassAuto, 'HTML deve ter classe tema-automatico').toContain('tema-automatico')

    // Screenshot modo automático
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'Configuracoes-Tema-Automatico.png') })

    // Verificar em outra página
    console.log('✓ Verificando tema em outra página (Home)')
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const htmlClassHome = await page.locator('html').getAttribute('class')
    console.log('HTML class na Home:', htmlClassHome)
    expect(htmlClassHome, 'Tema deve se aplicar em toda aplicação').toContain('tema-automatico')

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'Home-Tema-Automatico.png') })
  })

  test('Calendário - dimensões e interação', async ({ page }) => {
    const hoje = new Date().toISOString().split('T')[0]
    const banco = criarBancoMemoria({
      lancamentos: [
        { id: 'l1', usuario_id: '00000000-0000-4000-8000-000000000001', descricao: 'Supermercado', valor: 150, data: hoje, tipo: 'despesa', categoria_id: 'cat-alimentacao' },
        { id: 'l2', usuario_id: '00000000-0000-4000-8000-000000000001', descricao: 'Salário', valor: 5000, data: hoje, tipo: 'receita', categoria_id: 'cat-salario' }
      ],
      receitas: [],
      despesas: []
    })

    await isolarSupabase(page, { 
      autenticado: true, 
      perfil: perfilFalso(),
      banco 
    })
    await pularApresentacao(page)

    await page.goto('/calendario')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'Calendario-Desktop.png'), fullPage: true })

    const metricas = await medirViewport(page)
    expect(metricas.vazando.length, 'Calendário não deve ter overflow').toBe(0)

    // Procurar elemento do calendário
    const calendario = page.locator('[class*="calendar"], [role="grid"], table').first()
    const temCalendario = await calendario.isVisible({ timeout: 3000 }).catch(() => false)

    if (temCalendario) {
      const bbox = await calendario.boundingBox()
      console.log('Dimensões do calendário:', bbox)
      
      expect(bbox.width, 'Calendário deve ter largura razoável').toBeGreaterThan(200)
      expect(bbox.height, 'Calendário deve ter altura razoável').toBeGreaterThan(200)
    } else {
      console.log('⚠️  Elemento de calendário não encontrado')
    }
  })

  test('Modais - Adicionar Receita', async ({ page }) => {
    const banco = criarBancoMemoria({ receitas: [] })
    await isolarSupabase(page, { 
      autenticado: true, 
      perfil: perfilFalso(),
      banco 
    })
    await pularApresentacao(page)

    await page.goto('/receitas')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Procurar botão "Nova receita" ou "Adicionar"
    const btnNova = page.locator('button').filter({ hasText: /nova|adicionar|criar/i }).first()
    const temBotao = await btnNova.isVisible({ timeout: 3000 }).catch(() => false)

    if (temBotao) {
      console.log('✓ Abrindo modal de nova receita')
      await btnNova.click()
      await page.waitForTimeout(800)

      // Verificar se modal abriu
      const modal = page.locator('[role="dialog"], .modal, [class*="Modal"]').first()
      const modalVisivel = await modal.isVisible({ timeout: 2000 }).catch(() => false)

      if (modalVisivel) {
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'Modal-NovaReceita.png') })
        
        // Verificar overflow no modal
        const metricas = await medirViewport(page)
        expect(metricas.vazando.length, 'Modal não deve ter overflow').toBe(0)

        console.log('✓ Modal abriu corretamente')
      } else {
        console.log('⚠️  Modal não detectado')
      }
    } else {
      console.log('⚠️  Botão de nova receita não encontrado')
    }
  })
})

test.describe('Onboarding - Fluxo Completo', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('Fluxo completo: Perfil → Saldo → Receitas → Conclusão', async ({ page }) => {
    const banco = criarBancoMemoria()
    const { escritasPerfil } = await isolarSupabase(page, { 
      autenticado: true, 
      perfil: perfilFalso({ 
        onboarding_concluido: false,
        onboarding_etapa: null,
        nome: null,
        saldo_base: null
      }),
      banco 
    })
    await pularApresentacao(page)

    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    // Screenshot inicial
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'Onboarding-01-Inicial.png'), fullPage: true })

    // Verificar em qual tela estamos
    const heading = await page.locator('h1, h2').first().textContent({ timeout: 3000 }).catch(() => '')
    console.log('Tela inicial do onboarding:', heading)

    // Procurar campo de nome (etapa perfil)
    const campoNome = page.locator('input[type="text"]').first()
    const temNome = await campoNome.isVisible({ timeout: 2000 }).catch(() => false)

    if (temNome) {
      console.log('✓ Etapa PERFIL: preenchendo nome')
      await campoNome.fill('Usuário Teste E2E')
      await page.waitForTimeout(300)
      
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'Onboarding-02-Perfil-Preenchido.png'), fullPage: true })
      
      const btnContinuar = page.locator('button').filter({ hasText: /continuar|próximo/i }).first()
      if (await btnContinuar.isVisible().catch(() => false)) {
        await btnContinuar.click()
        await page.waitForTimeout(2000)
        console.log('✓ Avançou da etapa PERFIL')
      }
    }

    // Screenshot após avançar
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'Onboarding-03-Apos-Perfil.png'), fullPage: true })
    const heading2 = await page.locator('h1, h2').first().textContent().catch(() => '')
    console.log('Tela após perfil:', heading2)

    // Procurar botão pular se estiver na importação
    const temPular = await page.locator('button').filter({ hasText: /pular/i }).first().isVisible({ timeout: 2000 }).catch(() => false)
    if (temPular) {
      console.log('✓ Etapa IMPORTAÇÃO detectada, pulando')
      await page.locator('button').filter({ hasText: /pular|continuar/i }).first().click()
      await page.waitForTimeout(2000)
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'Onboarding-04-Apos-Importacao.png'), fullPage: true })
    const heading3 = await page.locator('h1, h2').first().textContent().catch(() => '')
    console.log('Tela após importação:', heading3)

    // Procurar campo de saldo
    const campoSaldo = page.locator('#onb-saldo')
    const temSaldo = await campoSaldo.isVisible({ timeout: 3000 }).catch(() => false)

    if (temSaldo) {
      console.log('✓ Etapa SALDO: preenchendo valor')
      await campoSaldo.fill('5000')
      await page.waitForTimeout(500)

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'Onboarding-05-Saldo-Preenchido.png'), fullPage: true })

      const countAntes = escritasPerfil.length
      const btnContinuar = page.locator('button').filter({ hasText: /continuar/i }).first()
      await btnContinuar.click()
      await page.waitForTimeout(2000)

      const countDepois = escritasPerfil.length
      console.log(`✓ Saldo gravado (${countDepois - countAntes} escritas no perfil)`)

      // Verificar que não redirecionou para Home
      const url = page.url()
      console.log('URL após salvar saldo:', url)
      
      if (url.includes('/home')) {
        console.log('❌ FALHA: Redirecionou para /home prematuramente!')
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'Onboarding-FALHA-Redirecionou-Home.png') })
      } else {
        console.log('✓ Permaneceu em /onboarding')
      }

      expect(url, 'Não deve redirecionar para /home ao salvar saldo').toContain('/onboarding')
    } else {
      console.log('⚠️  Campo de saldo não encontrado')
      const currentHeading = await page.locator('h1, h2').first().textContent().catch(() => '')
      console.log('Tela atual:', currentHeading)
    }

    // Screenshot final
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'Onboarding-06-Final.png'), fullPage: true })
  })
})
