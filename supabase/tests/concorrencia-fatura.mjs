// Teste de CONCORRENCIA com PostgreSQL REAL (duas ou mais conexoes, driver `pg`).
// NAO e simulacao: PGlite tem uma unica conexao e nao prova locks. Este script prova que
// compras_cartao, parcelamentos e faturas_cartao (INSERT/UPDATE/DELETE) e pagar_fatura_cartao
// serializam pelo mesmo lock por cartao (public.travar_cartoes_fatura + triggers).
//
// Uso (Postgres local DESCARTAVEL, nunca producao):
//   docker run --rm -e POSTGRES_PASSWORD=x -p 55432:5432 postgres:16
//   npm i --no-save pg
//   PG_TEST_URL=postgres://postgres:x@127.0.0.1:55432/postgres node supabase/tests/concorrencia-fatura.mjs
//
// Variaveis:
//   PG_TEST_URL                  (obrigatoria) conexao com um superusuario do banco descartavel.
//   PG_TEST_PERMITIR_HOST_REMOTO=1  permite host nao local (somente DEV descartavel).
//   PG_TEST_RESETAR=1            permite recriar o schema public se ele ja tiver tabelas (DESTRUTIVO).
//
// Codigo de saida: 0 = TODOS os cenarios rodaram em PostgreSQL real e passaram;
//                  1 = algum cenario falhou; 2 = NAO executou (PENDENTE; nunca vira aprovacao).
import { readFileSync, readdirSync, existsSync } from 'fs'

const dir = new URL('../', import.meta.url)
const ler = p => readFileSync(new URL(p, dir), 'utf8')
const dorme = ms => new Promise(r => setTimeout(r, ms))

function pendente(motivo) {
  console.log(`PENDENTE: nao executado (${motivo}). Nenhuma prova de concorrencia foi produzida.`)
  process.exit(2)
}

// ---------- Guardas de ambiente ----------
const url = process.env.PG_TEST_URL
if (!url) pendente('defina PG_TEST_URL apontando para um PostgreSQL descartavel')
let alvo
try { alvo = new URL(url) } catch { pendente('PG_TEST_URL invalida') }
const host = alvo.hostname.toLowerCase()
if (/ievccupeijzuzhomphwn/i.test(url)) {
  console.error('RECUSADO: a URL aponta para o projeto de producao. Este teste nunca roda em producao.')
  process.exit(1)
}
const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)
const supabaseHost = /supabase\.(co|com)$/i.test(host) || /supabase\.(co|com)/i.test(url)
if ((supabaseHost || !local) && process.env.PG_TEST_PERMITIR_HOST_REMOTO !== '1') {
  console.error(`RECUSADO: host "${host}" nao e local. Use um Postgres descartavel local, ou PG_TEST_PERMITIR_HOST_REMOTO=1 apenas para um DEV descartavel.`)
  process.exit(1)
}

let pg
try { pg = (await import('pg')).default } catch { pendente('pacote "pg" ausente (npm i --no-save pg)') }

// ---------- Resultado ----------
let falhas = 0
let asserts = 0
const ok = (nome, cond, det = '') => { asserts++; if (!cond) falhas++; console.log(`${cond ? 'PASS' : 'FALHA'} - ${nome} ${det}`) }
let cenariosRodados = 0
const cenariosFalhos = []

// ---------- Conexoes ----------
const novoCliente = () => new pg.Client({ connectionString: url, statement_timeout: 60000 })
const admin = novoCliente()
await admin.connect()
const sv = (await admin.query('SHOW server_version_num')).rows[0].server_version_num
const enc = (await admin.query(`SELECT pg_encoding_to_char(encoding) AS e FROM pg_database WHERE datname = current_database()`)).rows[0].e
const sver = (await admin.query('SHOW server_version')).rows[0].server_version
console.log(`Servidor PostgreSQL ${sver} (${sv}), codificacao ${enc}`)
if (Number(sv) < 130000 || enc !== 'UTF8') {
  console.error('FALHA: requer PostgreSQL 13+ e banco UTF8.')
  await admin.end()
  process.exit(1)
}
const su = (await admin.query(`SELECT rolsuper FROM pg_roles WHERE rolname = current_user`)).rows[0].rolsuper
if (!su) {
  console.error('FALHA: o usuario de PG_TEST_URL precisa ser superusuario do banco descartavel (criar papeis e desligar triggers de auth).')
  await admin.end()
  process.exit(1)
}

// ---------- Bootstrap (ambiente parecido com o Supabase) ----------
const jaTem = (await admin.query(`SELECT to_regclass('public.cartoes') IS NOT NULL AS t`)).rows[0].t
if (jaTem) {
  if (process.env.PG_TEST_RESETAR !== '1') {
    console.error('RECUSADO: o banco ja tem public.cartoes. Use um banco vazio e descartavel, ou PG_TEST_RESETAR=1 para recriar os schemas public e auth (DESTRUTIVO).')
    await admin.end()
    process.exit(1)
  }
  await admin.query('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE; DROP SCHEMA IF EXISTS storage CASCADE; CREATE SCHEMA public;')
}
await admin.query(`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  END $$;
  CREATE SCHEMA IF NOT EXISTS auth; CREATE SCHEMA IF NOT EXISTS storage; CREATE SCHEMA IF NOT EXISTS extensions;
  CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}', created_at timestamptz DEFAULT now());
  CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role', true) $$;
  CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  CREATE TABLE IF NOT EXISTS storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  CREATE TABLE IF NOT EXISTS storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text, owner uuid);
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array(name, '/') $$;
  GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
`)

const STAGING = ['1-SCHEMA-COMPLETO-STAGING.sql', '2-FUNCOES-TRIGGERS.sql', '3-POLITICAS-RLS.sql', '4-CATEGORIAS-INICIAIS.sql', 'MIGRATION-PERMISSOES-STAGING.sql']
const base = existsSync(new URL('../staging/1-SCHEMA-COMPLETO-STAGING.sql', dir)) ? STAGING.map(s => `../staging/${s}`) : ['schema.sql']
const NOVA = /20261124000001_pagamentos_fatura|20261124000002_integridade_historica_fatura/
const arquivos = [...base, ...readdirSync(new URL('migrations/', dir)).filter(f => f.endsWith('.sql') && !/TESTES|TESTE_/i.test(f)).sort().map(f => `migrations/${f}`)]
for (const arq of arquivos) {
  try {
    await admin.query('BEGIN')
    await admin.query(ler(arq).replace(/CREATE EXTENSION IF NOT EXISTS "?pgcrypto"?[^;]*;/gi, ''))
    await admin.query('COMMIT')
  } catch (e) {
    await admin.query('ROLLBACK').catch(() => {})
    // A migration sob teste e as dependencias diretas nao podem falhar; as demais sao avisos.
    if (NOVA.test(arq) || /2026-10_consultoria_acessos|2026-10_faturas_cartao/.test(arq)) {
      console.error(`FALHA ao aplicar ${arq}: ${e.message}`)
      await admin.end()
      process.exit(1)
    }
    console.log(`(aviso) ${arq}: ${e.message.split('\n')[0]}`)
  }
}
console.log('Bootstrap aplicado (schema + migrations, incluindo 20261124000001_pagamentos_fatura.sql e 20261124000002_integridade_historica_fatura.sql)')

