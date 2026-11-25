// Simulação isolada das migrations (PostgreSQL em memória via PGlite).
// Nada se conecta ao Supabase: cria um ambiente parecido (schemas auth e
// storage, papéis anon/authenticated, auth.uid()), aplica schema.sql e as
// migrations em ordem, reaplica as novas (idempotência) e testa RLS,
// permissões e restrições com dados FICTÍCIOS.
// Uso: npm run test:migrations
import { PGlite } from '@electric-sql/pglite'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'
import { readFileSync, readdirSync, existsSync } from 'fs'

const dir = new URL('../', import.meta.url)
// pgcrypto não existe no PGlite; gen_random_uuid() é nativo desde o PG 13.
const ler = p => readFileSync(new URL(p, dir), 'utf8').replace(/CREATE EXTENSION IF NOT EXISTS "?pgcrypto"?[^;]*;/gi, '-- (pgcrypto omitido na simulação)')
const NOVAS = ['2026-11_atalhos_home.sql', '2026-11_onboarding_perfil.sql', '2026-11_importacoes.sql', '2026-11_compras_cartao_cartao_do_dono.sql', '20261124000001_pagamentos_fatura.sql', '20261124000002_integridade_historica_fatura.sql']
const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'

let falhas = 0
const ok = (nome, cond, det = '') => { if (!cond) falhas++; console.log(`${cond ? 'PASS' : 'FALHA'} — ${nome} ${det}`) }

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
  -- Privilégios padrão do Supabase para tabelas novas em public.
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
`)

// 1) schema.sql + migrations em ordem de nome.
// Base: schema consolidado do staging (tabelas, funções/triggers, RLS e GRANT
// por coluna em perfis) quando disponível localmente; senão schema.sql.
const STAGING = ['1-SCHEMA-COMPLETO-STAGING.sql', '2-FUNCOES-TRIGGERS.sql', '3-POLITICAS-RLS.sql', '4-CATEGORIAS-INICIAIS.sql', 'MIGRATION-PERMISSOES-STAGING.sql']
const base = existsSync(new URL('../staging/1-SCHEMA-COMPLETO-STAGING.sql', dir)) ? STAGING.map(s => `../staging/${s}`) : ['schema.sql']
const arquivos = [...base, ...readdirSync(new URL('migrations/', dir)).filter(f => f.endsWith('.sql') && !/TESTES/i.test(f)).sort().map(f => `migrations/${f}`)]
const errosAnteriores = []
for (const arq of arquivos) {
  try { await db.exec(ler(arq)) } catch (e) {
    await db.exec('ROLLBACK').catch(() => {})
    const nova = NOVAS.some(n => arq.endsWith(n))
    if (nova) ok(`aplica ${arq}`, false, `→ ${e.message}`)
    else errosAnteriores.push(`${arq}: ${e.message.split('\n')[0]}`)
  }
}
for (const n of NOVAS) {
  if (n === '20261124000001_pagamentos_fatura.sql') {
    // Com a 000002 aplicada, reaplicar a 000001 deve FALHAR de forma explicita (senao restauraria o estorno sem auditoria).
    let msg = ''
    try { await db.exec(ler(`migrations/${n}`)) } catch (e) { msg = e.message; await db.exec('ROLLBACK').catch(() => {}) }
    ok(`reaplicar ${n} depois da 000002 falha de forma explicita`, /20261124000002/.test(msg) && /Não reaplique a 000001/.test(msg), msg.split('\n')[0])
    continue
  }
  try { await db.exec(ler(`migrations/${n}`)); ok(`reaplicar ${n} (idempotente)`, true) } catch (e) { ok(`reaplicar ${n} (idempotente)`, false, `→ ${e.message}`) }
}
if (errosAnteriores.length) console.log(`\n(aviso) migrations antigas com dependências fora da simulação:\n  ${errosAnteriores.join('\n  ')}\n`)

// Dados fictícios
// O schema consolidado do staging usa cor_tema padrão 'auto', recusado pelo
// CHECK de 2026-10_cor_tema_modos (claro/escuro/automatico): na simulação,
// alinha o padrão ao da migration antes de criar os usuários fictícios.
// O schema do staging ainda tem o CHECK antigo de cores (azul/rosa/...);
// alinha ao formato atual (claro/escuro/automatico) só na simulação.
await db.exec(`ALTER TABLE public.perfis DROP CONSTRAINT IF EXISTS perfis_cor_tema_check;
  ALTER TABLE public.perfis ALTER COLUMN cor_tema SET DEFAULT 'claro';
  ALTER TABLE public.perfis ADD CONSTRAINT perfis_cor_tema_check CHECK (cor_tema IS NULL OR cor_tema IN ('claro', 'escuro', 'automatico'))`)
// O trigger de novo usuário do staging grava cor_tema = 'auto': cria os
// usuários fictícios com triggers desligados e o perfil explicitamente.
await db.exec(`SET session_replication_role = replica`)
await db.exec(`INSERT INTO auth.users (id, email) VALUES ('${A}', 'a@exemplo.invalid'), ('${B}', 'b@exemplo.invalid') ON CONFLICT DO NOTHING;
  INSERT INTO public.perfis (id, nome, email) VALUES ('${A}', 'A', 'a@exemplo.invalid'), ('${B}', 'B', 'b@exemplo.invalid') ON CONFLICT DO NOTHING;`)
await db.exec(`SET session_replication_role = origin`) // triggers e FKs voltam a valer

// Executa como usuário autenticado (RLS ativa).
async function como(uid, sql, params) {
  await db.exec('BEGIN')
  try {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)`, [uid || '', uid ? 'authenticated' : 'anon'])
    await db.exec(`SET LOCAL ROLE ${uid ? 'authenticated' : 'anon'}`)
    const r = await db.query(sql, params)
    await db.exec('COMMIT')
    return { linhas: r.rows, afetadas: r.affectedRows ?? 0 }
  } catch (e) { await db.exec('ROLLBACK'); return { erro: e.message, code: e.code } }
}
// Executa como service_role (sem auth.uid()): papel de cliente com privilégio de DML, usado para provar os triggers de imutabilidade.
async function comoServico(sql, params) {
  await db.exec('BEGIN')
  try {
    await db.exec('SET LOCAL ROLE service_role')
    const r = await db.query(sql, params)
    await db.exec('COMMIT')
    return { linhas: r.rows, afetadas: r.affectedRows ?? 0 }
  } catch (e) { await db.exec('ROLLBACK'); return { erro: e.message, code: e.code } }
}

console.log('\n# perfis: atalhos_home, objetivos_financeiros, onboarding_etapa')
let r = await como(A, `UPDATE public.perfis SET atalhos_home = $1 WHERE id = $2`, [JSON.stringify({ versao: 2, ordem: ['receitas'], ocultos: [], favoritos: [] }), A])
ok('A grava a própria config de atalhos', !r.erro && r.afetadas === 1, r.erro || '')
r = await como(A, `UPDATE public.perfis SET atalhos_home = '[1,2]' WHERE id = $1`, [A])
ok('atalhos_home precisa ser objeto JSON', !!r.erro)
r = await como(A, `UPDATE public.perfis SET atalhos_home = $1 WHERE id = $2`, [JSON.stringify({ x: 'y'.repeat(5000) }), A])
ok('atalhos_home acima de 4 KB recusado', !!r.erro)
r = await como(B, `UPDATE public.perfis SET atalhos_home = '{}' WHERE id = $1`, [A])
ok('B não altera o perfil de A', !r.erro ? r.afetadas === 0 : true, r.erro || '')
r = await como(A, `UPDATE public.perfis SET objetivos_financeiros = ARRAY['economizar','reserva'], onboarding_etapa = 'despesas' WHERE id = $1`, [A])
ok('A grava objetivos e etapa válidos', !r.erro && r.afetadas === 1, r.erro || '')
r = await como(A, `UPDATE public.perfis SET objetivos_financeiros = ARRAY['hack'] WHERE id = $1`, [A])
ok('objetivo inválido recusado', !!r.erro)
r = await como(A, `UPDATE public.perfis SET onboarding_etapa = 'final' WHERE id = $1`, [A])
ok('etapa inválida recusada', !!r.erro)
r = await como(A, `UPDATE public.perfis SET onboarding_etapa = NULL WHERE id = $1`, [A])
ok('etapa NULL (concluído) aceita', !r.erro && r.afetadas === 1, r.erro || '')
const telas = ['perfil', 'saldo', 'renda', 'beneficios', 'despesas', 'cartoes', 'importacao', 'metas', 'reserva', 'personalizacao', 'notificacoes']
let todas = true
for (const t of telas) { const x = await como(A, `UPDATE public.perfis SET onboarding_etapa = $1 WHERE id = $2`, [t, A]); if (x.erro) todas = false }
ok('todas as telas do onboarding são aceitas', todas)
r = await como(null, `UPDATE public.perfis SET atalhos_home = '{}' WHERE id = $1`, [A])
ok('anônimo não altera perfis', !!r.erro || r.afetadas === 0)

