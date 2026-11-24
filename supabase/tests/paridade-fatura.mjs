// Paridade SQL x JS do total da fatura (PGlite, banco em memoria, dados ficticios).
// Compara public.total_fatura_ciclo (SQL, servidor) com src/lib/faturaCartao.js (cliente) e
// com o gabarito tests/fixtures/paridade-fatura.json (valores calculados a mao), e exercita
// pagar_fatura_cartao / estornar_pagamento_fatura com total inflado, parcial, nova compra,
// estorno e cartoes distintos.
//
// STATUS: escrito, NAO EXECUTADO no ambiente do agente (npm ci devolve 403, sem
// node_modules/PGlite e sem Postgres local). Marcado PENDENTE ate rodar:
//   npm ci && node supabase/tests/paridade-fatura.mjs     (ou npm run test:migrations)
// Nada se conecta ao Supabase.
import { readFileSync, readdirSync, existsSync } from 'fs'
import * as F from '../../src/lib/faturaCartao.js'

let PGlite, uuid_ossp
try {
  ;({ PGlite } = await import('@electric-sql/pglite'))
  ;({ uuid_ossp } = await import('@electric-sql/pglite/contrib/uuid_ossp'))
} catch (e) {
  console.log('PENDENTE - @electric-sql/pglite indisponivel (npm ci). Paridade SQL x JS NAO foi executada.')
  process.exit(2)
}

const dir = new URL('../', import.meta.url)
const ler = p => readFileSync(new URL(p, dir), 'utf8').replace(/CREATE EXTENSION IF NOT EXISTS "?pgcrypto"?[^;]*;/gi, '-- (pgcrypto omitido)')
const fx = JSON.parse(readFileSync(new URL('../../tests/fixtures/paridade-fatura.json', import.meta.url), 'utf8'))
const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const HOJE = new Date()
// Mesma data que a RPC usa (America/Sao_Paulo); toISOString() seria UTC e falharia entre 21h e 24h BRT.
const hoje = HOJE.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

let falhas = 0
let verificacoes = 0
const ok = (nome, cond, det = '') => { verificacoes++; if (!cond) { falhas++; console.log(`FALHA - ${nome} ${det}`) } }
const cent = v => Math.round(Number(v) * 100)

const db = new PGlite({ extensions: { uuid_ossp } })
await db.exec(`
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA extensions;
  CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}', created_at timestamptz DEFAULT now());
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role', true) $$;
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text, owner uuid);
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array(name, '/') $$;
  GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
`)

const STAGING = ['1-SCHEMA-COMPLETO-STAGING.sql', '2-FUNCOES-TRIGGERS.sql', '3-POLITICAS-RLS.sql', '4-CATEGORIAS-INICIAIS.sql', 'MIGRATION-PERMISSOES-STAGING.sql']
const base = existsSync(new URL('../staging/1-SCHEMA-COMPLETO-STAGING.sql', dir)) ? STAGING.map(s => `../staging/${s}`) : ['schema.sql']
const arquivos = [...base, ...readdirSync(new URL('migrations/', dir)).filter(f => f.endsWith('.sql') && !/TESTES/i.test(f)).sort().map(f => `migrations/${f}`)]
for (const arq of arquivos) {
  try { await db.exec(ler(arq)) } catch (e) {
    await db.exec('ROLLBACK').catch(() => {})
    // A migration sob teste e as suas dependencias diretas nao podem falhar.
    if (/2026-11_pagamentos_fatura|2026-10_consultoria_acessos|2026-10_faturas_cartao|2026-11_compras_cartao_cartao_do_dono/.test(arq)) {
      ok(`aplica ${arq}`, false, e.message)
    }
  }
}
await db.exec(`SET session_replication_role = replica`)
await db.exec(`INSERT INTO auth.users (id, email) VALUES ('${A}', 'a@exemplo.invalid'), ('${B}', 'b@exemplo.invalid') ON CONFLICT DO NOTHING`)
await db.exec(`SET session_replication_role = origin`)