// ---------- Sessoes ----------
const sessoesAbertas = new Set()
class Sessao {
  constructor(cliente, pid) { this.c = cliente; this.pid = pid; this.fim = false }
  // Executa e devolve { linhas } ou { erro, code }. Em erro a transacao fica abortada.
  async q(sql, params = []) {
    try { const r = await this.c.query(sql, params); return { linhas: r.rows, n: r.rowCount } } catch (e) { return { erro: e.message, code: e.code } }
  }
  async commit() { const r = await this.q('COMMIT'); await this.fechar(); return r }
  async rollback() { await this.q('ROLLBACK'); await this.fechar() }
  async fechar() { if (this.fim) return; this.fim = true; sessoesAbertas.delete(this); await this.c.end().catch(() => {}) }
}
// papel: 'authenticated' (usuario via PostgREST), 'dono' (sem auth.uid(): service role/SQL Editor)
async function abrir(uid, { papel = 'authenticated', isolamento = null } = {}) {
  const c = novoCliente()
  await c.connect()
  const pid = (await c.query('SELECT pg_backend_pid() AS p')).rows[0].p
  await c.query(`BEGIN${isolamento ? ` ISOLATION LEVEL ${isolamento}` : ''}`)
  await c.query(`SET LOCAL lock_timeout = '20s'; SET LOCAL statement_timeout = '60s'`)
  if (papel === 'authenticated') {
    await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)`, [uid])
    await c.query('SET LOCAL ROLE authenticated')
  }
  const s = new Sessao(c, pid)
  sessoesAbertas.add(s)
  return s
}
// Prova a espera REAL por lock (sem sleeps): a sessao precisa aparecer com wait_event_type = 'Lock'.
async function aguardarBloqueio(sessao, promessa, rotulo) {
  let resolvida = false
  promessa.then(() => { resolvida = true }, () => { resolvida = true })
  const limite = Date.now() + 10000
  while (Date.now() < limite) {
    const r = await admin.query(`SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1`, [sessao.pid])
    if (r.rows[0]?.wait_event_type === 'Lock') { ok(`${rotulo}: sessao ficou BLOQUEADA aguardando lock (pg_stat_activity)`, !resolvida); return true }
    if (resolvida) break
    await dorme(25)
  }
  ok(`${rotulo}: sessao ficou BLOQUEADA aguardando lock (pg_stat_activity)`, false, '(nao bloqueou em 10 s)')
  return false
}

// ---------- Dados ----------
const uuid = () => admin.query('SELECT gen_random_uuid() AS u').then(r => r.rows[0].u)
const CICLO = '2026-10' // fechamento dia 20: compras de 05/10/2026 caem no ciclo 2026-10
const centavos = n => Math.round(Number(n) * 100)
async function novoUsuario() {
  const u = await uuid()
  await admin.query(`SET session_replication_role = replica`)
  await admin.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [u, `u${u.slice(0, 8)}@exemplo.invalid`])
  await admin.query(`SET session_replication_role = origin`)
  return u
}
async function novoCartao(u, nome = 'Cartao') {
  const r = await admin.query(`INSERT INTO public.cartoes (usuario_id, nome, limite_total, dia_fechamento, dia_vencimento) VALUES ($1, $2, 99999, 20, 28) RETURNING id`, [u, nome])
  return r.rows[0].id
}
async function novaCompra(u, cartao, descricao, valor, parcelas = 1, data = '2026-10-05') {
  const r = await admin.query(`INSERT INTO public.compras_cartao (usuario_id, cartao_id, descricao, valor_total, data_compra, numero_parcelas) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [u, cartao, descricao, valor, data, parcelas])
  return r.rows[0].id
}
async function novoParcelamento(u, cartao, descricao, valor, parcelas, primeira = '2026-10-05') {
  const r = await admin.query(`INSERT INTO public.parcelamentos (usuario_id, cartao_id, descricao, valor_total, numero_parcelas, primeira_parcela) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [u, cartao, descricao, valor, parcelas, primeira])
  return r.rows[0].id
}
async function novaFatura(u, cartao, valor, anoMes = CICLO) {
  const r = await admin.query(`INSERT INTO public.faturas_cartao (usuario_id, cartao_id, ano_mes, valor_total) VALUES ($1, $2, $3, $4) RETURNING id`, [u, cartao, anoMes, valor])
  return r.rows[0].id
}
const totalAdmin = async (u, cartao, anoMes = CICLO) =>
  Number((await admin.query(`SELECT public.total_fatura_ciclo_servidor($1, $2, $3) AS t`, [cartao, u, anoMes])).rows[0].t)
const qtdPagamentos = async (cartao, status = 'ativo') =>
  (await admin.query(`SELECT count(*)::int AS n FROM public.pagamentos_fatura WHERE cartao_id = $1 AND status = $2`, [cartao, status])).rows[0].n
const somaPagamentos = async cartao =>
  Number((await admin.query(`SELECT COALESCE(SUM(valor),0) AS v FROM public.pagamentos_fatura WHERE cartao_id = $1 AND status = 'ativo'`, [cartao])).rows[0].v)
const SQL_PAGAR = `SELECT * FROM public.pagar_fatura_cartao($1::uuid, $2, $3::numeric, '2020-01-01'::date, 'saldo_principal', NULL, $4::numeric, $5)`
let seq = 0
const chave = () => `conc-${Date.now().toString(36)}-${++seq}-${Math.random().toString(36).slice(2, 8)}`

async function cenario(nome, fn) {
  console.log(`\n# ${nome}`)
  const antes = falhas
  try { await fn(); cenariosRodados++ } catch (e) {
    falhas++
    ok(`${nome}: excecao inesperada`, false, e.stack || e.message)
  } finally {
    for (const s of [...sessoesAbertas]) { await s.rollback().catch(() => {}) }
  }
  if (falhas > antes) cenariosFalhos.push(nome)
}

// Padrao "escritor segura o lock, pagador espera": o escritor W executa a escrita (sem commit),
// o pagador P tenta pagar o total ANTIGO com dica do total antigo, bloqueia de verdade, W commita
// e P precisa falhar (40001 com dica) sem gravar pagamento. Depois repete com a MESMA chave.
async function escritaDuranteOPagamento({ nome, u, cartao, escrever, totalAntigo, totalNovo, papelEscritor = 'authenticated' }) {
  const W = await abrir(u, { papel: papelEscritor })
  const rw = await escrever(W)
  ok(`${nome}: escrita do escritor aceita`, !rw.erro, rw.erro || '')
  const P = await abrir(u)
  const k = chave()
  const pP = P.q(SQL_PAGAR, [cartao, CICLO, totalAntigo, totalAntigo, k])
  await aguardarBloqueio(P, pP, nome)
  await W.commit()
  const rp = await pP
  ok(`${nome}: pagamento com total antigo e abortado (40001 Fatura desatualizada)`, rp.code === '40001' && /desatualizada/i.test(rp.erro || ''), `(${rp.code} ${rp.erro || 'sem erro'})`)
  await P.rollback()
  ok(`${nome}: nenhum pagamento gravado`, (await qtdPagamentos(cartao)) === 0)
  const t = await totalAdmin(u, cartao)
  ok(`${nome}: total commitado = ${totalNovo}`, centavos(t) === centavos(totalNovo), `(${t})`)
  // Repeticao apos conflito: mesma chave, total releido.
  const P2 = await abrir(u)
  const r2 = await P2.q(SQL_PAGAR, [cartao, CICLO, t, t, k])
  ok(`${nome}: repeticao com a MESMA chave e o novo total e aceita`, !r2.erro, r2.erro || '')
  await P2.commit()
  const P3 = await abrir(u)
  const r3 = await P3.q(SQL_PAGAR, [cartao, CICLO, t, t, k])
  ok(`${nome}: repetir de novo devolve o mesmo pagamento`, !r3.erro && r3.linhas[0].id === r2.linhas[0].id, r3.erro || '')
  await P3.commit()
  ok(`${nome}: exatamente 1 linha de pagamento e soma = total`, (await qtdPagamentos(cartao)) === 1 && centavos(await somaPagamentos(cartao)) === centavos(t))
}

// ============================================================
// (1) Exclusao de compra durante pagamento
await cenario('1. Exclusao de compra durante pagamento', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  await novaCompra(u, c, 'Mercado', 1000)
  const b = await novaCompra(u, c, 'Farmacia', 500)
  await escritaDuranteOPagamento({ nome: '1 DELETE compra', u, cartao: c, totalAntigo: 1500, totalNovo: 1000,
    escrever: W => W.q(`DELETE FROM public.compras_cartao WHERE id = $1`, [b]) })
})