console.log('\n# importacoes / importacoes_itens')
r = await como(A, `INSERT INTO public.importacoes (usuario_id, contexto, formato, qtd_lidas, qtd_importadas) VALUES ($1, 'extrato', 'csv', 10, 8) RETURNING id`, [A])
ok('A registra uma importação', !r.erro, r.erro || '')
const impA = r.linhas?.[0]?.id
r = await como(A, `INSERT INTO public.importacoes_itens (importacao_id, usuario_id, chave, destino_tabela) VALUES ($1, $2, 'abc123', 'despesas')`, [impA, A])
ok('A registra item', !r.erro, r.erro || '')
r = await como(A, `INSERT INTO public.importacoes_itens (importacao_id, usuario_id, chave, destino_tabela) VALUES ($1, $2, 'abc123', 'despesas')`, [impA, A])
ok('chave repetida recusada (sem duplicar)', !!r.erro)
r = await como(A, `INSERT INTO public.importacoes_itens (importacao_id, usuario_id, chave, destino_tabela) VALUES ($1, $2, 'abc123', 'despesas') ON CONFLICT (usuario_id, chave) DO NOTHING`, [impA, A])
ok('upsert ignorando duplicadas funciona com a policy de INSERT', !r.erro && r.afetadas === 0, r.erro || '')
r = await como(B, `SELECT count(*)::int AS n FROM public.importacoes`)
ok('B não vê importações de A', !r.erro && r.linhas[0].n === 0)
r = await como(B, `INSERT INTO public.importacoes (usuario_id, contexto, formato) VALUES ($1, 'extrato', 'csv')`, [A])
ok('B não cria importação em nome de A', !!r.erro)
r = await como(B, `INSERT INTO public.importacoes_itens (importacao_id, usuario_id, chave, destino_tabela) VALUES ($1, $2, 'zzz999', 'despesas')`, [impA, B])
ok('B não vincula item à importação de A (FK composta)', !!r.erro)
r = await como(B, `INSERT INTO public.importacoes_itens (importacao_id, usuario_id, chave, destino_tabela) VALUES ($1, $2, 'abc123', 'despesas')`, [impA, A])
ok('B não insere item em nome de A', !!r.erro)
r = await como(A, `UPDATE public.importacoes SET qtd_importadas = 999 WHERE id = $1`, [impA])
ok('histórico não pode ser alterado (sem UPDATE)', !!r.erro || r.afetadas === 0)
r = await como(B, `DELETE FROM public.importacoes WHERE id = $1`, [impA])
ok('B não apaga histórico de A', !r.erro && r.afetadas === 0, r.erro || '')
r = await como(null, `SELECT count(*) FROM public.importacoes`)
ok('anônimo sem acesso', !!r.erro)
r = await como(A, `INSERT INTO public.importacoes (usuario_id, contexto, formato) VALUES ($1, 'outro', 'csv')`, [A])
ok('contexto inválido recusado', !!r.erro)
r = await como(A, `INSERT INTO public.importacoes_itens (importacao_id, usuario_id, chave, destino_tabela) VALUES ($1, $2, 'k9k9k9', 'perfis')`, [impA, A])
ok('destino inválido recusado', !!r.erro)
r = await como(A, `DELETE FROM public.importacoes WHERE id = $1`, [impA])
ok('A apaga o próprio histórico', !r.erro && r.afetadas === 1, r.erro || '')
r = await db.query(`SELECT count(*)::int AS n FROM public.importacoes_itens`)
ok('itens apagados em cascata', r.rows[0].n === 0)
r = await db.query(`SELECT indexname FROM pg_indexes WHERE tablename IN ('importacoes', 'importacoes_itens')`)
const idx = r.rows.map(x => x.indexname)
r = await db.query(`SELECT has_table_privilege('authenticated','public.importacoes','UPDATE') u, has_table_privilege('authenticated','public.importacoes','TRUNCATE') t, has_table_privilege('anon','public.importacoes','SELECT') a`)
ok('sem UPDATE/TRUNCATE para authenticated e sem acesso anônimo', !r.rows[0].u && !r.rows[0].t && !r.rows[0].a)
r = await db.query(`SELECT has_column_privilege('authenticated','public.perfis','atalhos_home','UPDATE') a, has_column_privilege('authenticated','public.perfis','onboarding_etapa','UPDATE') b`)
ok('UPDATE por coluna concedido nas colunas novas de perfis', r.rows[0].a && r.rows[0].b)
ok('índices criados', idx.includes('idx_importacoes_usuario') && idx.includes('idx_importacoes_itens_importacao') && idx.includes('importacoes_itens_chave_unica'))
console.log('\n# compras_cartao: cartão precisa ser do próprio usuário')
r = await como(A, `INSERT INTO public.cartoes (usuario_id, nome, limite_total, dia_fechamento, dia_vencimento) VALUES ($1, 'Cartão A', 5000, 20, 28) RETURNING id`, [A])
ok('A cria o próprio cartão', !r.erro, r.erro || '')
const cartaoA = r.linhas?.[0]?.id
r = await como(B, `INSERT INTO public.cartoes (usuario_id, nome, limite_total, dia_fechamento, dia_vencimento) VALUES ($1, 'Cartão B', 3000, 10, 17) RETURNING id`, [B])
const cartaoB = r.linhas?.[0]?.id
r = await como(A, `INSERT INTO public.compras_cartao (usuario_id, cartao_id, descricao, valor_total, data_compra, numero_parcelas) VALUES ($1, $2, 'Mercado', 300, '2026-11-12', 1) RETURNING id`, [A, cartaoA])
ok('A grava compra no próprio cartão', !r.erro, r.erro || '')
const compraA = r.linhas?.[0]?.id
r = await como(A, `INSERT INTO public.compras_cartao (usuario_id, cartao_id, descricao, valor_total, data_compra) VALUES ($1, $2, 'Indevida', 10, '2026-11-12')`, [A, cartaoB])
ok('A não grava compra no cartão de B', !!r.erro)
r = await como(A, `UPDATE public.compras_cartao SET cartao_id = $1 WHERE id = $2`, [cartaoB, compraA])
ok('A não move a compra para o cartão de B', !!r.erro || r.afetadas === 0)
r = await como(A, `UPDATE public.compras_cartao SET valor_total = 350 WHERE id = $1`, [compraA])
ok('A edita a própria compra', !r.erro && r.afetadas === 1, r.erro || '')
r = await como(B, `SELECT count(*)::int AS n FROM public.compras_cartao`)
ok('B não vê compras de A', !r.erro && r.linhas[0].n === 0, r.erro || '')
r = await como(B, `DELETE FROM public.compras_cartao WHERE id = $1`, [compraA])
ok('B não apaga compra de A', !r.erro && r.afetadas === 0, r.erro || '')
r = await como(A, `INSERT INTO public.compras_cartao (usuario_id, cartao_id, descricao, valor_total, data_compra) VALUES ($1, NULL, 'Sem cartão', 10, '2026-11-12')`, [A])
ok('compra sem cartão recusada', !!r.erro)
r = await db.query(`SELECT cmd, count(*)::int AS n FROM pg_policies WHERE tablename = 'compras_cartao' GROUP BY cmd ORDER BY cmd`)
const porCmd = Object.fromEntries(r.rows.map(x => [x.cmd, x.n]))
ok('uma política por operação (sem FOR ALL residual)', !porCmd.ALL && porCmd.SELECT === 1 && porCmd.INSERT === 1 && porCmd.UPDATE === 1 && porCmd.DELETE === 1, JSON.stringify(porCmd))
r = await como(A, `DELETE FROM public.compras_cartao WHERE id = $1`, [compraA])
ok('A apaga a própria compra', !r.erro && r.afetadas === 1, r.erro || '')

console.log('\n# pagamentos_fatura: RPCs transacionais, duplicidade, estorno e RLS (SIMULADO em PGlite)')
// Data de Sao_Paulo, a mesma que a RPC compara (toISOString seria UTC).
const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
// Dados do servidor: o teto vem de compras_cartao (o total do cliente e so uma dica).
const semear = (usuario, cartao, descricao, valor, data, parcelas = 1) => db.query(
  `INSERT INTO public.compras_cartao (usuario_id, cartao_id, descricao, valor_total, data_compra, numero_parcelas) VALUES ($1, $2, $3, $4, $5, $6)`,
  [usuario, cartao, descricao, valor, data, parcelas])
await semear(A, cartaoA, 'Ciclo 2026-11', 1000, '2026-11-05')
await semear(A, cartaoA, 'Ciclo 2026-12', 500, '2026-12-05')
await semear(A, cartaoA, 'Ciclo 2027-01', 500, '2027-01-05')
await semear(A, cartaoA, 'Ciclo 2027-02', 100, '2027-02-05')
await semear(B, cartaoB, 'Ciclo B 2026-11', 500, '2026-11-05')
const pagar = (uid, cartao, ym, valor, key, total = 1000, origem = 'saldo_principal', data = hoje) =>
  como(uid, `SELECT * FROM public.pagar_fatura_cartao($1, $2, $3, $4, $5, NULL, $6, $7)`, [cartao, ym, valor, data, origem, total, key])
