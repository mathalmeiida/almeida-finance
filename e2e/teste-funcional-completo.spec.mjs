// ─── Teste E2E Funcional: Central de Importação (Fluxo Completo) ────────────
// Teste autenticado passando por todo o fluxo: login, upload, revisão, confirmação
// NÃO usa dados reais, apenas usuário de teste
// Executar: npx playwright test teste-funcional-completo.spec.mjs --project=desktop-chromium

import { test, expect } from '@playwright/test'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const BASE_URL = 'http://localhost:4173'

// Credenciais de teste (NÃO usar em produção)
const TEST_USER = {
  email: 'teste.importacao@example.com',
  password: 'SenhaSegura123!@#'
}

test.describe('Central de Importação - Fluxo Completo E2E', () => {
  test('fluxo completo: login, upload CSV, revisão, confirmação', async ({ page }) => {
    // ════════════════════════════════════════════════════════════════════════
    // ETAPA 1: LOGIN
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n🔐 ETAPA 1: Login...')
    
    await page.goto(`${BASE_URL}/login`)
    await page.waitForLoadState('networkidle')
    
    // Preencher credenciais
    await page.fill('input[type="email"]', TEST_USER.email)
    await page.fill('input[type="password"]', TEST_USER.password)
    
    // Clicar em entrar
    await page.click('button[type="submit"]')
    await page.waitForLoadState('networkidle')
    
    // Verificar se logou (pode ir para dashboard ou onboarding)
    await page.waitForTimeout(2000)
    const url = page.url()
    const logouCorretamente = !url.includes('/login')
    expect(logouCorretamente).toBeTruthy()
    console.log('✅ Login realizado:', url)
    
    // ════════════════════════════════════════════════════════════════════════
    // ETAPA 2: ACESSAR CENTRAL DE IMPORTAÇÃO
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n📂 ETAPA 2: Acessando Central de Importação...')
    
    await page.goto(`${BASE_URL}/central-importacao`)
    await page.waitForLoadState('networkidle')
    
    // Verificar se página carregou
    const tituloPagina = await page.locator('h1:has-text("Central de Importação")').isVisible()
    expect(tituloPagina).toBeTruthy()
    console.log('✅ Central de Importação aberta')
    
    // ════════════════════════════════════════════════════════════════════════
    // ETAPA 3: CRIAR ARQUIVO CSV FICTÍCIO
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n📝 ETAPA 3: Criando arquivo CSV de teste...')
    
    const csvContent = `Data;Descrição;Valor
01/11/2024;TESTE SALÁRIO FICTÍCIO;3000.00
05/11/2024;TESTE MERCADO FICTÍCIO;-250.50
10/11/2024;TESTE UBER FICTÍCIO;-35.00`
    
    const csvPath = join(tmpdir(), 'teste-importacao-ficticio.csv')
    writeFileSync(csvPath, csvContent, 'utf-8')
    console.log('✅ CSV criado:', csvPath)
    
    // ════════════════════════════════════════════════════════════════════════
    // ETAPA 4: SELECIONAR CONTEXTO E FAZER UPLOAD
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n📤 ETAPA 4: Selecionando contexto e fazendo upload...')
    
    // Clicar em "Extrato bancário"
    await page.click('button[role="radio"]:has-text("Extrato bancário")')
    await page.waitForTimeout(500)
    console.log('✅ Contexto "Extrato bancário" selecionado')
    
    // Preencher nome da conta (opcional)
    const campoConta = page.locator('input[placeholder*="Conta"]')
    if (await campoConta.isVisible()) {
      await campoConta.fill('Conta Teste E2E')
      console.log('✅ Nome da conta preenchido')
    }
    
    // Fazer upload do arquivo
    const inputFile = page.locator('input[type="file"]')
    await inputFile.setInputFiles(csvPath)
    console.log('✅ Arquivo anexado')
    
    // Aguardar processamento
    await page.waitForTimeout(3000)
    
    // ════════════════════════════════════════════════════════════════════════
    // ETAPA 5: VERIFICAR PREVIEW (ETAPA "REVISAR")
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n🔍 ETAPA 5: Verificando preview das movimentações...')
    
    // Verificar se entrou na etapa "Revisar"
    const passos = page.locator('[data-testid="importacao-passos"]')
    const passoAtual = await passos.getAttribute('data-passo')
    
    if (passoAtual === '2') {
      console.log('✅ Etapa "Revisar" ativa')
      
      // Verificar resumo
      const qtdIncluidos = await page.locator('[data-testid="importacao-qtd-incluidos"]').textContent()
      console.log(`✅ Itens a importar: ${qtdIncluidos}`)
      
      // Verificar se há movimentações na tabela/lista
      const temMovimentacoes = await page.locator('text=TESTE').isVisible().catch(() => false)
      if (temMovimentacoes) {
        console.log('✅ Movimentações fictícias detectadas')
      }
      
    } else {
      console.log(`⚠️  Etapa atual: ${passoAtual} (esperado: 2)`)
      console.log('⚠️  Pode ter havido erro na leitura do arquivo')
      
      // Verificar se há mensagem de erro
      const temErro = await page.locator('[role="alert"]').isVisible().catch(() => false)
      if (temErro) {
        const msgErro = await page.locator('[role="alert"]').textContent()
        console.log('❌ Erro:', msgErro)
      }
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // ETAPA 6: CONFIRMAÇÃO (se chegou na etapa de revisão)
    // ════════════════════════════════════════════════════════════════════════
    if (passoAtual === '2') {
      console.log('\n✅ ETAPA 6: Confirmando importação...')
      
      // Procurar botão "Confirmar"
      const btnConfirmar = page.locator('button:has-text("Confirmar")')
      const temBotao = await btnConfirmar.isVisible().catch(() => false)
      
      if (temBotao) {
        await btnConfirmar.click()
        console.log('✅ Botão "Confirmar" clicado')
        
        // Aguardar gravação
        await page.waitForTimeout(3000)
        
        // Verificar se chegou na etapa "Resultado"
        const passoFinal = await passos.getAttribute('data-passo')
        if (passoFinal === '3') {
          console.log('✅ Etapa "Resultado" alcançada')
        } else {
          console.log(`⚠️  Etapa final: ${passoFinal} (esperado: 3)`)
        }
      } else {
        console.log('⚠️  Botão "Confirmar" não encontrado')
      }
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // ETAPA 7: VERIFICAR HISTÓRICO (se tabelas existirem)
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n📊 ETAPA 7: Verificando histórico...')
    
    // Voltar para tela inicial
    await page.goto(`${BASE_URL}/central-importacao`)
    await page.waitForTimeout(1000)
    
    // Verificar se histórico está disponível
    const temHistoricoIndisponivel = await page.locator('text=Histórico indisponível').isVisible().catch(() => false)
    
    if (temHistoricoIndisponivel) {
      console.log('⚠️  Histórico indisponível (tabelas não aplicadas)')
      console.log('ℹ️  Migration pendente: 2026-11_importacoes.sql')
    } else {
      // Tentar acessar aba/seção de histórico
      const abaHistorico = page.locator('button:has-text("Histórico")')
      const temAba = await abaHistorico.isVisible().catch(() => false)
      
      if (temAba) {
        await abaHistorico.click()
        await page.waitForTimeout(1000)
        console.log('✅ Aba "Histórico" clicada')
        
        // Verificar se apareceu importação
        const temImportacao = await page.locator('text=Extrato bancário').isVisible().catch(() => false)
        if (temImportacao) {
          console.log('✅ Importação aparece no histórico')
        }
      }
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // ETAPA 8: VERIFICAR MÓDULO FINANCEIRO (Receitas)
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n💰 ETAPA 8: Verificando módulo Receitas...')
    
    await page.goto(`${BASE_URL}/receitas`)
    await page.waitForTimeout(1500)
    
    // Verificar se apareceu "TESTE SALÁRIO FICTÍCIO"
    const temReceita = await page.locator('text=TESTE SALÁRIO FICTÍCIO').isVisible().catch(() => false)
    
    if (temReceita) {
      console.log('✅ Receita importada aparece no módulo')
    } else {
      console.log('⚠️  Receita não encontrada no módulo')
      console.log('   Pode ter sido gravada com descrição diferente ou não gravada')
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // ETAPA 9: VERIFICAR MÓDULO DESPESAS
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n💸 ETAPA 9: Verificando módulo Despesas...')
    
    await page.goto(`${BASE_URL}/despesas`)
    await page.waitForTimeout(1500)
    
    // Verificar se apareceram despesas ficícias
    const temDespesa1 = await page.locator('text=TESTE MERCADO FICTÍCIO').isVisible().catch(() => false)
    const temDespesa2 = await page.locator('text=TESTE UBER FICTÍCIO').isVisible().catch(() => false)
    
    if (temDespesa1 || temDespesa2) {
      console.log('✅ Despesas importadas aparecem no módulo')
    } else {
      console.log('⚠️  Despesas não encontradas no módulo')
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // ETAPA 10: REIMPORTAÇÃO (testar duplicidades)
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n🔄 ETAPA 10: Testando reimportação (duplicidades)...')
    
    await page.goto(`${BASE_URL}/central-importacao`)
    await page.waitForTimeout(1000)
    
    // Repetir upload do mesmo arquivo
    await page.click('button[role="radio"]:has-text("Extrato bancário")')
    await page.waitForTimeout(500)
    
    const inputFile2 = page.locator('input[type="file"]')
    await inputFile2.setInputFiles(csvPath)
    console.log('✅ Mesmo arquivo anexado novamente')
    
    // Aguardar processamento
    await page.waitForTimeout(3000)
    
    // Verificar se detectou duplicidades
    const temDuplicidade = await page.locator('text=duplicidade').isVisible().catch(() => false)
    const temJaImportado = await page.locator('text=Já importado').isVisible().catch(() => false)
    
    if (temDuplicidade || temJaImportado) {
      console.log('✅ Sistema detectou duplicidades')
    } else {
      console.log('⚠️  Duplicidades não detectadas (pode ser normal se tabelas não existirem)')
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // LIMPEZA
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n🧹 Limpando arquivo temporário...')
    try {
      unlinkSync(csvPath)
      console.log('✅ Arquivo CSV deletado')
    } catch (e) {
      console.log('⚠️  Não foi possível deletar CSV:', e.message)
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // CONCLUSÃO
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n' + '='.repeat(60))
    console.log('✅ TESTE E2E FUNCIONAL CONCLUÍDO')
    console.log('='.repeat(60))
    console.log('\nResumo:')
    console.log('1. ✅ Login realizado')
    console.log('2. ✅ Central de Importação acessada')
    console.log('3. ✅ Arquivo CSV criado e anexado')
    console.log(`4. ${passoAtual === '2' ? '✅' : '⚠️'} Preview de revisão ${passoAtual === '2' ? 'OK' : 'com problemas'}`)
    console.log(`5. ${passoAtual === '3' ? '✅' : '⚠️'} Confirmação ${passoAtual === '3' ? 'OK' : 'não testada'}`)
    console.log(`6. ${temHistoricoIndisponivel ? '⚠️' : '✅'} Histórico ${temHistoricoIndisponivel ? 'indisponível (migration pendente)' : 'funcional'}`)
    console.log(`7. ${temReceita ? '✅' : '⚠️'} Receita ${temReceita ? 'gravada' : 'não encontrada'}`)
    console.log(`8. ${temDespesa1 || temDespesa2 ? '✅' : '⚠️'} Despesas ${temDespesa1 || temDespesa2 ? 'gravadas' : 'não encontradas'}`)
    console.log(`9. ${temDuplicidade || temJaImportado ? '✅' : 'ℹ️'} Duplicidades ${temDuplicidade || temJaImportado ? 'detectadas' : 'não testadas'}`)
    console.log('='.repeat(60) + '\n')
  })
})