// (2) Alteracao do valor da compra durante pagamento (para menos e para mais)
await cenario('2a. Alteracao do valor da compra (para menos) durante pagamento', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  await novaCompra(u, c, 'Mercado', 1000)
  const b = await novaCompra(u, c, 'Farmacia', 500)
  await escritaDuranteOPagamento({ nome: '2a UPDATE valor menor', u, cartao: c, totalAntigo: 1500, totalNovo: 1200,
    escrever: W => W.q(`UPDATE public.compras_cartao SET valor_total = 200 WHERE id = $1`, [b]) })
})
await cenario('2b. Alteracao do valor da compra (para mais) durante pagamento', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  await novaCompra(u, c, 'Mercado', 1000)
  const b = await novaCompra(u, c, 'Farmacia', 500)
  await escritaDuranteOPagamento({ nome: '2b UPDATE valor maior', u, cartao: c, totalAntigo: 1500, totalNovo: 1900,
    escrever: W => W.q(`UPDATE public.compras_cartao SET valor_total = 900 WHERE id = $1`, [b]) })
})
await cenario('2c. Sem dica do cliente: pagar o total antigo apos reducao e recusado pelo servidor', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  await novaCompra(u, c, 'Mercado', 1000)
  const b = await novaCompra(u, c, 'Farmacia', 500)
  const W = await abrir(u)
  await W.q(`DELETE FROM public.compras_cartao WHERE id = $1`, [b])
  const P = await abrir(u)
  const pP = P.q(SQL_PAGAR, [c, CICLO, 1500, null, chave()]) // dica NULL: so o recalculo sob lock protege
  await aguardarBloqueio(P, pP, '2c')
  await W.commit()
  const rp = await pP
  ok('2c: pagamento de 1500 sem dica e recusado com o total real (1000)', rp.code === '22003' && /em aberto: 1000\.00/.test(rp.erro || ''), `(${rp.code} ${rp.erro || ''})`)
  await P.rollback()
  ok('2c: nenhum pagamento indevido', (await qtdPagamentos(c)) === 0)
})

// (3) Inclusao de compra durante pagamento, nas duas direcoes
await cenario('3a. Inclusao de compra: escritor segura o lock, pagador espera e falha', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  await novaCompra(u, c, 'Mercado', 1000)
  await escritaDuranteOPagamento({ nome: '3a INSERT compra', u, cartao: c, totalAntigo: 1000, totalNovo: 1300,
    escrever: W => W.q(`INSERT INTO public.compras_cartao (usuario_id, cartao_id, descricao, valor_total, data_compra, numero_parcelas) VALUES ($1, $2, 'Nova', 300, '2026-10-06', 1)`, [u, c]) })
})
await cenario('3b. Inclusao de compra: pagador segura o lock, escritor espera o commit', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  await novaCompra(u, c, 'Mercado', 1000)
  const P = await abrir(u)
  const rp = await P.q(SQL_PAGAR, [c, CICLO, 400, 1000, chave()])
  ok('3b: pagamento parcial de 400 aceito (sessao ainda aberta)', !rp.erro, rp.erro || '')
  const W = await abrir(u)
  const pW = W.q(`INSERT INTO public.compras_cartao (usuario_id, cartao_id, descricao, valor_total, data_compra, numero_parcelas) VALUES ($1, $2, 'Nova', 300, '2026-10-06', 1)`, [u, c])
  await aguardarBloqueio(W, pW, '3b')
  await P.commit()
  const rw = await pW
  ok('3b: insercao concluida somente depois do commit do pagamento', !rw.erro, rw.erro || '')
  await W.commit()
  ok('3b: pagamento preservado (400) e total sobe para 1300', centavos(await somaPagamentos(c)) === 40000 && centavos(await totalAdmin(u, c)) === 130000)
})

// (4) Alteracao de parcelamento
for (const [rotulo, set, totalNovo] of [
  ['valor_total 600 -> 1200', 'valor_total = 1200', 1400],
  ['numero_parcelas 3 -> 6', 'numero_parcelas = 6', 1100],
  ['primeira_parcela fora do ciclo', `primeira_parcela = '2026-12-05'`, 1000],
  ['quitado_em preenchido', `quitado_em = '2026-10-10'`, 1000],
]) {
  await cenario(`4. UPDATE parcelamentos (${rotulo}) durante pagamento`, async () => {
    const u = await novoUsuario(); const c = await novoCartao(u)
    await novaCompra(u, c, 'Mercado', 1000)
    const p = await novoParcelamento(u, c, 'Notebook', 600, 3) // parcela 200 no ciclo 2026-10
    ok('4: total inicial 1200', centavos(await totalAdmin(u, c)) === 120000)
    await escritaDuranteOPagamento({ nome: `4 parcelamento ${rotulo}`, u, cartao: c, totalAntigo: 1200, totalNovo,
      escrever: W => W.q(`UPDATE public.parcelamentos SET ${set} WHERE id = $1`, [p]) })
  })
}
await cenario('4e. INSERT e DELETE de parcelamentos durante pagamento', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  await novaCompra(u, c, 'Mercado', 1000)
  await escritaDuranteOPagamento({ nome: '4e INSERT parcelamento', u, cartao: c, totalAntigo: 1000, totalNovo: 1100,
    escrever: W => W.q(`INSERT INTO public.parcelamentos (usuario_id, cartao_id, descricao, valor_total, numero_parcelas, primeira_parcela) VALUES ($1, $2, 'TV', 300, 3, '2026-10-05')`, [u, c]) })
  const u2 = await novoUsuario(); const c2 = await novoCartao(u2)
  await novaCompra(u2, c2, 'Mercado', 1000)
  const p = await novoParcelamento(u2, c2, 'Notebook', 600, 3)
  await escritaDuranteOPagamento({ nome: '4e DELETE parcelamento', u: u2, cartao: c2, totalAntigo: 1200, totalNovo: 1000,
    escrever: W => W.q(`DELETE FROM public.parcelamentos WHERE id = $1`, [p]) })
})