r = await pagar(A, cartaoA, '2026-11', 400, 'chave-parcial-1')
ok('pagamento parcial (400 de 1000) aceito', !r.erro && r.linhas[0].status === 'ativo' && Number(r.linhas[0].valor) === 400, r.erro || '')
const pgParcial = r.linhas?.[0]?.id
r = await pagar(A, cartaoA, '2026-11', 400, 'chave-parcial-1')
ok('mesma chave de idempotência devolve o mesmo pagamento (sem duplicar)', !r.erro && r.linhas[0].id === pgParcial, r.erro || '')
r = await como(A, `SELECT count(*)::int AS n FROM public.pagamentos_fatura WHERE cartao_id = $1`, [cartaoA])
ok('apenas 1 linha apos repeticao', r.linhas[0].n === 1)
r = await pagar(A, cartaoA, '2026-11', 500, 'chave-parcial-1')
ok('mesma chave com valor diferente recusada', !!r.erro)
r = await pagar(A, cartaoA, '2026-11', 700, 'chave-excesso-1')
ok('valor acima do saldo em aberto (600) recusado', !!r.erro, r.erro || '')
r = await pagar(A, cartaoA, '2026-11', 600, 'chave-restante-1')
ok('quitar o restante (600) aceito', !r.erro, r.erro || '')
const pgRestante = r.linhas?.[0]?.id
r = await pagar(A, cartaoA, '2026-11', 0.01, 'chave-extra-0001')
ok('ciclo quitado não aceita mais pagamentos', !!r.erro)
r = await como(A, `SELECT * FROM public.estornar_pagamento_fatura($1)`, [pgRestante])
ok('estorno marca status estornado', !r.erro && r.linhas[0].status === 'estornado' && !!r.linhas[0].estornado_em, r.erro || '')
r = await como(A, `SELECT * FROM public.estornar_pagamento_fatura($1)`, [pgRestante])
ok('estorno duplicado recusado', !!r.erro)
r = await pagar(A, cartaoA, '2026-11', 600, 'chave-restante-1')
ok('retry com chave de pagamento já estornado é recusado (não devolve como sucesso)', !!r.erro && /estornado/i.test(r.erro), r.erro || '')
r = await pagar(A, cartaoA, '2026-11', 600, 'chave-restante-2')
ok('após estorno o valor volta a ficar em aberto (600 aceito)', !r.erro, r.erro || '')
r = await pagar(A, cartaoA, '2026-12', 100, 'chave-antecipado-1', 500)
ok('pagamento antecipado de outro ciclo aceito', !r.erro, r.erro || '')
// Nova compra apos pagamento parcial: total maior aceito, pagamento anterior preservado.
await semear(A, cartaoA, 'Nova compra 2026-12', 200, '2026-12-06')
r = await pagar(A, cartaoA, '2026-12', 150, 'chave-total-maior-1', 700)
ok('total maior apos pagamento parcial aceito (sem estorno)', !r.erro && Number(r.linhas[0].total_ciclo_ref) === 700, r.erro || '')
r = await como(A, `SELECT count(*)::int AS n, COALESCE(SUM(valor),0)::numeric AS soma FROM public.pagamentos_fatura WHERE cartao_id = $1 AND ano_mes = '2026-12' AND status = 'ativo'`, [cartaoA])
ok('pagamento anterior preservado (100 + 150 ativos)', r.linhas[0].n === 2 && Number(r.linhas[0].soma) === 250, JSON.stringify(r.linhas?.[0]))
r = await pagar(A, cartaoA, '2026-12', 450.01, 'chave-excede-novo-1', 700)
ok('valor acima do novo em aberto (450) recusado', !!r.erro)
r = await pagar(A, cartaoA, '2026-12', 450, 'chave-novo-resto-1', 700)
ok('quitar o novo restante aceito', !r.erro, r.erro || '')
r = await pagar(A, cartaoA, '2026-12', 450, 'chave-novo-resto-1', 700)
ok('retry com a mesma chave e mesmos parametros e idempotente', !r.erro, r.erro || '')
r = await como(A, `SELECT count(*)::int AS n FROM public.pagamentos_fatura WHERE cartao_id = $1 AND ano_mes = '2026-12'`, [cartaoA])
ok('retry nao criou nova linha (3 pagamentos no ciclo)', r.linhas[0].n === 3, `(${r.linhas?.[0]?.n})`)
r = await pagar(A, cartaoA, '2026-12', 450, 'chave-novo-resto-1', 700, 'saldo_principal', '2020-01-01')
ok('mesma chave com data diferente recusada', !!r.erro)
r = await pagar(A, cartaoA, '2026-11', 5, 'chave-outra-conta-1', 1000, 'outra_conta')
ok('origem outra_conta recusada pela RPC', !!r.erro)
r = await pagar(A, cartaoA, '2026-11', 10, 'chave-futura-001', 1000, 'saldo_principal', '2999-01-01')
ok('data futura recusada', !!r.erro)
r = await pagar(A, cartaoA, '2026-11', -5, 'chave-negativo-1')
ok('valor negativo recusado', !!r.erro)
r = await pagar(A, cartaoA, '2026-13', 5, 'chave-mes-inval-1')
ok('competência inválida recusada', !!r.erro)
r = await pagar(A, cartaoA, '2026-11', 5, 'chave-origem-001', 1000, 'conta_de_b')
ok('origem inválida recusada', !!r.erro)
r = await pagar(B, cartaoB, '2026-11', 100, 'chave-b-proprio-1', 500)
ok('B paga o proprio cartao', !r.erro, r.erro || '')
r = await como(A, `SELECT count(*)::int AS n FROM public.pagamentos_fatura WHERE cartao_id = $1`, [cartaoB])
ok('A nao le pagamentos do cartao de B (RLS)', !r.erro && r.linhas[0].n === 0, r.erro || '')
r = await pagar(A, cartaoA, '2027-02', 10, 'chave-b-proprio-1', 100)
ok('A pode usar a mesma chave de B (chave e por usuario)', !r.erro && Number(r.linhas[0].valor) === 10, r.erro || '')
r = await pagar(B, cartaoA, '2026-11', 10, 'chave-b-cartao-a')
ok('B não paga fatura do cartão de A', !!r.erro, r.erro || '')
r = await como(B, `SELECT count(*)::int AS n FROM public.pagamentos_fatura`)
ok('B não lê pagamentos de A (RLS)', !r.erro && r.linhas[0].n === 0, r.erro || '')
r = await como(B, `SELECT * FROM public.estornar_pagamento_fatura($1)`, [pgParcial])
ok('B não estorna pagamento de A', !!r.erro)
r = await como(A, `INSERT INTO public.pagamentos_fatura (usuario_id, cartao_id, ano_mes, valor, data_pagamento, idempotency_key) VALUES ($1, $2, '2026-11', 1, CURRENT_DATE, 'insercao-direta-1')`, [A, cartaoA])
ok('INSERT direto na tabela bloqueado (so via RPC)', !!r.erro)
r = await como(A, `UPDATE public.pagamentos_fatura SET status = 'estornado' WHERE id = $1`, [pgParcial])
ok('UPDATE direto bloqueado', !!r.erro)
r = await como(null, `SELECT * FROM public.pagar_fatura_cartao($1, '2026-11', 1, CURRENT_DATE, 'saldo_principal', NULL, 100, 'chave-anonimo-1')`, [cartaoA])
ok('anônimo não executa a RPC', !!r.erro)
r = await como(A, `SELECT COALESCE(SUM(valor),0)::numeric AS ativo FROM public.pagamentos_fatura WHERE cartao_id = $1 AND ano_mes = '2026-11' AND status = 'ativo'`, [cartaoA])
ok('soma de pagamentos ativos do ciclo = 1000 (400 + 600), sem duplicar', Number(r.linhas[0].ativo) === 1000, `(${r.linhas?.[0]?.ativo})`)
// Total calculado no servidor: p_total_ciclo do cliente nao e confiavel.
r = await pagar(A, cartaoA, '2027-02', 50, 'chave-inflado-0001', 99999)
ok('cliente com total inflado e recusado (fatura desatualizada)', !!r.erro && /desatualizada/i.test(r.erro), r.erro || '')
r = await pagar(A, cartaoA, '2027-02', 95, 'chave-inflado-0002', 100)
ok('valor acima do em aberto real (90) recusado mesmo com total correto', !!r.erro && /excede/i.test(r.erro) && /90\.00/.test(r.erro), r.erro || '')
r = await como(A, `SELECT * FROM public.pagar_fatura_cartao($1, '2027-02', 10, $2, 'saldo_principal', NULL, NULL, 'chave-sem-dica-001')`, [cartaoA, hoje])
ok('sem dica de total (NULL) o servidor calcula sozinho', !r.erro && Number(r.linhas[0].total_ciclo_ref) === 100, r.erro || '')
r = await pagar(A, cartaoA, '2030-01', 10, 'chave-ciclo-vazio-1', 10)
ok('ciclo sem compras nao aceita pagamento', !!r.erro && /sem valor a pagar/i.test(r.erro), r.erro || '')
r = await como(A, `SELECT public.total_fatura_ciclo($1, '2026-11') AS t`, [cartaoA])
ok('total_fatura_ciclo devolve o total do proprio cartao (1000)', !r.erro && Number(r.linhas[0].t) === 1000, r.erro || '')
r = await como(B, `SELECT public.total_fatura_ciclo($1, '2026-11') AS t`, [cartaoA])
ok('B nao consulta o total do cartao de A', !!r.erro, r.erro || '')
r = await como(null, `SELECT public.total_fatura_ciclo($1, '2026-11') AS t`, [cartaoA])
ok('anonimo nao consulta total', !!r.erro)
r = await como(A, `SELECT public.total_fatura_ciclo_servidor($1, $2, '2026-11') AS t`, [cartaoB, B])
ok('funcao interna (usuario arbitrario) nao e executavel por authenticated', !!r.erro, r.erro || '')
r = await como(null, `SELECT public.total_fatura_ciclo_servidor($1, $2, '2026-11') AS t`, [cartaoA, A])
ok('funcao interna nao e executavel por anon', !!r.erro, r.erro || '')
r = await db.query(`SELECT count(*)::int AS n FROM pg_policies WHERE tablename = 'pagamentos_fatura' AND policyname = 'Consultor autorizado lê pagamentos de fatura do cliente'`)
ok('policy do consultor existe (dependencia consultor_autorizado presente)', r.rows[0].n === 1)
// Falha explicita se a dependencia do consultor sumir: a migration NAO pode passar em silencio.
await db.exec(`ALTER FUNCTION public.consultor_autorizado(uuid) RENAME TO consultor_autorizado_tmp`)
let falhouExplicito = false, msgDep = ''
try { await db.exec(ler('migrations/20261124000001_pagamentos_fatura.sql')) } catch (e) { falhouExplicito = true; msgDep = e.message }
await db.exec('ROLLBACK').catch(() => {})
await db.exec(`ALTER FUNCTION public.consultor_autorizado_tmp(uuid) RENAME TO consultor_autorizado`)
ok('migration falha de forma explicita sem consultor_autorizado', falhouExplicito && /consultor_autorizado/.test(msgDep) && /2026-10_consultoria_acessos/.test(msgDep), msgDep)
// v5: serializacao por cartao. Verifica a EXISTENCIA dos 7 triggers e do helper e a permissao.
// NAO prova concorrencia (PGlite tem uma conexao): a prova real e supabase/tests/concorrencia-fatura.mjs.
r = await db.query(`SELECT count(*)::int AS n FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  WHERE NOT t.tgisinternal AND c.relname IN ('compras_cartao','parcelamentos','faturas_cartao','cartoes')
    AND t.tgname IN ('aa_fatura_travar_usuario','aa_fatura_travar_cartao')`)
ok('7 triggers de serializacao existem (3 tabelas x statement/row + DELETE statement em cartoes)', r.rows[0].n === 7, `(${r.rows[0].n})`)
r = await db.query(`SELECT to_regprocedure('public.travar_cartoes_fatura(uuid[],uuid)') IS NOT NULL AS ok`)
ok('travar_cartoes_fatura existe', r.rows[0].ok === true)
r = await como(A, `SELECT public.travar_cartoes_fatura(ARRAY[$1::uuid], $2::uuid)`, [cartaoA, A])
ok('authenticated nao executa travar_cartoes_fatura', !!r.erro, r.erro || '')
// Concorrência: duas chamadas com a MESMA chave não geram duas linhas. Limite: PGlite tem uma
// conexão e o driver serializa as chamadas; isto NÃO prova o lock FOR UPDATE (PENDENTE no DEV).
await Promise.all([pagar(A, cartaoA, '2027-01', 50, 'chave-concorrente-1', 500), pagar(A, cartaoA, '2027-01', 50, 'chave-concorrente-1', 500)])
r = await como(A, `SELECT count(*)::int AS n FROM public.pagamentos_fatura WHERE ano_mes = '2027-01'`)
ok('chamadas simultâneas com a mesma chave geram 1 linha', r.linhas[0].n === 1, `(${r.linhas?.[0]?.n})`)
// Backfill legado
await db.exec(`SET session_replication_role = replica`)
await db.exec(`INSERT INTO public.faturas_cartao (id, usuario_id, cartao_id, ano_mes, valor_total, pago, pago_em) VALUES ('00000000-0000-4000-8000-0000000000f1', '${A}', '${cartaoA}', '2026-09', 250, TRUE, '2026-09-28') ON CONFLICT DO NOTHING`)
await db.exec(`SET session_replication_role = origin`)
// Sem a 000002 aplicada (simulada removendo o estorno de 2 argumentos), a 000001 e idempotente e refaz o backfill.
// Depois reaplica-se a 000002, como em producao.
let msg1 = ''
try { await db.exec(ler('migrations/20261124000001_pagamentos_fatura.sql')) } catch (e) { msg1 = e.message; await db.exec('ROLLBACK').catch(() => {}) }
ok('000001 recusa reaplicacao enquanto a 000002 esta aplicada', /Não reaplique a 000001/.test(msg1), msg1.split('\n')[0])
await db.exec(`DROP FUNCTION public.estornar_pagamento_fatura(uuid, text)`)
await db.exec(ler('migrations/20261124000001_pagamentos_fatura.sql'))
await db.exec(ler('migrations/20261124000001_pagamentos_fatura.sql'))
await db.exec(ler('migrations/20261124000002_integridade_historica_fatura.sql'))
r = await db.query(`SELECT count(*)::int AS n, bool_and(legado) AS l, bool_and(origem = 'outra_conta') AS o FROM public.pagamentos_fatura WHERE ano_mes = '2026-09'`)
ok('backfill cria 1 pagamento legado sem debitar saldo e é idempotente', r.rows[0].n === 1 && r.rows[0].l && r.rows[0].o, JSON.stringify(r.rows[0]))

r = await db.query(`SELECT count(*)::int AS n FROM public.perfis`)
ok('dados existentes preservados', r.rows[0].n === 2)


