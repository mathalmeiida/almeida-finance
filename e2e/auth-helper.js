// Helper para autenticacao reutilizavel em testes
// Suporta login manual supervisionado + persistencia de sessao

import fs from 'fs'
import path from 'path'

const AUTH_STATE_FILE = 'playwright/.auth/user.json'
const AUTH_CREDENTIALS_FILE = 'playwright/.auth/credentials.json'

/**
 * Configurar autenticacao para testes
 * Primeira vez: solicita login manual e salva sessao
 * Execucoes seguintes: reutiliza sessao salva
 */
export async function setupAuth(page, baseURL) {
  // Criar diretorio se nao existir
  const authDir = path.dirname(AUTH_STATE_FILE)
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }

  // Verificar se ja temos estado de autenticacao salvo
  if (fs.existsSync(AUTH_STATE_FILE)) {
    console.log('✅ Sessao autenticada encontrada, restaurando...')
    
    try {
      const authState = JSON.parse(fs.readFileSync(AUTH_STATE_FILE, 'utf8'))
      
      // Restaurar cookies e localStorage
      if (authState.cookies) {
        await page.context().addCookies(authState.cookies)
      }
      
      if (authState.localStorage) {
        await page.goto(baseURL)
        await page.evaluate((items) => {
          for (const [key, value] of Object.entries(items)) {
            localStorage.setItem(key, value)
          }
        }, authState.localStorage)
      }
      
      // Verificar se sessao ainda e valida
      await page.goto(baseURL)
      await page.waitForTimeout(2000)
      
      // Se nao redirecionou para login, sessao e valida
      const isLoggedIn = !page.url().includes('/login') && !page.url().includes('/cadastro')
      
      if (isLoggedIn) {
        console.log('✅ Sessao autenticada valida!')
        return true
      } else {
        console.log('⚠️  Sessao expirada, necessario fazer login novamente')
        fs.unlinkSync(AUTH_STATE_FILE)
      }
    } catch (error) {
      console.log('⚠️  Erro ao restaurar sessao:', error.message)
      if (fs.existsSync(AUTH_STATE_FILE)) {
        fs.unlinkSync(AUTH_STATE_FILE)
      }
    }
  }

  // Sem sessao salva ou sessao invalida: solicitar login manual supervisionado
  console.log('')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  🔐 LOGIN MANUAL NECESSARIO')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('')
  console.log('INSTRUCOES:')
  console.log('1. Uma janela do navegador sera aberta')
  console.log('2. Faca login manualmente com suas credenciais de TESTE')
  console.log('3. Aguarde ser redirecionado para a Home/Dashboard')
  console.log('4. A sessao sera salva automaticamente para proximos testes')
  console.log('')
  console.log('IMPORTANTE:')
  console.log('- Use APENAS credenciais de teste isoladas')
  console.log('- NAO use usuario com dados financeiros reais')
  console.log('- A sessao ficara salva em: playwright/.auth/user.json')
  console.log('')
  console.log('Aguardando login...')
  console.log('')

  // Abrir pagina de login com headed mode (visivel)
  await page.goto(baseURL)
  
  // Aguardar usuario fazer login e ser redirecionado
  await page.waitForFunction(
    () => {
      const url = window.location.href
      return !url.includes('/login') && 
             !url.includes('/cadastro') && 
             !url.includes('/auth/')
    },
    { timeout: 300000 } // 5 minutos para login manual
  )

  console.log('✅ Login detectado!')
  console.log('💾 Salvando sessao autenticada...')

  // Aguardar carregamento completo
  await page.waitForTimeout(3000)

  // Salvar estado de autenticacao
  const cookies = await page.context().cookies()
  const localStorage = await page.evaluate(() => {
    const items = {}
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      items[key] = window.localStorage.getItem(key)
    }
    return items
  })

  const authState = {
    cookies,
    localStorage,
    savedAt: new Date().toISOString()
  }

  fs.writeFileSync(AUTH_STATE_FILE, JSON.stringify(authState, null, 2))
  
  console.log('✅ Sessao salva com sucesso!')
  console.log('')
  console.log('Proximas execucoes reutilizarao esta sessao automaticamente.')
  console.log('')

  return true
}

/**
 * Limpar sessao salva (forcar novo login)
 */
export function clearAuth() {
  if (fs.existsSync(AUTH_STATE_FILE)) {
    fs.unlinkSync(AUTH_STATE_FILE)
    console.log('🗑️  Sessao autenticada removida')
  }
  if (fs.existsSync(AUTH_CREDENTIALS_FILE)) {
    fs.unlinkSync(AUTH_CREDENTIALS_FILE)
    console.log('🗑️  Credenciais removidas')
  }
}

/**
 * Verificar se usuario esta autenticado
 */
export async function isAuthenticated(page) {
  const url = page.url()
  return !url.includes('/login') && 
         !url.includes('/cadastro') && 
         !url.includes('/auth/')
}