// (5) Alteracao de fatura informada
await cenario('5a. INSERT de fatura informada durante pagamento', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  await novaCompra(u, c, 'Mercado', 1000)
  await escritaDuranteOPagamento({ nome: '5a INSERT faturas_cartao', u, cartao: c, totalAntigo: 1000, totalNovo: 5000,
    escrever: W => W.q(`INSERT INTO public.faturas_cartao (usuario_id, cartao_id, ano_mes, valor_total) VALUES ($1, $2, $3, 5000)`, [u, c, CICLO]) })
})
await cenario('5b. UPDATE de fatura informada durante pagamento', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  await novaCompra(u, c, 'Mercado', 1000)
  const f = await novaFatura(u, c, 3000)
  await escritaDuranteOPagamento({ nome: '5b UPDATE faturas_cartao', u, cartao: c, totalAntigo: 3000, totalNovo: 1500,
    escrever: W => W.q(`UPDATE public.faturas_cartao SET valor_total = 1500 WHERE id = $1`, [f]) })
})
await cenario('5c. DELETE de fatura informada durante pagamento', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  await novaCompra(u, c, 'Mercado', 1000)
  const f = await novaFatura(u, c, 3000)
  await escritaDuranteOPagamento({ nome: '5c DELETE faturas_cartao', u, cartao: c, totalAntigo: 3000, totalNovo: 1000,
    escrever: W => W.q(`DELETE FROM public.faturas_cartao WHERE id = $1`, [f]) })
})

// (6) Duas (e mais) sessoes de pagamento concorrentes no mesmo cartao/ciclo
await cenario('6a. Duas sessoes pagar concorrentes: exatamente um sucesso', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  await novaCompra(u, c, 'Mercado', 1000)
  const P1 = await abrir(u); const P2 = await abrir(u)
  const r1 = await P1.q(SQL_PAGAR, [c, CICLO, 700, 1000, chave()])
  ok('6a: P1 pagou 700 (sessao aberta)', !r1.erro, r1.erro || '')
  const p2 = P2.q(SQL_PAGAR, [c, CICLO, 700, 1000, chave()])
  await aguardarBloqueio(P2, p2, '6a')
  await P1.commit()
  const r2 = await p2
  ok('6a: P2 recusada com saldo em aberto 300 (22003)', r2.code === '22003' && /em aberto: 300\.00/.test(r2.erro || ''), `(${r2.code} ${r2.erro || ''})`)
  await P2.rollback()
  ok('6a: soma dos pagamentos ativos <= total e = 700', centavos(await somaPagamentos(c)) === 70000 && (await qtdPagamentos(c)) === 1)
})
await cenario('6b. Seis sessoes concorrentes de 300 sobre total 1000: no maximo 3 sucessos', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  await novaCompra(u, c, 'Mercado', 1000)
  const resultados = await Promise.all(Array.from({ length: 6 }, async () => {
    const S = await abrir(u)
    const r = await S.q(SQL_PAGAR, [c, CICLO, 300, 1000, chave()])
    if (r.erro) await S.rollback(); else await S.commit()
    return r
  }))
  const sucessos = resultados.filter(r => !r.erro).length
  const soma = await somaPagamentos(c)
  ok('6b: exatamente 3 sucessos (900 <= 1000 < 1200)', sucessos === 3, `(${sucessos})`)
  ok('6b: soma dos pagamentos ativos <= total', centavos(soma) <= 100000 && centavos(soma) === 90000, `(${soma})`)
  ok('6b: falhas por saldo em aberto (22003), nunca por deadlock', resultados.filter(r => r.erro).every(r => r.code === '22003'), JSON.stringify(resultados.filter(r => r.erro).map(r => r.code)))
})
await cenario('6c. Pagamento concorrente com a MESMA chave: uma linha', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  await novaCompra(u, c, 'Mercado', 1000)
  const k = chave()
  const P1 = await abrir(u); const P2 = await abrir(u)
  const r1 = await P1.q(SQL_PAGAR, [c, CICLO, 400, 1000, k])
  const p2 = P2.q(SQL_PAGAR, [c, CICLO, 400, 1000, k])
  await aguardarBloqueio(P2, p2, '6c')
  await P1.commit()
  const r2 = await p2
  ok('6c: segunda chamada devolve o mesmo pagamento', !r1.erro && !r2.erro && r2.linhas[0].id === r1.linhas[0].id, r2.erro || '')
  await P2.commit()
  ok('6c: 1 linha', (await qtdPagamentos(c)) === 1)
})

// (7) Mudanca de compra entre cartoes e operacoes que afetam mais de um cartao
await cenario('7a. Mover compra do cartao X para Y bloqueia pagamentos em X e em Y', async () => {
  const u = await novoUsuario(); const x = await novoCartao(u, 'X'); const y = await novoCartao(u, 'Y')
  await novaCompra(u, x, 'Mercado X', 1000)
  const mv = await novaCompra(u, x, 'Mover', 400)
  await novaCompra(u, y, 'Mercado Y', 700)
  const W = await abrir(u)
  const rw = await W.q(`UPDATE public.compras_cartao SET cartao_id = $1 WHERE id = $2`, [y, mv])
  ok('7a: UPDATE cartao_id aceito', !rw.erro, rw.erro || '')
  const PX = await abrir(u); const PY = await abrir(u)
  const pX = PX.q(SQL_PAGAR, [x, CICLO, 1400, 1400, chave()])
  const pY = PY.q(SQL_PAGAR, [y, CICLO, 700, 700, chave()])
  await aguardarBloqueio(PX, pX, '7a pagar em X (origem)')
  await aguardarBloqueio(PY, pY, '7a pagar em Y (destino)')
  await W.commit()
  const [rX, rY] = await Promise.all([pX, pY])
  ok('7a: pagamento em X (total caiu para 1000) abortado 40001', rX.code === '40001', `(${rX.code} ${rX.erro || ''})`)
  ok('7a: pagamento em Y (total subiu para 1100) abortado 40001', rY.code === '40001', `(${rY.code} ${rY.erro || ''})`)
  await PX.rollback(); await PY.rollback()
  ok('7a: totais corretos (X 1000, Y 1100)', centavos(await totalAdmin(u, x)) === 100000 && centavos(await totalAdmin(u, y)) === 110000)
  ok('7a: nenhum pagamento indevido', (await qtdPagamentos(x)) === 0 && (await qtdPagamentos(y)) === 0)
})
await cenario('7b. Movimentacoes opostas X->Y e Y->X simultaneas (usuario autenticado) sem deadlock', async () => {
  const u = await novoUsuario(); const x = await novoCartao(u, 'X'); const y = await novoCartao(u, 'Y')
  const m1 = await novaCompra(u, x, 'Vai para Y', 100)
  const m2 = await novaCompra(u, y, 'Vai para X', 200)
  const W1 = await abrir(u); const W2 = await abrir(u)
  const r1 = await W1.q(`UPDATE public.compras_cartao SET cartao_id = $1 WHERE id = $2`, [y, m1])
  const p2 = W2.q(`UPDATE public.compras_cartao SET cartao_id = $1 WHERE id = $2`, [x, m2])
  await aguardarBloqueio(W2, p2, '7b W2 espera W1')
  await W1.commit()
  const r2 = await p2
  ok('7b: nenhuma das duas falhou (sem 40P01)', !r1.erro && !r2.erro && r2.code !== '40P01', `${r1.erro || ''} ${r2.erro || ''}`)
  await W2.commit()
  const r = await admin.query(`SELECT id, cartao_id FROM public.compras_cartao WHERE id = ANY($1)`, [[m1, m2]])
  const por = Object.fromEntries(r.rows.map(l => [l.id, l.cartao_id]))
  ok('7b: ambas as compras trocaram de cartao', por[m1] === y && por[m2] === x)
})
await cenario('7c. Movimentacoes opostas sem auth.uid() (trigger de linha: origem e destino em ordem)', async () => {
  const u = await novoUsuario(); const x = await novoCartao(u, 'X'); const y = await novoCartao(u, 'Y')
  const m1 = await novaCompra(u, x, 'Vai para Y', 100)
  const m2 = await novaCompra(u, y, 'Vai para X', 200)
  const W1 = await abrir(u, { papel: 'dono' }); const W2 = await abrir(u, { papel: 'dono' })
  const a = (await W1.q(`SELECT auth.uid() AS u`)).linhas[0].u
  ok('7c: sessoes sem auth.uid() (como service role/SQL Editor)', a === null)
  const r1 = await W1.q(`UPDATE public.compras_cartao SET cartao_id = $1 WHERE id = $2`, [y, m1])
  const p2 = W2.q(`UPDATE public.compras_cartao SET cartao_id = $1 WHERE id = $2`, [x, m2])
  await aguardarBloqueio(W2, p2, '7c W2 espera W1 pelo trigger de linha')
  await W1.commit()
  const r2 = await p2
  ok('7c: sem deadlock (40P01)', !r1.erro && !r2.erro, `${r1.erro || ''} ${r2.erro || ''}`)
  await W2.commit()
})
await cenario('7d. DELETE em massa (como zerar_dados_financeiros) x pagamento em outro cartao do usuario', async () => {
  const u = await novoUsuario(); const x = await novoCartao(u, 'X'); const y = await novoCartao(u, 'Y')
  await novaCompra(u, x, 'A', 1000); await novaCompra(u, y, 'B', 800)
  const W = await abrir(u)
  const rw = await W.q(`DELETE FROM public.compras_cartao WHERE usuario_id = $1`, [u])
  ok('7d: DELETE em massa aceito', !rw.erro && rw.n === 2, rw.erro || '')
  const PY = await abrir(u)
  const pY = PY.q(SQL_PAGAR, [y, CICLO, 800, 800, chave()])
  await aguardarBloqueio(PY, pY, '7d pagar em Y (statement trigger trava todos os cartoes do usuario)')
  await W.commit()
  const rY = await pY
  ok('7d: pagamento abortado (total foi a zero): 40001', rY.code === '40001', `(${rY.code} ${rY.erro || ''})`)
  await PY.rollback()
})