// ============================================================
// Integridade histórica das faturas pagas (migration 20261124000002).
// ATENÇÃO: estes cenários foram ESCRITOS mas NÃO EXECUTADOS no ambiente em que a feature foi
// implementada (sem Postgres e sem PGlite). Ficam PENDENTES até rodar com `npm run test:migrations`.
// O código de erro FP001 depende de o driver PGlite expor `e.code`; se não expuser, o ajuste é
// comparar pela mensagem ("já está quitada").
// ============================================================
console.log('\n# integridade historica (000002): guarda, auditoria, credito, fluxo controlado (PENDENTE de execucao)')
const FP = 'FP001'
const novoCartaoDe = async (uid, nome) => (await como(uid, `INSERT INTO public.cartoes (usuario_id, nome, limite_total, dia_fechamento, dia_vencimento) VALUES ($1, $2, 5000, 20, 28) RETURNING id`, [uid, nome])).linhas?.[0]?.id
const novaCompraDe = async (uid, cartao, descricao, valor, data = '2026-11-05') => (await como(uid, `INSERT INTO public.compras_cartao (usuario_id, cartao_id, descricao, valor_total, data_compra, numero_parcelas) VALUES ($1, $2, $3, $4, $5, 1) RETURNING id`, [uid, cartao, descricao, valor, data])).linhas?.[0]?.id
const pagarSemDica = (uid, cartao, ym, valor, key) => como(uid, `SELECT * FROM public.pagar_fatura_cartao($1, $2, $3, $4, 'saldo_principal', NULL, NULL, $5)`, [cartao, ym, valor, hoje, key])
const ajustesDe = async (cartao, ym, filtro = '') => (await db.query(`SELECT * FROM public.ajustes_fatura WHERE cartao_id = $1 AND ano_mes = $2 ${filtro} ORDER BY criado_em, id`, [cartao, ym])).rows
const somaCredito = async (cartao, ym) => Number((await db.query(`SELECT COALESCE(SUM(valor), 0) AS v FROM public.ajustes_fatura WHERE cartao_id = $1 AND ano_mes = $2 AND tipo = 'credito'`, [cartao, ym])).rows[0].v)
const pagosAtivos = async cartao => (await db.query(`SELECT count(*)::int AS n, COALESCE(SUM(valor), 0)::numeric AS soma FROM public.pagamentos_fatura WHERE cartao_id = $1 AND status = 'ativo'`, [cartao])).rows[0]
const valorCompra = async id => Number((await db.query(`SELECT valor_total FROM public.compras_cartao WHERE id = $1`, [id])).rows[0]?.valor_total)
const YM = '2026-11'

// 1) Aberta: DML livre e sem auditoria.
const cI = await novoCartaoDe(A, 'Integridade A')
const k1 = await novaCompraDe(A, cI, 'Compra integridade', 1000)
r = await como(A, `UPDATE public.compras_cartao SET valor_total = 900 WHERE id = $1`, [k1])
ok('aberta: A edita livremente', !r.erro && r.afetadas === 1, r.erro || '')
ok('aberta: nenhuma linha de auditoria', (await ajustesDe(cI, YM)).length === 0)

// 2) Parcial: permite editar, incluir e excluir; audita; pagamentos intactos.
r = await pagarSemDica(A, cI, YM, 400, 'ih-parcial-0001')
ok('parcial: pagamento de 400 sobre 900 aceito', !r.erro, r.erro || '')
const pgIH1 = r.linhas?.[0]?.id
r = await como(A, `UPDATE public.compras_cartao SET valor_total = 800 WHERE id = $1`, [k1])
ok('parcial: editar valor da compra é permitido', !r.erro && r.afetadas === 1, r.erro || '')
let aj = await ajustesDe(cI, YM, `AND tipo = 'edicao'`)
ok('parcial: edição gera 1 linha de auditoria via direto com pago 400 e total 800', aj.length === 1 && aj[0].via === 'direto' && Number(aj[0].pago_ativo) === 400 && Number(aj[0].total_depois) === 800, JSON.stringify(aj.map(x => [x.via, x.pago_ativo, x.total_depois])))
r = await como(A, `INSERT INTO public.compras_cartao (usuario_id, cartao_id, descricao, valor_total, data_compra, numero_parcelas) VALUES ($1, $2, 'Extra', 100, '2026-11-06', 1) RETURNING id`, [A, cI])
ok('parcial: incluir compra é permitido', !r.erro, r.erro || '')
const kExtra = r.linhas?.[0]?.id
r = await como(A, `DELETE FROM public.compras_cartao WHERE id = $1`, [kExtra])
ok('parcial: excluir compra é permitido', !r.erro && r.afetadas === 1, r.erro || '')
ok('parcial: inclusão e exclusão auditadas', (await ajustesDe(cI, YM, `AND tipo = 'inclusao'`)).length === 1 && (await ajustesDe(cI, YM, `AND tipo = 'exclusao'`)).length === 1)
let pa = await pagosAtivos(cI)
ok('parcial: pagamentos intactos (1 ativo de 400)', pa.n === 1 && Number(pa.soma) === 400, JSON.stringify(pa))

// 3) Quitada: DML direto recusado com FP001.
r = await pagarSemDica(A, cI, YM, 400, 'ih-parcial-0002')
ok('quitada: restante (400) pago', !r.erro, r.erro || '')
const pgIH2 = r.linhas?.[0]?.id
const antesQ = (await ajustesDe(cI, YM)).length
r = await como(A, `UPDATE public.compras_cartao SET valor_total = 700 WHERE id = $1`, [k1])
ok('quitada: editar valor recusado com FP001', r.code === FP, `(${r.code} ${r.erro || 'sem erro'})`)
ok('quitada: a mensagem orienta o fluxo controlado (HINT/mensagem)', /quitada/i.test(r.erro || ''))
r = await como(A, `DELETE FROM public.compras_cartao WHERE id = $1`, [k1])
ok('quitada: excluir recusado com FP001', r.code === FP, `(${r.code} ${r.erro || 'sem erro'})`)
r = await como(A, `INSERT INTO public.compras_cartao (usuario_id, cartao_id, descricao, valor_total, data_compra, numero_parcelas) VALUES ($1, $2, 'Tarde demais', 50, '2026-11-07', 1)`, [A, cI])
ok('quitada: inserir compra no ciclo recusado com FP001', r.code === FP, `(${r.code} ${r.erro || 'sem erro'})`)
ok('quitada: compra intacta (800) e nenhuma auditoria nova', (await valorCompra(k1)) === 800 && (await ajustesDe(cI, YM)).length === antesQ)
r = await como(A, `UPDATE public.compras_cartao SET descricao = 'Renomeada', categoria_id = NULL WHERE id = $1`, [k1])
ok('quitada: editar descricao/categoria não é bloqueado', !r.erro && r.afetadas === 1, r.erro || '')
r = await como(B, `UPDATE public.compras_cartao SET valor_total = 1 WHERE id = $1`, [k1])
ok('quitada: B não altera a compra de A por DML direto (0 linhas; prova a RLS, a guarda só avalia linhas do próprio usuário)', !r.erro && r.afetadas === 0, `(${r.code} ${r.erro || 'sem erro'})`)
r = await como(B, `DELETE FROM public.compras_cartao WHERE id = $1`, [k1])
ok('quitada: B não apaga a compra de A por DML direto (0 linhas)', !r.erro && r.afetadas === 0, `(${r.code} ${r.erro || 'sem erro'})`)
ok('quitada: compra de A segue com 800', (await valorCompra(k1)) === 800)

// 4) Fluxo controlado: alterar_historico_fatura.
const ALTERAR = `SELECT public.alterar_historico_fatura($1, $2, $3, $4::jsonb, $5) AS r`
r = await como(A, ALTERAR, ['compras_cartao', k1, 'editar', JSON.stringify({ valor_total: 700 }), null])
ok('controlado: motivo obrigatório (NULL recusado)', r.code === '22023', `(${r.code} ${r.erro || ''})`)
r = await como(A, ALTERAR, ['compras_cartao', k1, 'editar', JSON.stringify({ valor_total: 700 }), 'abc'])
ok('controlado: motivo com menos de 5 caracteres recusado', r.code === '22023')
r = await como(A, ALTERAR, ['despesas', k1, 'excluir', null, 'Motivo valido'])
ok('controlado: tabela fora da lista recusada', r.code === '22023', `(${r.code} ${r.erro || ''})`)
r = await como(A, ALTERAR, ['compras_cartao', k1, 'editar', JSON.stringify({ usuario_id: B }), 'Motivo valido'])
ok('controlado: coluna fora da whitelist recusada (usuario_id)', r.code === '22023', `(${r.code} ${r.erro || ''})`)
r = await como(A, ALTERAR, ['compras_cartao', k1, 'editar', JSON.stringify({ criado_em: '2020-01-01' }), 'Motivo valido'])
ok('controlado: coluna fora da whitelist recusada (criado_em)', r.code === '22023')
r = await como(A, ALTERAR, ['compras_cartao', k1, 'apagar', null, 'Motivo valido'])
ok('controlado: ação inválida recusada', r.code === '22023')
r = await como(B, ALTERAR, ['compras_cartao', k1, 'editar', JSON.stringify({ valor_total: 1 }), 'Motivo valido'])
ok('controlado: B não altera o histórico de A (42501)', r.code === '42501', `(${r.code} ${r.erro || ''})`)
r = await como(A, ALTERAR, ['compras_cartao', k1, 'editar', JSON.stringify({ valor_total: 700, cartao_id: cartaoB }), 'Motivo valido'])
ok('controlado: A não move a compra para o cartão de B (42501)', r.code === '42501', `(${r.code} ${r.erro || ''})`)
r = await como(null, ALTERAR, ['compras_cartao', k1, 'editar', JSON.stringify({ valor_total: 700 }), 'Motivo valido'])
ok('controlado: anônimo não executa (42501)', r.code === '42501', `(${r.code} ${r.erro || 'sem erro'})`)
ok('controlado: nada mudou após as recusas (800)', (await valorCompra(k1)) === 800)
r = await como(A, ALTERAR, ['compras_cartao', k1, 'editar', JSON.stringify({ valor_total: 700 }), 'Correção de lançamento'])
ok('controlado: edição de fatura quitada aceita com motivo', !r.erro && r.linhas[0].r.ok === true, r.erro || '')
ok('controlado: devolve a quantidade de linhas da razão (edição + crédito = 2)', r.linhas?.[0]?.r?.ajustes === 2, JSON.stringify(r.linhas?.[0]?.r))
ok('controlado: valor novo gravado (700)', (await valorCompra(k1)) === 700)
aj = await ajustesDe(cI, YM, `AND tipo = 'edicao' AND via = 'controlado'`)
ok('controlado: auditoria com via controlado e motivo', aj.length === 1 && aj[0].motivo === 'Correção de lançamento' && Number(aj[0].dados_antes.valor_total) === 800 && Number(aj[0].dados_depois.valor_total) === 700)
// 5) Crédito: total (700) abaixo do pago (800): crédito de 100, pagamentos preservados.
ok('crédito: lançamento de 100 quando o total cai abaixo do pago', (await somaCredito(cI, YM)) === 100, `(${await somaCredito(cI, YM)})`)
pa = await pagosAtivos(cI)
ok('crédito: nenhum pagamento apagado (2 ativos, 800)', pa.n === 2 && Number(pa.soma) === 800, JSON.stringify(pa))
r = await como(A, `SELECT * FROM public.estornar_pagamento_fatura($1, $2)`, [pgIH2, 'Pagamento em duplicidade'])
ok('estorno com motivo aceito', !r.erro && r.linhas[0].status === 'estornado', r.erro || '')
aj = await ajustesDe(cI, YM, `AND tipo = 'estorno'`)
ok('estorno: gera linha estorno com o motivo e o pagamento', aj.length === 1 && aj[0].motivo === 'Pagamento em duplicidade' && aj[0].pagamento_id === pgIH2 && Number(aj[0].valor) === 400, JSON.stringify(aj))
ok('estorno: crédito reconciliado para 0 (pago 400 < total 700)', (await somaCredito(cI, YM)) === 0, `(${await somaCredito(cI, YM)})`)
r = await como(A, `SELECT * FROM public.estornar_pagamento_fatura($1)`, [pgIH1])
ok('estorno de 1 argumento continua funcionando e também audita', !r.erro && (await ajustesDe(cI, YM, `AND tipo = 'estorno'`)).length === 2, r.erro || '')
r = await como(A, `SELECT * FROM public.estornar_pagamento_fatura($1, $2)`, [pgIH1, 'x'.repeat(301)])
ok('estorno: motivo acima de 300 caracteres recusado (22023)', r.code === '22023', `(${r.code} ${r.erro || 'sem erro'})`)