async function como(uid, sql, params) {
  await db.exec('BEGIN')
  try {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)`, [uid || '', uid ? 'authenticated' : 'anon'])
    await db.exec(`SET LOCAL ROLE ${uid ? 'authenticated' : 'anon'}`)
    const r = await db.query(sql, params)
    await db.exec('COMMIT')
    return { linhas: r.rows }
  } catch (e) { await db.exec('ROLLBACK'); return { erro: e.message } }
}

let seq = 0
async function criarCartao(usuario, dia, nome) {
  const r = await db.query(
    `INSERT INTO public.cartoes (usuario_id, nome, limite_total, dia_fechamento, dia_vencimento) VALUES ($1, $2, 99999, $3, 28) RETURNING id`,
    [usuario, `${nome} ${++seq}`, dia])
  return r.rows[0].id
}
async function inserirCompra(usuario, cartao, c) {
  await db.query(`INSERT INTO public.compras_cartao (usuario_id, cartao_id, descricao, valor_total, data_compra, numero_parcelas) VALUES ($1, $2, $3, $4, $5, $6)`,
    [usuario, cartao, c.descricao, c.valor_total, c.data_compra, c.numero_parcelas ?? 1])
}
async function inserirParcelamento(usuario, cartao, p) {
  await db.query(`INSERT INTO public.parcelamentos (usuario_id, cartao_id, descricao, valor_total, numero_parcelas, primeira_parcela, quitado_em) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [usuario, cartao, p.descricao, p.valor_total, p.numero_parcelas, p.primeira_parcela, p.quitado_em ?? null])
}
async function inserirFaturaInformada(usuario, cartao, f) {
  await db.query(`INSERT INTO public.faturas_cartao (usuario_id, cartao_id, ano_mes, valor_total) VALUES ($1, $2, $3, $4)`, [usuario, cartao, f.ano_mes, f.valor_total])
}
const totalSql = async (uid, cartao, ym) => {
  const r = await como(uid, `SELECT public.total_fatura_ciclo($1, $2) AS t`, [cartao, ym])
  return r.erro ? { erro: r.erro } : { t: Number(r.linhas[0].t) }
}
const ymDe = (ano, mes) => `${ano}-${String(mes).padStart(2, '0')}`
const split = ym => ({ ano: Number(ym.slice(0, 4)), mes: Number(ym.slice(5, 7)) })

// Monta o estado do cenario no banco e no formato do cliente (mesmos objetos nos dois lados).
async function prepararCenario(cen) {
  const fech = { ...fx.cartoes, ...(cen.cartoes || {}) }
  const ids = { main: await criarCartao(A, fech.main, 'main'), b: await criarCartao(A, fech.b, 'b') }
  const cartoes = { main: { id: ids.main, dia_fechamento: fech.main, dia_vencimento: 28 }, b: { id: ids.b, dia_fechamento: fech.b, dia_vencimento: 28 } }
  const compras = [], parcelamentos = [], faturasInformadas = []
  for (const c of cen.compras || []) { const k = c.cartao || 'main'; await inserirCompra(A, ids[k], c); compras.push({ id: `c${compras.length}`, cartao_id: ids[k], ...c }) }
  for (const p of cen.parcelamentos || []) { const k = p.cartao || 'main'; await inserirParcelamento(A, ids[k], p); parcelamentos.push({ id: `p${parcelamentos.length}`, cartao_id: ids[k], quitado_em: null, ...p }) }
  for (const f of cen.faturasInformadas || []) { const k = f.cartao || 'main'; await inserirFaturaInformada(A, ids[k], f); faturasInformadas.push({ cartao_id: ids[k], ...f }) }
  return { ids, cartoes, compras, parcelamentos, faturasInformadas }
}
const totalJs = (e, k, ym) => { const { ano, mes } = split(ym); return F.totalFaturaComOverride(e.compras, e.parcelamentos, e.faturasInformadas, e.ids[k], e.cartoes[k].dia_fechamento, ano, mes) }

console.log('# 1) Gabarito (a mao) x SQL x JS: totais por ciclo')
for (const cen of fx.totais) {
  const e = await prepararCenario(cen)
  for (const [k, mapa] of [['main', cen.esperado], ['b', cen.esperado_b]]) {
    for (const [ym, esp] of Object.entries(mapa || {})) {
      const s = await totalSql(A, e.ids[k], ym)
      const j = totalJs(e, k, ym)
      ok(`${cen.nome} | ${k} ${ym}: SQL = gabarito`, !s.erro && cent(s.t) === cent(esp), `(SQL ${s.t ?? s.erro}, gabarito ${esp})`)
      ok(`${cen.nome} | ${k} ${ym}: SQL = JS`, !s.erro && cent(s.t) === cent(j), `(SQL ${s.t ?? s.erro}, JS ${j})`)
    }
  }
}