// (8) Repeticao apos conflito: coberta em cada escritaDuranteOPagamento (mesma chave, novo total, idempotente).
await cenario('8. Repeticao apos conflito: mesma chave, total releido, 1 unico pagamento', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  await novaCompra(u, c, 'Mercado', 1000)
  const k = chave()
  const W = await abrir(u)
  await W.q(`INSERT INTO public.compras_cartao (usuario_id, cartao_id, descricao, valor_total, data_compra, numero_parcelas) VALUES ($1, $2, 'Nova', 250, '2026-10-06', 1)`, [u, c])
  const P = await abrir(u)
  const pP = P.q(SQL_PAGAR, [c, CICLO, 1000, 1000, k])
  await aguardarBloqueio(P, pP, '8')
  await W.commit()
  const r = await pP
  ok('8: primeira tentativa abortada com 40001', r.code === '40001', `(${r.code})`)
  await P.rollback()
  const novo = await totalAdmin(u, c)
  const P2 = await abrir(u)
  const r2 = await P2.q(SQL_PAGAR, [c, CICLO, novo, novo, k])
  await P2.commit()
  const P3 = await abrir(u)
  const r3 = await P3.q(SQL_PAGAR, [c, CICLO, novo, novo, k])
  await P3.commit()
  ok('8: retentativas com a mesma chave devolvem o mesmo pagamento', !r2.erro && !r3.erro && r2.linhas[0].id === r3.linhas[0].id, `${r2.erro || ''} ${r3.erro || ''}`)
  ok('8: uma unica linha, valor = total relido (1250)', (await qtdPagamentos(c)) === 1 && centavos(await somaPagamentos(c)) === 125000)
})

// (9) Escrita direta sem auth.uid() tambem serializa (trigger de linha)
await cenario('9. Escrita direta sem auth.uid() (dono/service) serializa com pagar', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  await novaCompra(u, c, 'Mercado', 1000)
  const b = await novaCompra(u, c, 'Farmacia', 500)
  await escritaDuranteOPagamento({ nome: '9 DELETE como dono', u, cartao: c, totalAntigo: 1500, totalNovo: 1000, papelEscritor: 'dono',
    escrever: async W => {
      const a = (await W.q(`SELECT auth.uid() AS u`)).linhas[0].u
      ok('9: escritor sem auth.uid() (service role/SQL Editor)', a === null)
      return W.q(`DELETE FROM public.compras_cartao WHERE id = $1`, [b])
    } })
})

// (10) authenticated nao executa o helper de lock
await cenario('10. authenticated nao executa travar_cartoes_fatura nem as funcoes de trigger', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  const S = await abrir(u)
  const r = await S.q(`SELECT public.travar_cartoes_fatura(ARRAY[$1::uuid], $2::uuid)`, [c, u])
  ok('10: EXECUTE negado (42501)', r.code === '42501', `(${r.code} ${r.erro || ''})`)
  await S.rollback()
  const A = await abrir(u, { papel: 'dono' })
  const r2 = await A.q(`SELECT has_function_privilege('authenticated', 'public.travar_cartoes_fatura(uuid[],uuid)', 'EXECUTE') AS a, has_function_privilege('anon', 'public.travar_cartoes_fatura(uuid[],uuid)', 'EXECUTE') AS b`)
  ok('10: nem authenticated nem anon tem EXECUTE', r2.linhas[0].a === false && r2.linhas[0].b === false)
  const r3 = await A.q(`SELECT count(*)::int AS n FROM pg_trigger t JOIN pg_class k ON k.oid = t.tgrelid WHERE NOT t.tgisinternal AND k.relname IN ('compras_cartao','parcelamentos','faturas_cartao','cartoes') AND t.tgname IN ('aa_fatura_travar_usuario','aa_fatura_travar_cartao')`)
  ok('10: 7 triggers de serializacao presentes (6 nas tabelas do total + 1 em cartoes)', r3.linhas[0].n === 7)
  await A.rollback()
})

// (11) Isolamento diferente de READ COMMITTED e recusado
await cenario('11. pagar_fatura_cartao recusa REPEATABLE READ e SERIALIZABLE', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  await novaCompra(u, c, 'Mercado', 1000)
  for (const iso of ['REPEATABLE READ', 'SERIALIZABLE']) {
    const S = await abrir(u, { isolamento: iso })
    const r = await S.q(SQL_PAGAR, [c, CICLO, 100, 1000, chave()])
    ok(`11: ${iso} recusado (25006)`, r.code === '25006', `(${r.code} ${r.erro || ''})`)
    await S.rollback()
  }
  ok('11: nenhum pagamento gravado', (await qtdPagamentos(c)) === 0)
})