// Exclusão controlada com crédito de 100% do pago.
const cJ = await novoCartaoDe(A, 'Integridade B')
const k2 = await novaCompraDe(A, cJ, 'Compra a excluir', 500)
r = await pagarSemDica(A, cJ, YM, 500, 'ih-quita-excluir-1')
ok('exclusão controlada: fatura de 500 quitada', !r.erro, r.erro || '')
r = await como(A, ALTERAR, ['compras_cartao', k2, 'excluir', null, 'Compra lançada por engano'])
ok('exclusão controlada aceita com motivo', !r.erro && r.linhas[0].r.ok === true, r.erro || '')
ok('exclusão controlada: compra removida, pagamento preservado e crédito de 500', (await db.query(`SELECT count(*)::int AS n FROM public.compras_cartao WHERE id = $1`, [k2])).rows[0].n === 0 && (await pagosAtivos(cJ)).n === 1 && (await somaCredito(cJ, YM)) === 500, `(${await somaCredito(cJ, YM)})`)
ok('exclusão controlada: auditoria exclusao via controlado', (await ajustesDe(cJ, YM, `AND tipo = 'exclusao' AND via = 'controlado'`)).length === 1)

// 6) Pagamentos e razão: imutáveis para papéis de cliente.
const pgJ = (await db.query(`SELECT id FROM public.pagamentos_fatura WHERE cartao_id = $1`, [cJ])).rows[0].id
r = await como(A, `DELETE FROM public.pagamentos_fatura WHERE id = $1`, [pgJ])
ok('pagamentos: authenticated não apaga (sem privilégio) (42501)', r.code === '42501', `(${r.code} ${r.erro || 'sem erro'})`)
r = await como(A, `UPDATE public.pagamentos_fatura SET valor = 1 WHERE id = $1`, [pgJ])
ok('pagamentos: authenticated não altera valor (42501)', r.code === '42501', `(${r.code} ${r.erro || 'sem erro'})`)
r = await comoServico(`DELETE FROM public.pagamentos_fatura WHERE id = $1`, [pgJ])
ok('pagamentos: service_role não apaga (trigger FP001)', r.code === FP, `(${r.code} ${r.erro || 'sem erro'})`)
r = await comoServico(`UPDATE public.pagamentos_fatura SET valor = 1 WHERE id = $1`, [pgJ])
ok('pagamentos: service_role não altera valor (trigger FP001)', r.code === FP, `(${r.code} ${r.erro || 'sem erro'})`)
r = await comoServico(`UPDATE public.pagamentos_fatura SET status = 'estornado', estornado_em = now(), valor = 2 WHERE id = $1`, [pgJ])
ok('pagamentos: estorno não pode vir junto com mudança de valor', r.code === FP, `(${r.code} ${r.erro || 'sem erro'})`)
r = await como(A, `INSERT INTO public.ajustes_fatura (usuario_id, cartao_id, ano_mes, tipo, via) VALUES ($1, $2, '2026-11', 'credito', 'direto')`, [A, cJ])
ok('ajustes_fatura: authenticated não insere (42501)', r.code === '42501', `(${r.code} ${r.erro || 'sem erro'})`)
r = await como(A, `UPDATE public.ajustes_fatura SET motivo = 'adulterado' WHERE cartao_id = $1`, [cJ])
ok('ajustes_fatura: authenticated não altera (42501)', r.code === '42501', `(${r.code} ${r.erro || 'sem erro'})`)
r = await como(A, `DELETE FROM public.ajustes_fatura WHERE cartao_id = $1`, [cJ])
ok('ajustes_fatura: authenticated não apaga (42501)', r.code === '42501', `(${r.code} ${r.erro || 'sem erro'})`)
r = await comoServico(`DELETE FROM public.ajustes_fatura WHERE cartao_id = $1`, [cJ])
ok('ajustes_fatura: service_role não apaga (trigger FP001)', r.code === FP, `(${r.code} ${r.erro || 'sem erro'})`)
r = await comoServico(`UPDATE public.ajustes_fatura SET motivo = 'adulterado' WHERE cartao_id = $1`, [cJ])
ok('ajustes_fatura: service_role não altera (trigger FP001)', r.code === FP, `(${r.code} ${r.erro || 'sem erro'})`)
r = await db.query(`SELECT has_table_privilege('authenticated','public.ajustes_fatura','INSERT') i, has_table_privilege('authenticated','public.ajustes_fatura','UPDATE') u, has_table_privilege('authenticated','public.ajustes_fatura','DELETE') d, has_table_privilege('authenticated','public.ajustes_fatura','SELECT') s, has_table_privilege('anon','public.ajustes_fatura','SELECT') a`)
ok('ajustes_fatura: authenticated só tem SELECT; anon sem acesso', !r.rows[0].i && !r.rows[0].u && !r.rows[0].d && r.rows[0].s && !r.rows[0].a, JSON.stringify(r.rows[0]))
r = await como(A, `SELECT count(*)::int AS n FROM public.ajustes_fatura WHERE cartao_id = $1`, [cI])
ok('ajustes_fatura: A lê os próprios ajustes', !r.erro && r.linhas[0].n > 0, r.erro || '')
r = await como(B, `SELECT count(*)::int AS n FROM public.ajustes_fatura WHERE cartao_id = ANY($1::uuid[])`, [[cI, cJ]])
ok('ajustes_fatura: B não lê ajustes de A (RLS)', !r.erro && r.linhas[0].n === 0, r.erro || '')
r = await como(A, `SELECT count(*)::int AS n FROM public._fatura_liberacoes`)
ok('_fatura_liberacoes: authenticated sem acesso (42501)', r.code === '42501', `(${r.code} ${r.erro || 'sem erro'})`)
r = await db.query(`SELECT has_table_privilege('authenticated','public._fatura_liberacoes','SELECT') s, has_table_privilege('authenticated','public._fatura_liberacoes','INSERT') i, has_table_privilege('anon','public._fatura_liberacoes','SELECT') a, has_table_privilege('service_role','public._fatura_liberacoes','SELECT') sr`)
ok('_fatura_liberacoes: nenhum papel de cliente tem privilégio', !r.rows[0].s && !r.rows[0].i && !r.rows[0].a && !r.rows[0].sr, JSON.stringify(r.rows[0]))
r = await como(A, `SELECT public.fatura_liberacao_ativa('controlado') AS a, public.fatura_liberacao_ativa('zerar') AS z`)
ok('fatura_liberacao_ativa: sem liberação na transação devolve false', !r.erro && r.linhas[0].a === false && r.linhas[0].z === false, r.erro || '')

// 7) Liberação 'zerar' solta não vale em outra transação; cartão com pagamento ativo não é excluído.
const cK = await novoCartaoDe(A, 'Integridade C')
const k3 = await novaCompraDe(A, cK, 'Compra cartao C', 300)
r = await pagarSemDica(A, cK, YM, 300, 'ih-quita-zerar-0001')
ok('cartão C: fatura de 300 quitada', !r.erro, r.erro || '')
r = await como(A, `SELECT public.liberar_historico_zerar()`)
ok('liberar_historico_zerar solta é aceita (inofensiva)', !r.erro, r.erro || '')
r = await como(A, `UPDATE public.compras_cartao SET valor_total = 1 WHERE id = $1`, [k3])
ok('liberação solta de OUTRA transação não destrava a guarda (FP001)', r.code === FP, `(${r.code} ${r.erro || 'sem erro'})`)
r = await como(A, `DELETE FROM public.cartoes WHERE id = $1`, [cK])
ok('cartão com pagamento ativo não pode ser excluído (FP001)', r.code === FP, `(${r.code} ${r.erro || 'sem erro'})`)
r = await como(null, `SELECT public.liberar_historico_zerar()`)
ok('anônimo não executa liberar_historico_zerar (42501)', r.code === '42501', `(${r.code} ${r.erro || 'sem erro'})`)

// 8) Contexto administrativo (dono/service role, auth.uid() nulo): permitido e auditado.
await db.query(`UPDATE public.compras_cartao SET valor_total = 310 WHERE id = $1`, [k3])
aj = await ajustesDe(cK, YM, `AND tipo = 'edicao'`)
ok('administrativo: o dono edita fatura quitada e fica auditado via administrativo', aj.length === 1 && aj[0].via === 'administrativo', JSON.stringify(aj.map(x => x.via)))
await db.query(`UPDATE public.compras_cartao SET valor_total = 300 WHERE id = $1`, [k3])

// 8b) Cobertura adicional da revisão: parcelamentos, faturas_cartao, mover entre cartões, parcial com crédito direto,
// exclusão de cartão, dia_fechamento, compra parcelada entre meses, dedupe parcelamento x compra, acúmulo de liberações.
const insParc = (uid, cartao, desc, valor, n, primeira) => como(uid, `INSERT INTO public.parcelamentos (usuario_id, cartao_id, descricao, valor_total, numero_parcelas, primeira_parcela) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [uid, cartao, desc, valor, n, primeira])
const insCompra = (uid, cartao, desc, valor, data, n = 1) => como(uid, `INSERT INTO public.compras_cartao (usuario_id, cartao_id, descricao, valor_total, data_compra, numero_parcelas) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [uid, cartao, desc, valor, data, n])
const FP_ = r => `(${r.code} ${r.erro || 'sem erro'})`

// parcelamentos (300 em 3x a partir de 05/11: 100 por mes), mes 2026-11 quitado.
const cP = await novoCartaoDe(A, 'Integridade parcelamentos')
r = await insParc(A, cP, 'TV', 300, 3, '2026-11-05')
const parc1 = r.linhas?.[0]?.id
ok('parcelamentos: inserir em fatura aberta é permitido', !r.erro && !!parc1, r.erro || '')
r = await pagarSemDica(A, cP, YM, 100, 'ih-parc-quita-01')
ok('parcelamentos: fatura de 100 quitada', !r.erro, r.erro || '')
r = await como(A, `UPDATE public.parcelamentos SET valor_total = 600 WHERE id = $1`, [parc1])
ok('parcelamentos: editar valor em fatura quitada recusado (FP001)', r.code === FP, FP_(r))
r = await como(A, `UPDATE public.parcelamentos SET quitado_em = '2026-11-10' WHERE id = $1`, [parc1])
ok('parcelamentos: quitar (quitado_em) em fatura quitada recusado (FP001)', r.code === FP, FP_(r))
r = await como(A, `DELETE FROM public.parcelamentos WHERE id = $1`, [parc1])
ok('parcelamentos: excluir em fatura quitada recusado (FP001)', r.code === FP, FP_(r))
r = await insParc(A, cP, 'Outro', 90, 3, '2026-11-06')
ok('parcelamentos: inserir parcelamento que cobre mes quitado recusado (FP001)', r.code === FP, FP_(r))
r = await como(A, `UPDATE public.parcelamentos SET descricao = 'TV sala' WHERE id = $1`, [parc1])
ok('parcelamentos: editar só a descricao não é bloqueado', !r.erro && r.afetadas === 1, r.erro || '')
r = await como(A, ALTERAR, ['parcelamentos', parc1, 'editar', JSON.stringify({ valor_total: 330 }), 'Ajuste do parcelamento'])
ok('parcelamentos: fluxo controlado edita e audita via controlado', !r.erro && (await ajustesDe(cP, YM, `AND tabela_origem = 'parcelamentos' AND via = 'controlado'`)).length === 1, r.erro || '')

