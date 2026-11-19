#!/usr/bin/env node
/**
 * Diagnóstico detalhado da autenticação Supabase
 * Captura resposta HTTP sem expor credenciais
 */

import { chromium } from 'playwright'

const BASE_URL = 'http://localhost:5173'
const SUPABASE_URL = 'https://ievccupeijzuzhomphwn.supabase.co'

async function diagnoseAuth() {
  console.log('🔍 DIAGNÓSTICO DE AUTENTICAÇÃO\n')
  console.log(`Ambiente: ${SUPABASE_URL}`)
  console.log(`App local: ${BASE_URL}\n`)
  
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()
  
  // Capturar requisições de autenticação
  const authRequests = []
  
  page.on('request', request => {
    const url = request.url()
    if (url.includes('supabase.co/auth/v1') || url.includes('token') || url.includes('sign')) {
      authRequests.push({
        method: request.method(),
        url: url.replace(/\?.*/, ''), // Remove query params
        headers: {
          'content-type': request.headers()['content-type']
        }
      })
    }
  })
  
  page.on('response', async response => {
    const url = response.url()
    if (url.includes('supabase.co/auth/v1')) {
      try {
        const status = response.status()
        const statusText = response.statusText()
        
        console.log(`\n📡 Resposta Supabase:`)
        console.log(`   Status: ${status} ${statusText}`)
        console.log(`   URL: ${url.replace(/\?.*/, '')}`)
        
        if (status >= 400) {
          const body = await response.json().catch(() => ({}))
          console.log(`   Erro: ${body.error || body.msg || body.message || 'Desconhecido'}`)
          console.log(`   Code: ${body.error_code || body.code || 'N/A'}`)
          
          if (body.error_description) {
            console.log(`   Descrição: ${body.error_description}`)
          }
          
          // Log completo para análise (sem dados sensíveis)
          console.log(`   Body completo: ${JSON.stringify(body)}`)
        } else if (status === 200) {
          console.log(`   ✅ Autenticação bem-sucedida`)
        }
      } catch (e) {
        console.log(`   ⚠️  Não foi possível ler resposta: ${e.message}`)
      }
    }
  })
  
  page.on('requestfailed', request => {
    if (request.url().includes('supabase.co/auth')) {
      console.log(`\n❌ Requisição falhou:`)
      console.log(`   URL: ${request.url().replace(/\?.*/, '')}`)
      console.log(`   Erro: ${request.failure()?.errorText || 'Desconhecido'}`)
    }
  })
  
  try {
    // Marcar apresentação como vista
    await page.goto(BASE_URL)
    await page.evaluate(() => {
      localStorage.setItem('almeida_apresentacao_publica_vista', '1')
    })
    
    console.log('\n1️⃣ Navegando para /login...')
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    
    const hasForm = await page.$('input[name="email"]')
    if (!hasForm) {
      throw new Error('Formulário não encontrado')
    }
    console.log('   ✅ Formulário de login encontrado')
    
    console.log('\n2️⃣ Preenchendo credenciais...')
    await page.fill('input[name="email"]', 'e2e.test@almeidafinance.local')
    await page.fill('input[name="senha"]', 'TestE2E2024!Secure')
    
    console.log('\n3️⃣ Submetendo formulário...')
    await page.click('button[type="submit"]')
    
    // Aguardar resposta da API
    await page.waitForTimeout(5000)
    
    const finalUrl = page.url()
    console.log(`\n4️⃣ URL final: ${finalUrl}`)
    
    // Verificar se há mensagem de erro na tela
    const errorElement = await page.$('.text-red-700, .text-red-600, [role="alert"]')
    if (errorElement) {
      const errorText = await errorElement.textContent()
      console.log(`\n❌ Mensagem de erro na UI: ${errorText.trim()}`)
    }
    
    if (finalUrl.includes('/login')) {
      console.log('\n❌ Login falhou - permaneceu em /login')
    } else if (finalUrl === `${BASE_URL}/` || finalUrl.includes('/onboarding')) {
      console.log('\n✅ Login bem-sucedido - redirecionado')
    }
    
    console.log('\n📊 Requisições capturadas:')
    authRequests.forEach((req, i) => {
      console.log(`   ${i + 1}. ${req.method} ${req.url}`)
    })
    
    await page.screenshot({ path: 'tests/screenshots/diagnose-final.png' })
    
    console.log('\n✅ Diagnóstico concluído')
    console.log('⏱️  Navegador permanecerá aberto por 15s para inspeção')
    await page.waitForTimeout(15000)
    
  } catch (error) {
    console.error('\n❌ Erro:', error.message)
    await page.screenshot({ path: 'tests/screenshots/diagnose-error.png' })
  } finally {
    await browser.close()
  }
}

diagnoseAuth()