console.log('# 2) Paridade aleatoria SQL x JS (semente fixa)')
{
  let x = 123456789
  const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296 }
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1))
  const iso = (ano, mes, dia) => `${ano}-${String(mes).padStart(2, '0')}-${String(Math.min(dia, new Date(ano, mes, 0).getDate())).padStart(2, '0')}`
  const nomes = ['Mercado', 'Notebook', 'Celular', 'Viagem', 'Cafe', 'Presente']
  for (let rodada = 0; rodada < 25; rodada++) {
    const fech = int(1, 31)
    const cen = { cartoes: { main: fech }, compras: [], parcelamentos: [], faturasInformadas: [] }
    for (let i = 0; i < 8; i++) {
      const parcelas = rnd() < 0.5 ? 1 : int(2, 12)
      const d = { descricao: `${nomes[int(0, 5)]} ${int(1, 3)}`, valor_total: int(1, 500000) / 100, numero_parcelas: parcelas }
      const data = iso(int(2025, 2027), int(1, 12), int(1, 31))
      if (rnd() < 0.7) cen.compras.push({ ...d, data_compra: data })
      else cen.parcelamentos.push({ ...d, primeira_parcela: data, quitado_em: rnd() < 0.15 ? '2026-06-01' : undefined })
    }
    if (rnd() < 0.4) cen.faturasInformadas.push({ ano_mes: ymDe(int(2025, 2028), int(1, 12)), valor_total: int(0, 800000) / 100 })
    const e = await prepararCenario(cen)
    for (let ano = 2025; ano <= 2029; ano++) for (let mes = 1; mes <= 12; mes++) {
      const ym = ymDe(ano, mes)
      const s = await totalSql(A, e.ids.main, ym)
      const j = totalJs(e, 'main', ym)
      ok(`aleatorio #${rodada} fech ${fech} ${ym}`, !s.erro && cent(s.t) === cent(j), `(SQL ${s.t ?? s.erro}, JS ${j})`)
    }
  }
}

console.log('# 3) RPC pagar_fatura_cartao / estornar: sequencias do gabarito')
const padroes = { excede: /excede o saldo em aberto/i, quitada: /sem saldo em aberto/i, sem_valor: /sem valor a pagar/i, desatualizada: /desatualizada/i }
for (const cen of fx.pagamentos) {
  const e = await prepararCenario(cen)
  const pagamentosJs = []
  const porRef = {}
  const ciclo = (k, ym) => { const { ano, mes } = split(ym); return F.cicloFatura({ cartao: e.cartoes[k], compras: e.compras, parcelamentos: e.parcelamentos, faturasInformadas: e.faturasInformadas, pagamentos: pagamentosJs, ano, mes, hoje: HOJE }) }
  for (const [ym, esp] of Object.entries(cen.esperado || {})) {
    const s = await totalSql(A, e.ids.main, ym)
    ok(`${cen.nome} | total ${ym} SQL = gabarito`, !s.erro && cent(s.t) === cent(esp), `(${s.t ?? s.erro})`)
  }
  let i = 0
  for (const p of cen.passos) {
    i++
    const k = p.cartao || 'main'
    const rot = `${cen.nome} | passo ${i} ${p.op}`
    if (p.op === 'compra') {
      await inserirCompra(A, e.ids[k], p.compra)
      e.compras.push({ id: `n${i}`, cartao_id: e.ids[k], ...p.compra })
    } else if (p.op === 'estornar') {
      const r = await como(A, `SELECT * FROM public.estornar_pagamento_fatura($1)`, [porRef[p.ref].idSql])
      ok(`${rot}: estorno aceito`, !r.erro && r.linhas[0].status === 'estornado', r.erro || '')
      porRef[p.ref].status = 'estornado'
      const r2 = await como(A, `SELECT * FROM public.estornar_pagamento_fatura($1)`, [porRef[p.ref].idSql])
      ok(`${rot}: estorno repetido recusado`, !!r2.erro && /j[aá] estornado/i.test(r2.erro), r2.erro || '')
    } else {
      // O cliente envia o total que ELE calcula (JS), salvo quando o passo forca uma dica.
      const hint = p.hint ?? ciclo(k, p.ano_mes).total
      const chave = `par-${seq}-${i}-${Math.random().toString(36).slice(2, 10)}`
      const r = await como(A, `SELECT * FROM public.pagar_fatura_cartao($1, $2, $3, $4, 'saldo_principal', NULL, $5, $6)`, [e.ids[k], p.ano_mes, p.valor, hoje, hint, chave])
      ok(`${rot}: aceito=${!r.erro} esperado ${p.ok}`, p.ok ? !r.erro : !!r.erro, r.erro || '')
      if (!p.ok && p.erro) ok(`${rot}: motivo ${p.erro}`, !!r.erro && padroes[p.erro].test(r.erro), r.erro || '')
      if (p.ok && !r.erro) {
        const pg = { id: `g${i}`, idSql: r.linhas[0].id, cartao_id: e.ids[k], ano_mes: p.ano_mes, valor: p.valor, status: 'ativo', origem: 'saldo_principal' }
        pagamentosJs.push(pg)
        if (p.id) porRef[p.id] = pg
        // Idempotencia: repetir a chamada devolve o mesmo pagamento, sem nova linha.
        const rep = await como(A, `SELECT * FROM public.pagar_fatura_cartao($1, $2, $3, $4, 'saldo_principal', NULL, $5, $6)`, [e.ids[k], p.ano_mes, p.valor, hoje, hint, chave])
        ok(`${rot}: repeticao idempotente`, !rep.erro && rep.linhas[0].id === r.linhas[0].id, rep.erro || '')
      }
    }
    // Em aberto no servidor (total - ativos) = em aberto do cliente = gabarito.
    const s = await totalSql(A, e.ids[k], p.ano_mes)
    const pg = await db.query(`SELECT COALESCE(SUM(valor),0)::numeric AS v FROM public.pagamentos_fatura WHERE cartao_id = $1 AND ano_mes = $2 AND status = 'ativo'`, [e.ids[k], p.ano_mes])
    const abertoSql = Math.max(0, cent(s.t) - cent(pg.rows[0].v))
    ok(`${rot}: em aberto SQL = gabarito`, abertoSql === cent(p.emAberto), `(SQL ${abertoSql / 100}, gabarito ${p.emAberto})`)
    ok(`${rot}: em aberto SQL = JS`, abertoSql === cent(ciclo(k, p.ano_mes).emAberto), `(SQL ${abertoSql / 100}, JS ${ciclo(k, p.ano_mes).emAberto})`)
  }
}