// faturas_cartao (fatura informada).
const cF = await novoCartaoDe(A, 'Integridade faturas informadas')
await novaCompraDe(A, cF, 'Compra F', 500)
r = await pagarSemDica(A, cF, YM, 500, 'ih-fat-quita-01')
ok('faturas_cartao: fatura de 500 quitada', !r.erro, r.erro || '')
r = await como(A, `INSERT INTO public.faturas_cartao (usuario_id, cartao_id, ano_mes, valor_total) VALUES ($1, $2, $3, 900)`, [A, cF, YM])
ok('faturas_cartao: informar total em fatura quitada recusado (FP001)', r.code === FP, FP_(r))
r = await como(A, `INSERT INTO public.faturas_cartao (usuario_id, cartao_id, ano_mes, valor_total) VALUES ($1, $2, '2027-03', 900)`, [A, cF])
ok('faturas_cartao: informar total de outro mês aberto é permitido', !r.erro, r.erro || '')

// Mover compra entre cartões: destino quitado e origem quitada.
const cM1 = await novoCartaoDe(A, 'Mover quitado')
const cM2 = await novoCartaoDe(A, 'Mover aberto')
const kM1 = await novaCompraDe(A, cM1, 'Q', 200)
const kM2 = await novaCompraDe(A, cM2, 'Livre', 50)
r = await pagarSemDica(A, cM1, YM, 200, 'ih-mover-quita-01')
ok('mover: fatura do cartão M1 quitada', !r.erro, r.erro || '')
r = await como(A, `UPDATE public.compras_cartao SET cartao_id = $1 WHERE id = $2`, [cM1, kM2])
ok('mover: compra de cartão aberto para cartão com mês quitado recusado (FP001)', r.code === FP, FP_(r))
r = await como(A, `UPDATE public.compras_cartao SET cartao_id = $1 WHERE id = $2`, [cM2, kM1])
ok('mover: compra de cartão quitado para outro cartão recusado (FP001)', r.code === FP, FP_(r))

// Parcial derrubando o total abaixo do pago por DML direto: crédito via direto, pagamento preservado.
const cQ = await novoCartaoDe(A, 'Parcial credito')
const kQ = await novaCompraDe(A, cQ, 'Q', 1000)
r = await pagarSemDica(A, cQ, YM, 400, 'ih-parcial-cred-1')
ok('parcial/crédito: pagamento de 400 sobre 1000', !r.erro, r.erro || '')
r = await como(A, `UPDATE public.compras_cartao SET valor_total = 300 WHERE id = $1`, [kQ])
ok('parcial/crédito: editar para 300 (abaixo do pago 400) é permitido em fatura parcial', !r.erro && r.afetadas === 1, r.erro || '')
aj = await ajustesDe(cQ, YM, `AND tipo = 'credito'`)
ok('parcial/crédito: lançamento de crédito de 100 via direto e pagamento preservado', aj.length === 1 && Number(aj[0].valor) === 100 && aj[0].via === 'direto' && (await pagosAtivos(cQ)).n === 1, JSON.stringify(aj.map(x => [x.valor, x.via])))

// Exclusão de cartão: sem histórico exclui; com pagamento estornado e razão recusa (FP001).
const cY = await novoCartaoDe(A, 'Sem historico')
r = await como(A, `DELETE FROM public.cartoes WHERE id = $1`, [cY])
ok('cartão sem pagamentos nem razão pode ser excluído', !r.erro && r.afetadas === 1, r.erro || '')
const cX = await novoCartaoDe(A, 'Com historico estornado')
const kX = await novaCompraDe(A, cX, 'X', 100)
r = await pagarSemDica(A, cX, YM, 100, 'ih-cartao-hist-01')
const pgX = r.linhas?.[0]?.id
r = await como(A, `SELECT * FROM public.estornar_pagamento_fatura($1, 'Teste de historico')`, [pgX])
ok('cartão com histórico: pagamento estornado (razão com linha estorno)', !r.erro, r.erro || '')
r = await como(A, `DELETE FROM public.compras_cartao WHERE id = $1`, [kX])
ok('cartão com histórico: compra da fatura reaberta excluída', !r.erro && r.afetadas === 1, r.erro || '')
r = await como(A, `DELETE FROM public.cartoes WHERE id = $1`, [cX])
ok('cartão com pagamento estornado e razão não pode ser excluído (FP001)', r.code === FP, FP_(r))
ok('cartão com histórico: razão e pagamento estornado preservados', (await ajustesDe(cX, YM)).length >= 1 && (await db.query(`SELECT count(*)::int AS n FROM public.pagamentos_fatura WHERE cartao_id = $1`, [cX])).rows[0].n === 1)

// dia_fechamento: bloqueado com pagamento ativo; livre sem pagamento ativo.
r = await como(A, `UPDATE public.cartoes SET dia_fechamento = 10 WHERE id = $1`, [cK])
ok('dia_fechamento: alterar com pagamento ativo recusado (FP001)', r.code === FP, FP_(r))
r = await como(A, `UPDATE public.cartoes SET dia_fechamento = 25 WHERE id = $1`, [cX])
ok('dia_fechamento: alterar em cartão sem pagamento ativo é permitido', !r.erro && r.afetadas === 1, r.erro || '')
r = await como(A, `UPDATE public.cartoes SET nome = 'Renomeado' WHERE id = $1`, [cK])
ok('cartão com pagamento ativo: outros campos (nome) seguem editáveis', !r.erro && r.afetadas === 1, r.erro || '')

// Compra parcelada cruzando meses quitado e aberto (300 em 3x a partir de 05/11 = nov, dez, jan).
const cZ = await novoCartaoDe(A, 'Parcelada cruzando')
r = await insCompra(A, cZ, 'Geladeira', 300, '2026-11-05', 3)
const kZ = r.linhas?.[0]?.id
r = await pagarSemDica(A, cZ, YM, 100, 'ih-cruza-quita-01')
ok('compra parcelada: mês 2026-11 (100) quitado', !r.erro, r.erro || '')
r = await como(A, `UPDATE public.compras_cartao SET valor_total = 600 WHERE id = $1`, [kZ])
ok('compra parcelada: editar valor recusado porque a 1a parcela cai no mês quitado (FP001)', r.code === FP, FP_(r))
r = await insCompra(A, cZ, 'Anterior', 200, '2026-10-05', 2)
ok('compra parcelada: nova compra em 2x que alcança o mês quitado recusada (FP001)', r.code === FP, FP_(r))
r = await insCompra(A, cZ, 'So dezembro', 80, '2026-12-05', 1)
ok('compra parcelada: compra só em mês aberto (dezembro) é permitida', !r.erro, r.erro || '')
r = await insCompra(A, cZ, 'Apos fechamento', 80, '2026-11-25', 1)
ok('compra parcelada: compra após o fechamento (vai para dezembro) é permitida', !r.erro, r.erro || '')

// Dedupe parcelamento x compra: compra com mesma descrição, valor e parcelas de um parcelamento, em OUTRA competência,
// removeria o parcelamento do total dos meses quitados.
const cD = await novoCartaoDe(A, 'Dedupe')
r = await insParc(A, cD, 'Notebook', 300, 3, '2026-11-05')
const parcD = r.linhas?.[0]?.id
r = await pagarSemDica(A, cD, YM, 100, 'ih-dedupe-quita-01')
ok('dedupe: mês 2026-11 (100 do parcelamento) quitado', !r.erro, r.erro || '')
r = await insCompra(A, cD, 'notebook', 300, '2027-03-05', 3)
ok('dedupe: compra duplicata em outra competência recusada (FP001)', r.code === FP, FP_(r))
r = await insCompra(A, cD, 'Notebook gamer', 300, '2027-03-05', 3)
ok('dedupe: compra com descrição diferente (sem dedupe) é permitida', !r.erro, r.erro || '')

// ------------------------------------------------------------
// Revisao final (itens 1 a 5) - cenarios ESCRITOS, NAO EXECUTADOS (sem Postgres/PGlite no ambiente
// em que foram escritos). PENDENTES ate rodar com `npm run test:migrations`.
// ------------------------------------------------------------
console.log('\n# revisao final: RLS consultor, cartao com legado, SAVEPOINT, liberacoes (PENDENTE de execucao)')
const C = '00000000-0000-4000-8000-00000000000c'
const D = '00000000-0000-4000-8000-00000000000d'
await db.exec(`SET session_replication_role = replica`)
await db.exec(`INSERT INTO auth.users (id, email) VALUES ('${C}', 'c@exemplo.invalid'), ('${D}', 'd@exemplo.invalid') ON CONFLICT DO NOTHING;
  INSERT INTO public.perfis (id, nome, email) VALUES ('${C}', 'C', 'c@exemplo.invalid'), ('${D}', 'D', 'd@exemplo.invalid') ON CONFLICT DO NOTHING;`)
await db.exec(`SET session_replication_role = origin`)

