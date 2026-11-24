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
const NOVAS = ['2026-11_atalhos_home.sql', '2026-11_onboarding_perfil.sql', '2026-11_importacoes.sql', '2026-11_compras_cartao_cartao_do_dono.sql', '2026-11_pagamentos_fatura.sql']
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
  } catch (e) { await db.exec('ROLLBACK'); return { erro: e.message } }
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
const hoje = new Date().toISOString().slice(0, 10)
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
try { await db.exec(ler('migrations/2026-11_pagamentos_fatura.sql')) } catch (e) { falhouExplicito = true; msgDep = e.message }
await db.exec('ROLLBACK').catch(() => {})
await db.exec(`ALTER FUNCTION public.consultor_autorizado_tmp(uuid) RENAME TO consultor_autorizado`)
ok('migration falha de forma explicita sem consultor_autorizado', falhouExplicito && /consultor_autorizado/.test(msgDep) && /2026-10_consultoria_acessos/.test(msgDep), msgDep)
// Concorrência: duas chamadas simultâneas com a MESMA chave não geram duas linhas.
await Promise.all([pagar(A, cartaoA, '2027-01', 50, 'chave-concorrente-1', 500), pagar(A, cartaoA, '2027-01', 50, 'chave-concorrente-1', 500)])
r = await como(A, `SELECT count(*)::int AS n FROM public.pagamentos_fatura WHERE ano_mes = '2027-01'`)
ok('chamadas simultâneas com a mesma chave geram 1 linha', r.linhas[0].n === 1, `(${r.linhas?.[0]?.n})`)
// Backfill legado
await db.exec(`SET session_replication_role = replica`)
await db.exec(`INSERT INTO public.faturas_cartao (id, usuario_id, cartao_id, ano_mes, valor_total, pago, pago_em) VALUES ('00000000-0000-4000-8000-0000000000f1', '${A}', '${cartaoA}', '2026-09', 250, TRUE, '2026-09-28') ON CONFLICT DO NOTHING`)
await db.exec(`SET session_replication_role = origin`)
await db.exec(ler('migrations/2026-11_pagamentos_fatura.sql'))
await db.exec(ler('migrations/2026-11_pagamentos_fatura.sql'))
r = await db.query(`SELECT count(*)::int AS n, bool_and(legado) AS l, bool_and(origem = 'outra_conta') AS o FROM public.pagamentos_fatura WHERE ano_mes = '2026-09'`)
ok('backfill cria 1 pagamento legado sem debitar saldo e é idempotente', r.rows[0].n === 1 && r.rows[0].l && r.rows[0].o, JSON.stringify(r.rows[0]))

r = await db.query(`SELECT count(*)::int AS n FROM public.perfis`)
ok('dados existentes preservados', r.rows[0].n === 2)

console.log(falhas === 0 ? '\nOK — simulação aprovada' : `\n${falhas} FALHA(S) na simulação`)
if (falhas) process.exitCode = 1