console.log('# 4) Isolamento e permissoes')
{
  const e = await prepararCenario({ compras: [{ descricao: 'Z', valor_total: 100, data_compra: '2026-11-05', numero_parcelas: 1 }] })
  let r = await como(B, `SELECT public.total_fatura_ciclo($1, '2026-11') AS t`, [e.ids.main])
  ok('B nao consulta o total do cartao de A', !!r.erro, r.erro || '')
  r = await como(B, `SELECT public.total_fatura_ciclo_servidor($1, $2, '2026-11') AS t`, [e.ids.main, A])
  ok('B nao executa a funcao interna com usuario arbitrario', !!r.erro, r.erro || '')
  r = await como(null, `SELECT public.total_fatura_ciclo($1, '2026-11') AS t`, [e.ids.main])
  ok('anonimo nao consulta total', !!r.erro)
  r = await como(B, `SELECT * FROM public.pagar_fatura_cartao($1, '2026-11', 10, $2, 'saldo_principal', NULL, 100, 'chave-b-invasor-1')`, [e.ids.main, hoje])
  ok('B nao paga fatura do cartao de A', !!r.erro, r.erro || '')
}

console.log('# 5) Concorrencia (limite do PGlite: uma conexao, sem sessoes reais em paralelo; NAO conta como evidencia de lock)')
{
  // Mesma chave em chamadas "simultaneas": a serializacao e feita pelo driver, entao isto valida
  // a idempotencia, NAO o lock FOR UPDATE entre duas sessoes. Isso e PENDENTE no DEV (2 sessoes).
  const e = await prepararCenario({ compras: [{ descricao: 'Z', valor_total: 100, data_compra: '2026-11-05', numero_parcelas: 1 }] })
  const args = [e.ids.main, '2026-11', 60, hoje, 100, 'chave-concorrente-par']
  await Promise.all([1, 2].map(() => como(A, `SELECT * FROM public.pagar_fatura_cartao($1, $2, $3, $4, 'saldo_principal', NULL, $5, $6)`, args)))
  let r = await db.query(`SELECT count(*)::int AS n FROM public.pagamentos_fatura WHERE cartao_id = $1`, [e.ids.main])
  ok('mesma chave em 2 chamadas gera 1 linha', r.rows[0].n === 1, `(${r.rows[0].n})`)
  // Restam 40: duas chaves diferentes de 40 sobre o mesmo ciclo, so uma pode passar (o teto e o servidor).
  const rs = await Promise.all(['chave-dupla-par-1', 'chave-dupla-par-2'].map(k =>
    como(A, `SELECT * FROM public.pagar_fatura_cartao($1, '2026-11', 40, $2, 'saldo_principal', NULL, 100, $3)`, [e.ids.main, hoje, k])))
  r = await db.query(`SELECT COALESCE(SUM(valor),0)::numeric AS v FROM public.pagamentos_fatura WHERE cartao_id = $1 AND status = 'ativo'`, [e.ids.main])
  ok('duas chaves no mesmo cartao: soma = 100 e so uma aceita', cent(r.rows[0].v) === 10000 && rs.filter(x => !x.erro).length === 1, `(${r.rows[0].v}; ${rs.filter(x => !x.erro).length} aceitas)`)
}

console.log(falhas === 0 ? `\nOK - paridade SQL x JS aprovada (${verificacoes} verificacoes)` : `\n${falhas} FALHA(S) de ${verificacoes}`)
if (falhas) process.exitCode = 1