// (12) Estorno serializa pela mesma ordem (cartao -> pagamento)
await cenario('12. estornar x pagar concorrentes no mesmo cartao sem deadlock', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  await novaCompra(u, c, 'Mercado', 1000)
  const S0 = await abrir(u)
  const r0 = await S0.q(SQL_PAGAR, [c, CICLO, 600, 1000, chave()])
  await S0.commit()
  const E = await abrir(u); const P = await abrir(u)
  const rE = await E.q(`SELECT * FROM public.estornar_pagamento_fatura($1)`, [r0.linhas[0].id])
  ok('12: estorno aceito (sessao aberta)', !rE.erro, rE.erro || '')
  const pP = P.q(SQL_PAGAR, [c, CICLO, 1000, 1000, chave()])
  await aguardarBloqueio(P, pP, '12 pagar espera estorno')
  await E.commit()
  const rP = await pP
  ok('12: pagamento de 1000 aceito apos o estorno (em aberto voltou a 1000)', !rP.erro, rP.erro || '')
  await P.commit()
  ok('12: soma ativa = 1000', centavos(await somaPagamentos(c)) === 100000)
})

// ============================================================
// Lacunas da revisao v5. Estes cenarios provam (ou refutam) o que o cabecalho da migration afirma.
const ordenar = (a, b) => (a < b ? [a, b] : [b, a])
const INS_COMPRA = `INSERT INTO public.compras_cartao (usuario_id, cartao_id, descricao, valor_total, data_compra, numero_parcelas) VALUES ($1, $2, 'Nova', 300, '2026-10-06', 1)`

// (13) DELETE de cartao com cascata: nao inverte a ordem de locks e serializa com pagar
await cenario('13a. DELETE de cartao (cascata) concorrente com DML do mesmo usuario: serializam e ambas concluem', async () => {
  for (let rodada = 1; rodada <= 5; rodada++) {
    const u = await novoUsuario()
    const [lo, hi] = ordenar(await novoCartao(u, 'A'), await novoCartao(u, 'B'))
    await novaCompra(u, lo, 'No menor', 100); await novaCompra(u, hi, 'No maior', 200)
    const D = await abrir(u); const W = await abrir(u)
    // D exclui o cartao de MAIOR id (cascata em compras_cartao) e segura os locks; W escreve no de MENOR id.
    const rd = await D.q(`DELETE FROM public.cartoes WHERE id = $1`, [hi])
    ok(`13a rodada ${rodada}: DELETE aceito`, !rd.erro, rd.erro || '')
    const pW = W.q(INS_COMPRA, [u, lo])
    const bloqueou = await aguardarBloqueio(W, pW, `13a rodada ${rodada} W espera D`)
    await D.commit() // a primeira sessao commita ANTES de aguardar a segunda
    const rw = await pW
    ok(`13a rodada ${rodada}: ambas concluem, sem 40P01 e sem 55P03`, bloqueou && !rd.erro && !rw.erro, `(D ${rd.code || 'ok'} ${rd.erro || ''}; W ${rw.code || 'ok'} ${rw.erro || ''})`)
    await W.commit()
  }
})
await cenario('13b. Pagamento aberto x DELETE de cartao: exclusao espera o commit e, com pagamento ativo, e recusada (FP001)', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  await novaCompra(u, c, 'Mercado', 1000)
  const P = await abrir(u)
  const rp = await P.q(SQL_PAGAR, [c, CICLO, 400, 1000, chave()])
  ok('13b: pagamento de 400 aceito (sessao aberta)', !rp.erro, rp.erro || '')
  const D = await abrir(u)
  const pD = D.q(`DELETE FROM public.cartoes WHERE id = $1`, [c])
  await aguardarBloqueio(D, pD, '13b DELETE cartoes espera pagar')
  await P.commit()
  const rd = await pD
  // Integridade historica (000002): cartao com pagamento ativo nao pode ser excluido.
  ok('13b: exclusao recusada apos o commit do pagamento (FP001), sem 40P01', rd.code === 'FP001', `(${rd.code} ${rd.erro || 'sem erro'})`)
  await D.rollback()
  ok('13b: cartao e pagamento permanecem', (await admin.query(`SELECT count(*)::int AS n FROM public.cartoes WHERE id = $1`, [c])).rows[0].n === 1 && (await qtdPagamentos(c)) === 1)
})
await cenario('13c. DELETE de cartao em andamento x pagar: pagar espera e recusa cartao inexistente', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  await novaCompra(u, c, 'Mercado', 1000)
  const D = await abrir(u)
  const rd = await D.q(`DELETE FROM public.cartoes WHERE id = $1`, [c])
  ok('13c: DELETE aceito', !rd.erro, rd.erro || '')
  const P = await abrir(u)
  const pP = P.q(SQL_PAGAR, [c, CICLO, 1000, 1000, chave()])
  await aguardarBloqueio(P, pP, '13c pagar espera DELETE do cartao')
  await D.commit()
  const rp = await pP
  ok('13c: pagar recusado (cartao nao encontrado, 42501), sem 40P01', rp.code === '42501', `(${rp.code} ${rp.erro || ''})`)
  await P.rollback()
})

// (14) zerar_dados_financeiros REAL (RPC), nas duas direcoes
await cenario('14a. Pagamento aberto x zerar_dados_financeiros: zerar espera, conclui e o total pode ficar abaixo do pago', async () => {
  const u = await novoUsuario(); const x = await novoCartao(u, 'X'); const y = await novoCartao(u, 'Y')
  await novaCompra(u, x, 'A', 1000); await novaCompra(u, y, 'B', 800)
  await novoParcelamento(u, x, 'Notebook', 600, 3)
  const P = await abrir(u)
  const rp = await P.q(SQL_PAGAR, [x, CICLO, 400, 1200, chave()])
  ok('14a: pagamento de 400 aceito (sessao aberta)', !rp.erro, rp.erro || '')
  const Z = await abrir(u)
  const pZ = Z.q(`SELECT public.zerar_dados_financeiros()`)
  await aguardarBloqueio(Z, pZ, '14a zerar_dados_financeiros espera o pagamento')
  await P.commit()
  const rz = await pZ
  ok('14a: zerar_dados_financeiros concluiu (nao e bloqueado por pagamento ja feito), sem 40P01', !rz.erro, `(${rz.code} ${rz.erro || ''})`)
  await Z.commit()
  const n = (await admin.query(`SELECT (SELECT count(*) FROM public.compras_cartao WHERE usuario_id = $1)::int AS c, (SELECT count(*) FROM public.parcelamentos WHERE usuario_id = $1)::int AS p`, [u])).rows[0]
  ok('14a: compras e parcelamentos zerados', n.c === 0 && n.p === 0, JSON.stringify(n))
})
await cenario('14b. zerar_dados_financeiros em andamento x pagar: pagar espera e nao grava pagamento acima do total', async () => {
  const u = await novoUsuario(); const x = await novoCartao(u, 'X'); await novoCartao(u, 'Y')
  await novaCompra(u, x, 'A', 1000)
  const Z = await abrir(u)
  const rz = await Z.q(`SELECT public.zerar_dados_financeiros()`)
  ok('14b: zerar aceito (sessao aberta)', !rz.erro, rz.erro || '')
  const P = await abrir(u)
  const pP = P.q(SQL_PAGAR, [x, CICLO, 1000, 1000, chave()])
  await aguardarBloqueio(P, pP, '14b pagar espera zerar')
  await Z.commit()
  const rp = await pP
  ok('14b: pagamento recusado (40001, 22003 ou 42501 se o cartao foi removido)', ['40001', '22003', '42501'].includes(rp.code), `(${rp.code} ${rp.erro || ''})`)
  await P.rollback()
  ok('14b: nenhum pagamento gravado', (await qtdPagamentos(x)) === 0)
})