// Item 1: RLS do consultor em ajustes_fatura. consultoria_acessos so tem status (sem expiracao nem permissoes por escopo).
const nAjA = (await db.query(`SELECT count(*)::int AS n FROM public.ajustes_fatura WHERE usuario_id = $1`, [A])).rows[0].n
ok('consultor: pre-condicao, A tem ajustes na razao', nAjA > 0, `(${nAjA})`)
const contaAj = (uid, dono) => como(uid, `SELECT count(*)::int AS n FROM public.ajustes_fatura WHERE usuario_id = $1`, [dono])
r = await contaAj(C, A)
ok('consultor: sem vinculo, C nao le ajustes de A', !r.erro && r.linhas[0].n === 0, r.erro || '')
for (const st of ['pendente', 'recusado', 'revogado']) {
  await db.query(`INSERT INTO public.consultoria_acessos (consultor_id, cliente_id, status) VALUES ($1, $2, $3) ON CONFLICT (consultor_id, cliente_id) DO UPDATE SET status = EXCLUDED.status`, [C, A, st])
  r = await contaAj(C, A)
  ok(`consultor: status ${st} nao le ajustes de A`, !r.erro && r.linhas[0].n === 0, r.erro || '')
}
await db.query(`UPDATE public.consultoria_acessos SET status = 'autorizado' WHERE consultor_id = $1 AND cliente_id = $2`, [C, A])
r = await contaAj(C, A)
ok('consultor: autorizado le todos os ajustes de A', !r.erro && r.linhas[0].n === nAjA, `(${r.linhas?.[0]?.n} de ${nAjA}) ${r.erro || ''}`)
// Pre-condicao das assercoes negativas: B (e qualquer outro usuario que nao seja A) precisa ter linhas na razao, senao 0 nao prova nada.
let nAjB = (await db.query(`SELECT count(*)::int AS n FROM public.ajustes_fatura WHERE usuario_id = $1`, [B])).rows[0].n
if (nAjB === 0) {
  await db.query(`INSERT INTO public.ajustes_fatura (usuario_id, cartao_id, ano_mes, tipo, via) VALUES ($1, $2, '2026-11', 'credito', 'direto')`, [B, cartaoB]).catch(e => console.log(`INFO - nao foi possivel semear ajuste de B: ${e.message}`))
  nAjB = (await db.query(`SELECT count(*)::int AS n FROM public.ajustes_fatura WHERE usuario_id = $1`, [B])).rows[0].n
}
ok('consultor: pre-condicao, B tem ajustes na razao (senao as assercoes negativas seriam vacuosas)', nAjB > 0, `(${nAjB})`)
const nAjOutros = (await db.query(`SELECT count(*)::int AS n FROM public.ajustes_fatura WHERE usuario_id <> $1`, [A])).rows[0].n
ok('consultor: pre-condicao, existem linhas de outros usuarios alem de A', nAjOutros > 0, `(${nAjOutros})`)
r = await contaAj(C, B)
ok('consultor: autorizado para A nao le ajustes de B', !r.erro && r.linhas[0].n === 0, r.erro || '')
r = await como(C, `SELECT count(*)::int AS n FROM public.ajustes_fatura WHERE usuario_id <> $1`, [A])
ok('consultor: sem filtro, so enxerga linhas de A (RLS)', !r.erro && r.linhas[0].n === 0, r.erro || '')
r = await como(C, `INSERT INTO public.ajustes_fatura (usuario_id, cartao_id, ano_mes, tipo, via) VALUES ($1, $2, '2026-11', 'credito', 'direto')`, [A, cI])
ok('consultor: INSERT direto em ajustes_fatura negado (42501)', r.code === '42501', `(${r.code} ${r.erro || 'sem erro'})`)
r = await como(C, `DELETE FROM public.ajustes_fatura WHERE usuario_id = $1`, [A])
ok('consultor: DELETE direto em ajustes_fatura negado (42501)', r.code === '42501', `(${r.code} ${r.erro || 'sem erro'})`)
r = await contaAj(B, A)
ok('usuario comum: B nao le ajustes de A mesmo com C autorizado', !r.erro && r.linhas[0].n === 0, r.erro || '')
r = await como(null, `SELECT count(*)::int AS n FROM public.ajustes_fatura`)
ok('anon: sem GRANT de SELECT em ajustes_fatura (42501)', r.code === '42501', `(${r.code} ${r.erro || 'sem erro'})`)
await db.query(`UPDATE public.consultoria_acessos SET status = 'revogado' WHERE consultor_id = $1 AND cliente_id = $2`, [C, A])
r = await contaAj(C, A)
ok('consultor: apos revogar, perde o acesso a ajustes de A', !r.erro && r.linhas[0].n === 0, r.erro || '')

// Item 2: cartao com pagamento legado (ativo e estornado) nao pode ser excluido; cascata de usuario como administrador funciona.
const nl = async (uid, nome, key) => {
  const c = await novoCartaoDe(uid, nome)
  await db.query(`INSERT INTO public.pagamentos_fatura (usuario_id, cartao_id, ano_mes, valor, data_pagamento, origem, status, legado, idempotency_key) VALUES ($1, $2, '2026-08', 120, '2026-08-20', 'outra_conta', 'ativo', TRUE, $3)`, [uid, c, key])
  return c
}
const cLeg = await nl(A, 'Legado ativo', 'legado-ativo-0001')
r = await como(A, `DELETE FROM public.cartoes WHERE id = $1`, [cLeg])
ok('cartao so com pagamento legado ATIVO nao e excluido (FP001)', r.code === FP, FP_(r))
await db.query(`UPDATE public.pagamentos_fatura SET status = 'estornado', estornado_em = now() WHERE cartao_id = $1`, [cLeg])
r = await como(A, `DELETE FROM public.cartoes WHERE id = $1`, [cLeg])
ok('cartao so com pagamento legado ESTORNADO nao e excluido (FP001, protecao nao depende de ativos)', r.code === FP, FP_(r))
r = (await db.query(`SELECT count(*)::int AS n FROM public.cartoes WHERE id = $1`, [cLeg])).rows[0]
ok('cartao com legado segue existindo apos as tentativas', r.n === 1)
// Cascata iniciada pelo proprio usuario nao e alcancavel: cartoes.usuario_id referencia auth.users (nao perfis) e usuario comum nao apaga auth.users.
// Por isso nao ha cenario para ela (um DELETE em perfis nao cascateia para cartoes e o teste seria vacuoso). Ver relatorio 12.2.
const cLegD = await nl(D, 'Legado de D', 'legado-d-000001')
r = await db.query(`SELECT 1`).then(() => db.exec(`DELETE FROM auth.users WHERE id = '${D}'`)).then(() => ({}), e => ({ erro: e.message, code: e.code }))
ok('cascata administrativa (DELETE em auth.users, auth.uid() nulo) remove cartoes e pagamentos legados', !r.erro && (await db.query(`SELECT (SELECT count(*) FROM public.cartoes WHERE usuario_id = $1)::int AS c, (SELECT count(*) FROM public.pagamentos_fatura WHERE usuario_id = $1)::int AS p`, [D])).rows.every(x => x.c === 0 && x.p === 0), r.erro || '')

