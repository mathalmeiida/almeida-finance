// Apoio aos testes E2E: isola o app do Supabase real.
// Intercepta TODO o tráfego para *.supabase.co. Rotas não previstas são
// abortadas, garantindo que nenhum teste leia ou grave dados reais.

const REF = 'ievccupeijzuzhomphwn' // usado só para montar a chave do localStorage do supabase-js
export const USUARIO_TESTE = { id: '00000000-0000-4000-8000-000000000001', email: 'teste@exemplo.invalid' }

function base64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function sessaoFalsa() {
  const agora = Math.floor(Date.now() / 1000)
  const payload = { sub: USUARIO_TESTE.id, email: USUARIO_TESTE.email, role: 'authenticated', aud: 'authenticated', exp: agora + 3600, iat: agora }
  const token = `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(payload)}.assinatura-falsa`
  return {
    access_token: token,
    refresh_token: 'refresh-falso',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: agora + 3600,
    user: { id: USUARIO_TESTE.id, email: USUARIO_TESTE.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { nome: 'Teste' } },
  }
}

export function perfilFalso(extra = {}) {
  return {
    id: USUARIO_TESTE.id,
    nome: 'Teste',
    email: USUARIO_TESTE.email,
    saldo_base: 1000,
    saldo_base_data: '2026-11-01',
    modo_limite: 'auto',
    limite_diario: null,
    reserva_percentual: 20,
    reserva_atual: 0,
    reserva_configurada: true,
    comece_por_aqui_dispensado: true,
    cor_tema: 'claro',
    papel: 'usuario',
    ativo: true,
    onboarding_concluido: true,
    ...extra,
  }
}

// Instala os mocks. Retorna um registro das escritas feitas em perfis.
export async function isolarSupabase(page, { autenticado = false, perfil = perfilFalso(), colunaAtalhosAusente = false } = {}) {
  const escritasPerfil = []
  let perfilAtual = { ...perfil }

  await page.route(/https:\/\/[^/]+\.supabase\.co\/.*/, async route => {
    const req = route.request()
    const url = new URL(req.url())
    const metodo = req.method()
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

    if (url.pathname.startsWith('/auth/v1/')) {
      if (url.pathname.endsWith('/user')) return autenticado ? json(sessaoFalsa().user) : json({ message: 'no session' }, 401)
      if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204 })
      return json({ message: 'bloqueado em teste' }, 400)
    }

    if (url.pathname.startsWith('/rest/v1/perfis')) {
      const objeto = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
      if (metodo === 'PATCH') {
        const corpo = req.postDataJSON()
        escritasPerfil.push(corpo)
        // Simula produção antes da migration: coluna ainda não existe.
        if (colunaAtalhosAusente && 'atalhos_home' in corpo) {
          return json({ code: 'PGRST204', message: "Could not find the 'atalhos_home' column of 'perfis'" }, 400)
        }
        perfilAtual = { ...perfilAtual, ...corpo }
      }
      return json(objeto ? perfilAtual : [perfilAtual])
    }

    if (url.pathname.startsWith('/rest/v1/rpc/')) return json(null)
    if (url.pathname.startsWith('/rest/v1/')) {
      if (metodo === 'GET' || metodo === 'HEAD') {
        const objeto = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
        return objeto ? json({ code: 'PGRST116', message: 'no rows' }, 406) : json([])
      }
      return json({ message: 'escrita bloqueada em teste' }, 403)
    }
    return route.abort()
  })

  if (autenticado) {
    const sessao = sessaoFalsa()
    await page.addInitScript(([chave, valor]) => {
      localStorage.setItem(chave, valor)
    }, [`sb-${REF}-auth-token`, JSON.stringify(sessao)])
  }

  return { escritasPerfil, perfilAtual: () => perfilAtual }
}

// Marca a apresentação pública como já vista (para testes que vão direto ao formulário).
export async function pularApresentacao(page) {
  await page.addInitScript(() => localStorage.setItem('almeida_apresentacao_publica_vista', '1'))
}

// Métricas de viewport/zoom usadas nos testes de layout.
export async function medirViewport(page) {
  return page.evaluate(() => {
    const vv = window.visualViewport
    const largura = document.documentElement.clientWidth
    const vazando = [...document.querySelectorAll('body *')]
      .filter(el => {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) return false
        // ignora conteúdo dentro de trilhos com rolagem horizontal própria
        let p = el.parentElement
        while (p) {
          const ox = getComputedStyle(p).overflowX
          if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return false
          p = p.parentElement
        }
        return r.right > largura + 1 || r.left < -1
      })
      .slice(0, 5)
      .map(el => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`)
    return {
      innerWidth: window.innerWidth,
      clientWidth: largura,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      escala: vv ? vv.scale : 1,
      vazando,
    }
  })
}