// (15) parcelamentos.cartao_id NULL (coluna nullable)
await cenario('15. parcelamentos.cartao_id nulo: INSERT/UPDATE nulo <-> cartao funcionam e serializam', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  await novaCompra(u, c, 'Mercado', 1000)
  const S = await abrir(u)
  const ri = await S.q(`INSERT INTO public.parcelamentos (usuario_id, cartao_id, descricao, valor_total, numero_parcelas, primeira_parcela) VALUES ($1, NULL, 'Sem cartao', 300, 3, '2026-10-05') RETURNING id`, [u])
  ok('15: INSERT com cartao_id nulo aceito (trigger tolera NULL)', !ri.erro, ri.erro || '')
  await S.commit()
  const pid = ri.linhas[0].id
  ok('15: parcelamento sem cartao nao entra no total do cartao (1000)', centavos(await totalAdmin(u, c)) === 100000)
  await escritaDuranteOPagamento({ nome: '15 UPDATE nulo -> cartao', u, cartao: c, totalAntigo: 1000, totalNovo: 1100,
    escrever: W => W.q(`UPDATE public.parcelamentos SET cartao_id = $1 WHERE id = $2`, [c, pid]) })
  const u2 = await novoUsuario(); const c2 = await novoCartao(u2)
  await novaCompra(u2, c2, 'Mercado', 1000)
  const p2 = await novoParcelamento(u2, c2, 'TV', 300, 3)
  await escritaDuranteOPagamento({ nome: '15 UPDATE cartao -> nulo', u: u2, cartao: c2, totalAntigo: 1100, totalNovo: 1000,
    escrever: W => W.q(`UPDATE public.parcelamentos SET cartao_id = NULL WHERE id = $1`, [p2]) })
})

// (16) UPDATE de cartoes.dia_fechamento durante pagamento (muda o ciclo das compras)
await cenario('16. UPDATE cartoes.dia_fechamento durante pagamento: pagar espera a linha do cartao e recalcula', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  await novaCompra(u, c, 'Mercado', 1000) // 05/10, fechamento 20 => ciclo 2026-10
  const W = await abrir(u)
  const rw = await W.q(`UPDATE public.cartoes SET dia_fechamento = 3 WHERE id = $1`, [c]) // 05/10 > 3 => ciclo 2026-11
  ok('16: UPDATE dia_fechamento aceito', !rw.erro, rw.erro || '')
  const P = await abrir(u)
  const pP = P.q(SQL_PAGAR, [c, CICLO, 1000, 1000, chave()])
  await aguardarBloqueio(P, pP, '16 pagar espera UPDATE em cartoes')
  await W.commit()
  const rp = await pP
  ok('16: pagamento do total antigo abortado (40001): o ciclo mudou', rp.code === '40001', `(${rp.code} ${rp.erro || ''})`)
  await P.rollback()
  ok('16: total do ciclo 2026-10 agora e 0 e nada foi pago', centavos(await totalAdmin(u, c)) === 0 && (await qtdPagamentos(c)) === 0)
})

// (17) Repeticao apos 55P03 (lock_timeout) e apos 40P01 (deadlock), com a MESMA idempotency_key
await cenario('17a. Repeticao apos 55P03: lock_timeout curto, mesma chave, 1 pagamento', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  await novaCompra(u, c, 'Mercado', 1000)
  const k = chave()
  const W = await abrir(u)
  await W.q(`UPDATE public.cartoes SET nome = nome WHERE id = $1`, [c]) // segura a linha do cartao
  const P = await abrir(u)
  await P.q(`SET LOCAL lock_timeout = '400ms'`)
  const r = await P.q(SQL_PAGAR, [c, CICLO, 1000, 1000, k])
  ok('17a: tentativa 1 falha com 55P03 (lock_timeout)', r.code === '55P03', `(${r.code} ${r.erro || ''})`)
  await P.rollback()
  await W.commit()
  const P2 = await abrir(u)
  const r2 = await P2.q(SQL_PAGAR, [c, CICLO, 1000, 1000, k])
  ok('17a: repeticao com a mesma chave aceita', !r2.erro, r2.erro || '')
  await P2.commit()
  const P3 = await abrir(u)
  const r3 = await P3.q(SQL_PAGAR, [c, CICLO, 1000, 1000, k])
  await P3.commit()
  ok('17a: repetir de novo devolve o mesmo pagamento; 1 linha', !r3.erro && r3.linhas[0].id === r2.linhas[0].id && (await qtdPagamentos(c)) === 1, r3.erro || '')
})
await cenario('17b. Repeticao apos 40P01: deadlock provocado por lock manual fora do mecanismo (limite documentado)', async () => {
  const u = await novoUsuario(); const [x, y] = ordenar(await novoCartao(u, 'X'), await novoCartao(u, 'Y'))
  await novaCompra(u, x, 'Mercado', 1000)
  const k = chave()
  const S = await abrir(u, { papel: 'dono' })
  await S.q(`SELECT 1 FROM public.cartoes WHERE id = $1 FOR UPDATE`, [x]) // S segura X (lock manual)
  const P = await abrir(u)
  await P.q(`SELECT 1 FROM public.cartoes WHERE id = $1 FOR UPDATE`, [y]) // P segura Y (lock manual, fora da ordem)
  const pP = P.q(SQL_PAGAR, [x, CICLO, 1000, 1000, k]) // P espera X
  await aguardarBloqueio(P, pP, '17b P espera X')
  const pS = S.q(`SELECT 1 FROM public.cartoes WHERE id = $1 FOR UPDATE`, [y]) // S espera Y => ciclo
  const [rP, rS] = await Promise.all([pP, pS])
  const vitimas = [rP, rS].filter(r => r.code === '40P01').length
  ok('17b: exatamente uma transacao foi vitima de 40P01 (conflito abortado com seguranca)', vitimas === 1, `(P ${rP.code || 'ok'}; S ${rS.code || 'ok'})`)
  if (rP.code === '40P01') await P.rollback(); else await P.commit()
  await S.rollback()
  const P2 = await abrir(u)
  const r2 = await P2.q(SQL_PAGAR, [x, CICLO, 1000, 1000, k])
  ok('17b: repeticao com a mesma chave aceita (ou devolve o pagamento ja gravado)', !r2.erro, r2.erro || '')
  await P2.commit()
  ok('17b: exatamente 1 pagamento de 1000, nunca acima do total', (await qtdPagamentos(x)) === 1 && centavos(await somaPagamentos(x)) === 100000)
})


// ============================================================
// Integridade historica das faturas pagas (migration 20261124000002).
// ESCRITOS, NAO EXECUTADOS no ambiente em que foram criados (sem PostgreSQL): PENDENTES ate rodar com PG_TEST_URL.
const SQL_ALTERAR = `SELECT public.alterar_historico_fatura($1, $2, $3, $4::jsonb, $5) AS r`

