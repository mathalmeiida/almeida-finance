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
const NOVAS = ['2026-11_atalhos_home.sql', '2026-11_onboarding_perfil.sql', '2026-11_importacoes.sql']
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
ok('índices criados', idx.includes('idx_importacoes_usuario') && idx.includes('idx_importacoes_itens_importacao') && idx.includes('importacoes_itens_chave_unica'))
r = await db.query(`SELECT count(*)::int AS n FROM public.perfis`)
ok('dados existentes preservados', r.rows[0].n === 2)

console.log(falhas === 0 ? '\nOK — simulação aprovada' : `\n${falhas} FALHA(S) na simulação`)
if (falhas) process.exitCode = 1
