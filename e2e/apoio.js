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
// Banco em memória (opcional) para testar fluxos que gravam dados: suporta
// GET com filtros eq./in./is.null, POST, PATCH e DELETE por id. Registra cada
// escrita em `escritas` para verificar ausência de duplicidade.
export function criarBancoMemoria(inicial = {}) {
  const tabelas = {
    categorias: [
      { id: 'cat-moradia', usuario_id: null, nome: 'Moradia', icone: '🏠', cor: null, tipo: 'despesa' },
      { id: 'cat-alimentacao', usuario_id: null, nome: 'Alimentação', icone: '🍽️', cor: null, tipo: 'despesa' },
      { id: 'cat-salario', usuario_id: null, nome: 'Salário', icone: '💼', cor: null, tipo: 'receita' },
    ],
    ...JSON.parse(JSON.stringify(inicial)),
  }
  let seq = 1
  const escritas = []
  function filtrar(linhas, params) {
    return linhas.filter(l => {
      for (const [k, v] of params) {
        if (['select', 'order', 'limit', 'offset', 'or'].includes(k)) continue
        if (v.startsWith('eq.') && String(l[k]) !== v.slice(3)) return false
        if (v.startsWith('in.(')) { const op = v.slice(4, -1).split(','); if (!op.includes(String(l[k]))) return false }
        if (v === 'is.null' && l[k] != null) return false
        if (v.startsWith('gte.') && !(String(l[k] ?? '') >= v.slice(4))) return false
        if (v.startsWith('lte.') && !(String(l[k] ?? '') <= v.slice(4))) return false
        if (v.startsWith('gt.') && !(String(l[k] ?? '') > v.slice(3))) return false
        if (v.startsWith('lt.') && !(String(l[k] ?? '') < v.slice(3))) return false
      }
      return true
    })
  }
  return {
    tabelas,
    escritas,
    linhas: t => tabelas[t] || [],
    tratar(tabela, metodo, params, corpo) {
      const lista = (tabelas[tabela] ||= [])
      if (metodo === 'GET' || metodo === 'HEAD') return filtrar(lista, params)
      if (metodo === 'POST') {
        const novos = (Array.isArray(corpo) ? corpo : [corpo]).map(r => ({ id: `${tabela}-${seq++}`, criado_em: new Date().toISOString(), ...r }))
        lista.push(...novos)
        escritas.push({ tabela, metodo, corpo })
        return novos
      }
      const alvo = filtrar(lista, params)
      if (metodo === 'PATCH') {
        alvo.forEach(l => Object.assign(l, corpo))
        escritas.push({ tabela, metodo, corpo })
        return alvo
      }
      if (metodo === 'DELETE') {
        tabelas[tabela] = lista.filter(l => !alvo.includes(l))
        escritas.push({ tabela, metodo })
        return alvo
      }
      return []
    },
  }
}

// Extrai o arquivo de um corpo multipart (o supabase-js envia Blob como FormData).
function arquivoDoMultipart(buf, contentType) {
  const m = /boundary=(.+)$/.exec(contentType || '')
  if (!m) return buf
  const partes = buf.toString('latin1').split(`--${m[1]}`)
  const parte = partes.find(p => /Content-Type:\s*image\//i.test(p)) || partes.find(p => /filename=/i.test(p))
  if (!parte) return buf
  const corpo = parte.slice(parte.indexOf('\r\n\r\n') + 4).replace(/\r\n$/, '')
  return Buffer.from(corpo, 'latin1')
}

export async function isolarSupabase(page, { autenticado = false, perfil = perfilFalso(), colunaAtalhosAusente = false, colunasOnboardingAusentes = false, banco = null, storage = new Map(), falharStorage = false } = {}) {
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

    // Storage em memória (bucket privado 'avatares': só URLs assinadas).
    if (url.pathname.startsWith('/storage/v1/')) {
      if (falharStorage) return route.abort('internetdisconnected')
      const p = url.pathname.replace('/storage/v1/', '')
      const caminhoDe = prefixo => decodeURIComponent(p.slice(prefixo.length))
      if (p.startsWith('object/sign/avatares/')) {
        const caminho = caminhoDe('object/sign/avatares/')
        const obj = storage.get(caminho)
        if (metodo === 'POST') return obj ? json({ signedURL: `/object/sign/avatares/${encodeURI(caminho)}?token=teste` }) : json({ statusCode: '404', error: 'not_found', message: 'Object not found' }, 400)
        return obj ? route.fulfill({ status: 200, contentType: obj.tipo, body: obj.corpo }) : route.fulfill({ status: 404 })
      }
      if (p.startsWith('object/public/')) return json({ error: 'Bucket not found' }, 400) // bucket privado
      if (metodo === 'POST' && p.startsWith('object/avatares/')) {
        const caminho = caminhoDe('object/avatares/')
        if (!caminho.startsWith(`${USUARIO_TESTE.id}/`)) return json({ statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' }, 400)
        storage.set(caminho, { tipo: 'image/jpeg', corpo: arquivoDoMultipart(req.postDataBuffer(), req.headers()['content-type']) })
        return json({ Key: `avatares/${caminho}`, Id: caminho })
      }
      if (metodo === 'DELETE' && p === 'object/avatares') {
        for (const k of req.postDataJSON()?.prefixes || []) storage.delete(k)
        return json([])
      }
      return json({ message: 'não previsto' }, 400)
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
        if (colunasOnboardingAusentes && ('objetivos_financeiros' in corpo || 'onboarding_etapa' in corpo)) {
          return json({ code: 'PGRST204', message: "Could not find the 'onboarding_etapa' column of 'perfis'" }, 400)
        }
        perfilAtual = { ...perfilAtual, ...corpo }
      }
      return json(objeto ? perfilAtual : [perfilAtual])
    }

    if (url.pathname.startsWith('/rest/v1/rpc/')) return json(null)
    if (banco && url.pathname.startsWith('/rest/v1/')) {
      const tabela = url.pathname.replace('/rest/v1/', '')
      const objeto = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
      const corpo = ['POST', 'PATCH'].includes(metodo) ? req.postDataJSON() : null
      const linhas = banco.tratar(tabela, metodo, [...url.searchParams.entries()], corpo)
      if (objeto) return linhas.length ? json(linhas[0]) : json({ code: 'PGRST116', message: 'no rows' }, 406)
      return json(linhas)
    }
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