// Item 3: alterar_historico_fatura dentro de SAVEPOINT.
const cSP = await novoCartaoDe(A, 'Savepoint')
const kSP = await novaCompraDe(A, cSP, 'SP', 1000)
r = await pagarSemDica(A, cSP, YM, 1000, 'sp-quita-00001')
ok('savepoint: fatura de 1000 quitada (pre-condicao)', !r.erro, r.erro || '')
const snapSP = async () => ({
  valor: await valorCompra(kSP),
  ajustes: (await db.query(`SELECT count(*)::int AS n FROM public.ajustes_fatura WHERE cartao_id = $1`, [cSP])).rows[0].n,
  pagos: (await pagosAtivos(cSP)).n
})
const baseSP = await snapSP()
// Executa passos numa unica transacao como A; o snapshot e lido como dono (RESET ROLE) e o papel volta em seguida.
async function emTx(fn) {
  await db.exec('BEGIN')
  try {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)`, [A])
    await db.exec(`SET LOCAL ROLE authenticated`)
    const q = async (sql, p) => { try { return { ...(await db.query(sql, p)) } } catch (e) { return { erro: e.message, code: e.code } } }
    const dono = async () => { await db.exec('RESET ROLE'); const s = { ...(await snapSP()), lib: (await db.query(`SELECT count(*)::int AS n FROM public._fatura_liberacoes WHERE txid = txid_current()`)).rows[0].n }; await db.exec('SET LOCAL ROLE authenticated'); return s }
    const out = await fn(q, dono)
    await db.exec('COMMIT')
    return out
  } catch (e) { await db.exec('ROLLBACK').catch(() => {}); return { falhou: e.message } }
}
const ed = (valor) => [ 'compras_cartao', kSP, 'editar', JSON.stringify({ valor_total: valor }), 'Teste de savepoint' ]
// 3a: sucesso dentro do savepoint, ROLLBACK TO SAVEPOINT desfaz tudo e a liberacao nao vaza.
let o = await emTx(async (q, dono) => {
  await q('SAVEPOINT s1')
  const a = await q(ALTERAR, ed(900))
  const dentro = await dono()
  await q('ROLLBACK TO SAVEPOINT s1')
  const depois = await dono()
  await q('SAVEPOINT s2')
  const dml = await q(`UPDATE public.compras_cartao SET valor_total = 1 WHERE id = $1`, [kSP])
  await q('ROLLBACK TO SAVEPOINT s2')
  return { a, dentro, depois, dml }
})
ok('savepoint/sucesso: alterar_historico_fatura aceito dentro do savepoint', !o.falhou && !o.a.erro && o.a.rows[0].r.ok === true, o.falhou || o.a?.erro || '')
ok('savepoint/sucesso: contagem de ajustes correta dentro do savepoint (edicao + credito = 2)', o.a?.rows?.[0]?.r?.ajustes === 2, JSON.stringify(o.a?.rows?.[0]?.r))
ok('savepoint/sucesso: dentro do savepoint valor 900 e 2 ajustes novos', o.dentro?.valor === 900 && o.dentro.ajustes === baseSP.ajustes + 2, JSON.stringify(o.dentro))
ok('savepoint/rollback: valor, ajustes e pagamentos voltam ao estado anterior', JSON.stringify({ valor: o.depois?.valor, ajustes: o.depois?.ajustes, pagos: o.depois?.pagos }) === JSON.stringify(baseSP), JSON.stringify(o.depois))
ok('savepoint/rollback: nenhuma liberacao da transacao sobra', o.depois?.lib === 0, JSON.stringify(o.depois))
ok('savepoint/rollback: DML direto depois do rollback segue recusado (liberacao nao vazou, FP001)', o.dml?.code === FP, `(${o.dml?.code} ${o.dml?.erro || 'sem erro'})`)
ok('savepoint: apos COMMIT o estado e o original', JSON.stringify(await snapSP()) === JSON.stringify(baseSP))
// 3b: erro DEPOIS de gravar a liberacao (data invalida estoura em jsonb_populate_record), rollback do savepoint.
o = await emTx(async (q, dono) => {
  await q('SAVEPOINT s3')
  const e1 = await q(ALTERAR, [ 'compras_cartao', kSP, 'editar', JSON.stringify({ data_compra: 'nao-e-data' }), 'Teste de erro' ])
  await q('ROLLBACK TO SAVEPOINT s3')
  const depois = await dono()
  await q('SAVEPOINT s4')
  const e2 = await q(ALTERAR, [ 'compras_cartao', kSP, 'editar', JSON.stringify({ valor_total: 900 }), 'abc' ])
  await q('ROLLBACK TO SAVEPOINT s4')
  await q('SAVEPOINT s5')
  const e3 = await q(ALTERAR, [ 'compras_cartao', kSP, 'editar', JSON.stringify({ valor_total: 900, cartao_id: cartaoB }), 'Teste de erro' ])
  await q('ROLLBACK TO SAVEPOINT s5')
  return { e1, e2, e3, depois, final: await dono() }
})
ok('savepoint/erro: data invalida falha com erro de dados (classe 22)', /^22/.test(o.e1?.code || ''), `(${o.e1?.code} ${o.e1?.erro || 'sem erro'})`)
ok('savepoint/erro: motivo curto falha com 22023 e cartao alheio com 42501', o.e2?.code === '22023' && o.e3?.code === '42501', `(${o.e2?.code}, ${o.e3?.code})`)
ok('savepoint/erro: apos ROLLBACK TO, auditoria, valor, pagamentos e liberacoes intactos', JSON.stringify({ valor: o.final?.valor, ajustes: o.final?.ajustes, pagos: o.final?.pagos, lib: o.final?.lib }) === JSON.stringify({ ...baseSP, lib: 0 }), JSON.stringify(o.final))
// 3c: sucesso com RELEASE e COMMIT: a razao fica consistente com o valor.
o = await emTx(async q => { await q('SAVEPOINT s6'); const a = await q(ALTERAR, ed(900)); await q('RELEASE SAVEPOINT s6'); return a })
const fim = await snapSP()
ok('savepoint/release+commit: valor 900, 2 ajustes novos, pagamento preservado', !o.falhou && fim.valor === 900 && fim.ajustes === baseSP.ajustes + 2 && fim.pagos === 1, JSON.stringify(fim))
r = await db.query(`SELECT count(*)::int AS n FROM public.ajustes_fatura WHERE cartao_id = $1 AND via = 'controlado' AND motivo = 'Teste de savepoint'`, [cSP])
ok('savepoint/release+commit: ajustes com via controlado e motivo', r.rows[0].n === 2, `(${r.rows[0].n})`)

// Item 5: _fatura_liberacoes e liberar_historico_zerar.
r = await como(A, `SELECT count(*)::int AS n FROM public._fatura_liberacoes`)
ok('liberacoes: authenticated nao le a tabela (42501)', r.code === '42501', `(${r.code} ${r.erro || 'sem erro'})`)
r = await como(A, `INSERT INTO public._fatura_liberacoes (txid, usuario_id, escopo) VALUES (txid_current(), $1, 'zerar')`, [A])
ok('liberacoes: authenticated nao forja linha por INSERT (42501)', r.code === '42501', `(${r.code} ${r.erro || 'sem erro'})`)
r = await como(null, `SELECT public.liberar_historico_zerar()`)
ok('liberacoes: anon nao executa liberar_historico_zerar (42501)', r.code === '42501', `(${r.code} ${r.erro || 'sem erro'})`)
let codSemId, erroSemId
try {
  await db.exec('BEGIN')
  await db.query(`SELECT set_config('request.jwt.claim.sub', '', true)`); await db.exec('SET LOCAL ROLE authenticated')
  await db.query(`SELECT public.liberar_historico_zerar()`)
} catch (e) { codSemId = e.code; erroSemId = e.message }
finally { await db.exec('ROLLBACK').catch(() => {}) }
ok('liberacoes: sem identidade (auth.uid() nulo) liberar recusa (28000)', codSemId === '28000', `(${codSemId} ${erroSemId || 'sem erro'})`)
const cLib = await novoCartaoDe(A, 'Liberacao')
const kLib = await novaCompraDe(A, cLib, 'LIB', 100)
r = await pagarSemDica(A, cLib, YM, 100, 'lib-quita-00001')
await como(A, `SELECT public.liberar_historico_zerar()`)
r = await como(A, `DELETE FROM public.compras_cartao WHERE id = $1`, [kLib])
ok('liberacoes: liberacao de transacao ja encerrada nao vale na seguinte (FP001)', r.code === FP, FP_(r))
let ativaDentro, ativaOutro, ativaApos, ativaEncerrada
try {
  await db.exec('BEGIN')
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [A]); await db.exec('SET LOCAL ROLE authenticated')
  await db.query(`SAVEPOINT l1`); await db.query(`SELECT public.liberar_historico_zerar()`)
  ativaDentro = (await db.query(`SELECT public.fatura_liberacao_ativa('zerar') AS a`)).rows[0].a
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [B])
  ativaOutro = (await db.query(`SELECT public.fatura_liberacao_ativa('zerar') AS a`)).rows[0].a
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [A])
  await db.query(`ROLLBACK TO SAVEPOINT l1`)
  ativaApos = (await db.query(`SELECT public.fatura_liberacao_ativa('zerar') AS a`)).rows[0].a
  await db.query(`SELECT public.liberar_historico_zerar()`); await db.query(`SELECT public.encerrar_liberacao_zerar()`)
  ativaEncerrada = (await db.query(`SELECT public.fatura_liberacao_ativa('zerar') AS a`)).rows[0].a
} catch (e) { ok('liberacoes: bloco de transacao e savepoint executou sem erro', false, e.message) }
finally { await db.exec('ROLLBACK').catch(() => {}) }
ok('liberacoes: ativa para o proprio usuario na transacao', ativaDentro === true)
ok('liberacoes: nao vale para outro usuario na mesma transacao', ativaOutro === false)
ok('liberacoes: ROLLBACK TO SAVEPOINT desfaz a liberacao', ativaApos === false)
ok('liberacoes: encerrar_liberacao_zerar desfaz a liberacao', ativaEncerrada === false)
// Residual documentado (nao e assercao): quem executa SQL arbitrario como o proprio usuario pode liberar e apagar o proprio historico.
let resid
try {
  await db.exec('BEGIN')
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [A]); await db.exec('SET LOCAL ROLE authenticated')
  await db.query(`SELECT public.liberar_historico_zerar()`)
  resid = await db.query(`DELETE FROM public.compras_cartao WHERE id = $1`, [kLib]).then(x => `apagou ${x.affectedRows}`, e => `recusado ${e.code}`)
} catch (e) { resid = `erro ${e.message}` }
finally { await db.exec('ROLLBACK').catch(() => {}) }
console.log(`INFO - residual documentado (SQL arbitrario do proprio usuario: liberar + DELETE na mesma transacao): ${resid}`)

// Item 4: custo dos triggers em carga (so mede e imprime, sem assercao de tempo). Ative com BENCH=1 (BENCH_N, padrao 2000).
if (process.env.BENCH) {
  const N = Number(process.env.BENCH_N || 2000)
  const bench = async (rotulo, cartao) => {
    const t0 = performance.now()
    const x = await como(A, `INSERT INTO public.compras_cartao (usuario_id, cartao_id, descricao, valor_total, data_compra, numero_parcelas) SELECT $1, $2, 'bench ' || g, 10, DATE '2026-12-05' + (g % 20), 1 FROM generate_series(1, $3::int) g`, [A, cartao, N])
    console.log(`BENCH - ${rotulo}: ${N} compras em ${(performance.now() - t0).toFixed(0)} ms ${x.erro || ''}`)
  }
  await bench('cartao sem pagamento', await novoCartaoDe(A, 'Bench sem pagamento'))
  const cBp = await novoCartaoDe(A, 'Bench com pagamento'); await novaCompraDe(A, cBp, 'base', 100); await pagarSemDica(A, cBp, YM, 100, 'bench-quita-0001')
  await bench('cartao com mes quitado (outro mes)', cBp)
  // Caso lento: linhas DENTRO do mes quitado (ciclo 2026-11, fechamento dia 20). Sem liberacao zerar (ela faz guarda e auditoria retornarem cedo)
  // e sem identidade (auth.uid() nulo, como dono/service role), o que passa pela auditoria e recalcula. Nao validado: se a guarda recusar, o erro e impresso.
  const cBq = await novoCartaoDe(A, 'Bench mes quitado'); await novaCompraDe(A, cBq, 'base', 100); await pagarSemDica(A, cBq, YM, 100, 'bench-quita-0002')
  const t1 = performance.now()
  let msg = ''
  try {
    await db.exec('BEGIN')
    await db.query(`SELECT set_config('request.jwt.claim.sub', '', true)`)
    await db.query(`INSERT INTO public.compras_cartao (usuario_id, cartao_id, descricao, valor_total, data_compra, numero_parcelas) SELECT $1, $2, 'bench ' || g, 10, DATE '2026-11-01' + (g % 15), 1 FROM generate_series(1, $3::int) g`, [A, cBq, N])
  } catch (e) { msg = e.message }
  finally { await db.exec('ROLLBACK').catch(() => {}) }
  console.log(`BENCH - cartao com linhas DENTRO do mes quitado (sem liberacao, uid nulo): ${N} compras em ${(performance.now() - t1).toFixed(0)} ms ${msg}`)
}

// Acúmulo de liberações: chamadas soltas repetidas deixam no máximo 1 linha por usuário.
for (let i = 0; i < 3; i++) await como(A, `SELECT public.liberar_historico_zerar()`)
r = await db.query(`SELECT count(*)::int AS n FROM public._fatura_liberacoes WHERE usuario_id = $1`, [A])
ok('_fatura_liberacoes: chamadas repetidas de liberar_historico_zerar não acumulam (1 linha)', r.rows[0].n === 1, `(${r.rows[0].n})`)

// 9) zerar_dados_financeiros funciona com fatura quitada e não toca nos dados de B.
const antesB = (await db.query(`SELECT (SELECT count(*) FROM public.pagamentos_fatura WHERE usuario_id = $1)::int AS p, (SELECT count(*) FROM public.ajustes_fatura WHERE usuario_id = $1)::int AS a, (SELECT count(*) FROM public.cartoes WHERE usuario_id = $1)::int AS c`, [B])).rows[0]
ok('zerar: B tem pagamento ativo antes (pré-condição)', antesB.p >= 1, JSON.stringify(antesB))
r = await como(A, `SELECT public.zerar_dados_financeiros() AS ok`)
ok('zerar_dados_financeiros funciona com faturas quitadas e histórico', !r.erro && r.linhas[0].ok === true, r.erro || '')
const depoisA = (await db.query(`SELECT (SELECT count(*) FROM public.pagamentos_fatura WHERE usuario_id = $1)::int AS p, (SELECT count(*) FROM public.ajustes_fatura WHERE usuario_id = $1)::int AS a, (SELECT count(*) FROM public.cartoes WHERE usuario_id = $1)::int AS c, (SELECT count(*) FROM public.compras_cartao WHERE usuario_id = $1)::int AS k`, [A])).rows[0]
ok('zerar: pagamentos, ajustes, cartões e compras de A zerados', depoisA.p === 0 && depoisA.a === 0 && depoisA.c === 0 && depoisA.k === 0, JSON.stringify(depoisA))
const depoisB = (await db.query(`SELECT (SELECT count(*) FROM public.pagamentos_fatura WHERE usuario_id = $1)::int AS p, (SELECT count(*) FROM public.ajustes_fatura WHERE usuario_id = $1)::int AS a, (SELECT count(*) FROM public.cartoes WHERE usuario_id = $1)::int AS c`, [B])).rows[0]
ok('zerar: dados de B (pagamentos, ajustes, cartões) intactos', JSON.stringify(depoisB) === JSON.stringify(antesB), `${JSON.stringify(antesB)} -> ${JSON.stringify(depoisB)}`)
r = await db.query(`SELECT p.prosecdef AS definer FROM pg_proc p WHERE p.oid = 'public.zerar_dados_financeiros()'::regprocedure`)
r = await db.query(`SELECT count(*)::int AS n FROM public._fatura_liberacoes WHERE usuario_id = $1`, [A])
ok('zerar: nenhuma liberação do usuário sobra após o zerar', r.rows[0].n === 0, `(${r.rows[0].n})`)
ok('zerar_dados_financeiros segue SECURITY INVOKER', r.rows[0].definer === false)
r = await db.query(`SELECT string_agg(t.tgname, ',' ORDER BY t.tgname) AS nomes FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE NOT t.tgisinternal AND c.relname = 'compras_cartao' AND t.tgrelid = 'public.compras_cartao'::regclass AND t.tgname IN ('aa_fatura_travar_cartao','ab_fatura_guardar_historico','zz_fatura_auditar_historico')`)
ok('ordem alfabética dos triggers: aa_ < ab_ < zz_', r.rows[0].nomes === 'aa_fatura_travar_cartao,ab_fatura_guardar_historico,zz_fatura_auditar_historico', r.rows[0].nomes)

console.log(falhas === 0 ? '\nsimulação sem falhas (PGlite; não é aprovação de banco)' : `\n${falhas} FALHA(S) na simulação`)
if (falhas) process.exitCode = 1