await cenario('18a. pagar x alterar_historico_fatura no mesmo cartao serializa (pagar espera e recusa total antigo)', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  const b = await novaCompra(u, c, 'Mercado', 1000)
  const S0 = await abrir(u)
  const r0 = await S0.q(SQL_PAGAR, [c, CICLO, 400, 1000, chave()])
  ok('18a: pagamento inicial de 400 aceito', !r0.erro, r0.erro || '')
  await S0.commit()
  const W = await abrir(u)
  const rw = await W.q(SQL_ALTERAR, ['compras_cartao', b, 'editar', JSON.stringify({ valor_total: 900 }), 'Correcao de valor'])
  ok('18a: alterar_historico_fatura aceito (sessao aberta)', !rw.erro && rw.linhas[0].r.ok === true, rw.erro || '')
  const P = await abrir(u)
  const k = chave()
  const pP = P.q(SQL_PAGAR, [c, CICLO, 600, 1000, k])
  await aguardarBloqueio(P, pP, '18a pagar espera alterar_historico_fatura')
  await W.commit()
  const rp = await pP
  ok('18a: pagamento com total antigo abortado (40001), sem 40P01', rp.code === '40001', `(${rp.code} ${rp.erro || 'sem erro'})`)
  await P.rollback()
  const P2 = await abrir(u)
  const r2 = await P2.q(SQL_PAGAR, [c, CICLO, 500, 900, k])
  ok('18a: repeticao com o total novo (900) e o saldo em aberto (500) aceita', !r2.erro, r2.erro || '')
  await P2.commit()
  ok('18a: soma dos pagamentos ativos = 900 = total', centavos(await somaPagamentos(c)) === 90000 && centavos(await totalAdmin(u, c)) === 90000)
  const aj = (await admin.query(`SELECT count(*)::int AS n FROM public.ajustes_fatura WHERE cartao_id = $1 AND tipo = 'edicao' AND via = 'controlado'`, [c])).rows[0].n
  ok('18a: 1 linha de auditoria via controlado', aj === 1, `(${aj})`)
})

await cenario('18b. DML direto em fatura quitada: FP001; concorrente com estorno, espera e depois e permitido (fatura reaberta)', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  const b = await novaCompra(u, c, 'Mercado', 1000)
  const S0 = await abrir(u)
  const r0 = await S0.q(SQL_PAGAR, [c, CICLO, 1000, 1000, chave()])
  ok('18b: fatura de 1000 quitada', !r0.erro, r0.erro || '')
  await S0.commit()
  const D = await abrir(u)
  const rd = await D.q(`UPDATE public.compras_cartao SET valor_total = 900 WHERE id = $1`, [b])
  ok('18b: UPDATE direto em quitada recusado com SQLSTATE FP001', rd.code === 'FP001', `(${rd.code} ${rd.erro || 'sem erro'})`)
  await D.rollback()
  const E = await abrir(u)
  const re = await E.q(`SELECT * FROM public.estornar_pagamento_fatura($1, $2)`, [r0.linhas[0].id, 'Estorno de teste'])
  ok('18b: estorno aceito (sessao aberta, segura o lock do cartao)', !re.erro, re.erro || '')
  const W = await abrir(u)
  const pW = W.q(`UPDATE public.compras_cartao SET valor_total = 900 WHERE id = $1`, [b])
  await aguardarBloqueio(W, pW, '18b DML direto espera o estorno')
  await E.commit()
  const rw = await pW
  ok('18b: apos o commit do estorno a fatura esta aberta e o UPDATE direto e aceito', !rw.erro && rw.n === 1, `(${rw.code} ${rw.erro || 'sem erro'})`)
  await W.commit()
  const aj = (await admin.query(`SELECT tipo FROM public.ajustes_fatura WHERE cartao_id = $1 ORDER BY criado_em, id`, [c])).rows.map(x => x.tipo)
  ok('18b: razao tem estorno e nenhuma edicao (competencia sem pagamento ativo nao audita)', aj.includes('estorno') && !aj.includes('edicao'), JSON.stringify(aj))
})

await cenario('18c. zerar_dados_financeiros com fatura quitada x DML direto do mesmo usuario: zerar passa e o DML nao acha a linha', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u); await novoCartao(u, 'Outro')
  const b = await novaCompra(u, c, 'Mercado', 1000)
  const S0 = await abrir(u)
  const r0 = await S0.q(SQL_PAGAR, [c, CICLO, 1000, 1000, chave()])
  ok('18c: fatura de 1000 quitada', !r0.erro, r0.erro || '')
  await S0.commit()
  const Z = await abrir(u)
  const rz = await Z.q(`SELECT public.zerar_dados_financeiros() AS ok`)
  ok('18c: zerar_dados_financeiros aceito com fatura quitada (liberacao transacional)', !rz.erro && rz.linhas[0].ok === true, `(${rz.code} ${rz.erro || 'sem erro'})`)
  const W = await abrir(u)
  const pW = W.q(`UPDATE public.compras_cartao SET valor_total = 1 WHERE id = $1`, [b])
  await aguardarBloqueio(W, pW, '18c DML direto espera zerar')
  await Z.commit()
  const rw = await pW
  ok('18c: DML direto concluido sem erro e sem linhas (a compra foi zerada)', !rw.erro && rw.n === 0, `(${rw.code} ${rw.erro || 'sem erro'}; n=${rw.n})`)
  await W.commit()
  const n = (await admin.query(`SELECT (SELECT count(*) FROM public.pagamentos_fatura WHERE usuario_id = $1)::int AS p, (SELECT count(*) FROM public.ajustes_fatura WHERE usuario_id = $1)::int AS a, (SELECT count(*) FROM public.cartoes WHERE usuario_id = $1)::int AS c`, [u])).rows[0]
  ok('18c: pagamentos, ajustes e cartoes do usuario zerados', n.p === 0 && n.a === 0 && n.c === 0, JSON.stringify(n))
})

await cenario('18d. Liberacao nao forjavel: sem a transacao do zerar/controlado a guarda continua valendo (conexao real)', async () => {
  const u = await novoUsuario(); const c = await novoCartao(u)
  const b = await novaCompra(u, c, 'Mercado', 1000)
  const S0 = await abrir(u)
  await S0.q(SQL_PAGAR, [c, CICLO, 1000, 1000, chave()])
  await S0.commit()
  const L = await abrir(u)
  const rl = await L.q(`SELECT public.liberar_historico_zerar()`)
  ok('18d: liberar_historico_zerar solta aceita (inofensiva)', !rl.erro, rl.erro || '')
  await L.commit() // a liberacao fica commitada, mas com o txid da transacao encerrada
  const W = await abrir(u)
  const rw = await W.q(`UPDATE public.compras_cartao SET valor_total = 1 WHERE id = $1`, [b])
  ok('18d: DML direto em OUTRA transacao continua recusado (FP001)', rw.code === 'FP001', `(${rw.code} ${rw.erro || 'sem erro'})`)
  await W.rollback()
  const V = await abrir(u)
  const rv = await V.q(`SELECT count(*)::int AS n FROM public._fatura_liberacoes`)
  ok('18d: authenticated nao le _fatura_liberacoes (42501)', rv.code === '42501', `(${rv.code} ${rv.erro || 'sem erro'})`)
  await V.rollback()
})

// ---------- Encerramento ----------
for (const s of [...sessoesAbertas]) await s.rollback().catch(() => {})
await admin.end()
console.log(`\nCenarios executados em PostgreSQL ${sver}: ${cenariosRodados}; verificacoes: ${asserts}; falhas: ${falhas}`)
if (falhas > 0) {
  console.log(`FALHA nos cenarios: ${cenariosFalhos.join(' | ') || '(excecoes acima)'}`)
  process.exit(1)
}
console.log('OK - todos os cenarios rodaram em PostgreSQL real com sessoes concorrentes.')
process.exit(0)
