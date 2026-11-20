// Simulação isolada (PGlite, em memória) da migration
// 2026-11_compras_cartao_cartao_do_dono.sql sobre o formato de PRODUÇÃO:
// tabelas e política FOR ALL copiadas de supabase/schema.sql. Não conecta a
// nenhum Supabase. Uso: node supabase/tests/compras-cartao-producao.mjs
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'fs'

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
let falhas = 0
const ok = (nome, cond, det = '') => { if (!cond) falhas++; console.log(`${cond ? 'PASS' : 'FALHA'} - ${nome} ${det}`) }

const db = new PGlite()
await db.exec(`
  CREATE ROLE authenticated NOLOGIN;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA public, auth TO authenticated;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated;
  CREATE TABLE public.cartoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome text NOT NULL, limite_total numeric(12,2) NOT NULL,
    dia_fechamento int NOT NULL, dia_vencimento int NOT NULL);
  ALTER TABLE public.cartoes ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Usuário gerencia apenas os próprios cartões" ON public.cartoes FOR ALL
    USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);
  CREATE TABLE public.compras_cartao (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cartao_id uuid NOT NULL REFERENCES public.cartoes(id) ON DELETE CASCADE,
    descricao text NOT NULL,
    valor_total numeric(12,2) NOT NULL CHECK (valor_total > 0),
    data_compra date NOT NULL,
    numero_parcelas int NOT NULL DEFAULT 1 CHECK (numero_parcelas > 0));
  ALTER TABLE public.compras_cartao ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Usuário gerencia apenas as próprias compras de cartão" ON public.compras_cartao FOR ALL
    USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartoes, public.compras_cartao TO authenticated;
  INSERT INTO auth.users VALUES ('${A}'), ('${B}');
  INSERT INTO public.cartoes (id, usuario_id, nome, limite_total, dia_fechamento, dia_vencimento) VALUES
    ('10000000-0000-4000-8000-00000000000a', '${A}', 'Cartão A', 5000, 20, 28),
    ('10000000-0000-4000-8000-00000000000b', '${B}', 'Cartão B', 3000, 10, 17);
  INSERT INTO public.compras_cartao (id, usuario_id, cartao_id, descricao, valor_total, data_compra) VALUES
    ('20000000-0000-4000-8000-00000000000a', '${A}', '10000000-0000-4000-8000-00000000000a', 'Compra existente', 120, '2026-11-02');
`)
const CARTAO_A = '10000000-0000-4000-8000-00000000000a'
const CARTAO_B = '10000000-0000-4000-8000-00000000000b'
const COMPRA_A = '20000000-0000-4000-8000-00000000000a'

async function como(uid, sql, params) {
  await db.exec('BEGIN')
  try {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [uid])
    await db.exec('SET LOCAL ROLE authenticated')
    const r = await db.query(sql, params)
    await db.exec('COMMIT')
    return { linhas: r.rows, afetadas: r.affectedRows ?? 0 }
  } catch (e) { await db.exec('ROLLBACK'); return { erro: e.message } }
}

const migration = readFileSync(new URL('../migrations/2026-11_compras_cartao_cartao_do_dono.sql', import.meta.url), 'utf8')
await db.exec(migration)
ok('aplica sobre o formato de produção', true)
await db.exec(migration)
ok('reaplica (idempotente)', true)

let r = await db.query(`SELECT count(*)::int AS n FROM public.compras_cartao`)
ok('compra existente preservada', r.rows[0].n === 1)
r = await db.query(`SELECT cmd FROM pg_policies WHERE tablename = 'compras_cartao' ORDER BY cmd`)
ok('políticas por operação, sem FOR ALL', JSON.stringify(r.rows.map(x => x.cmd)) === '["DELETE","INSERT","SELECT","UPDATE"]', JSON.stringify(r.rows.map(x => x.cmd)))
r = await como(A, `SELECT count(*)::int AS n FROM public.compras_cartao`)
ok('A continua vendo a própria compra', !r.erro && r.linhas[0].n === 1, r.erro || '')
r = await como(A, `INSERT INTO public.compras_cartao (usuario_id, cartao_id, descricao, valor_total, data_compra) VALUES ($1, $2, 'Nova', 50, '2026-11-12')`, [A, CARTAO_A])
ok('A grava no próprio cartão', !r.erro, r.erro || '')
r = await como(A, `INSERT INTO public.compras_cartao (usuario_id, cartao_id, descricao, valor_total, data_compra) VALUES ($1, $2, 'Indevida', 50, '2026-11-12')`, [A, CARTAO_B])
ok('A não grava no cartão de B', !!r.erro)
r = await como(A, `UPDATE public.compras_cartao SET cartao_id = $1 WHERE id = $2`, [CARTAO_B, COMPRA_A])
ok('A não move compra para o cartão de B', !!r.erro || r.afetadas === 0)
r = await como(B, `UPDATE public.compras_cartao SET valor_total = 1 WHERE id = $1`, [COMPRA_A])
ok('B não altera compra de A', !r.erro && r.afetadas === 0, r.erro || '')
r = await como(B, `DELETE FROM public.compras_cartao WHERE id = $1`, [COMPRA_A])
ok('B não apaga compra de A', !r.erro && r.afetadas === 0, r.erro || '')
r = await como(A, `DELETE FROM public.compras_cartao WHERE id = $1`, [COMPRA_A])
ok('A apaga a própria compra', !r.erro && r.afetadas === 1, r.erro || '')

console.log(falhas === 0 ? '\nOK - simulação de produção aprovada' : `\n${falhas} FALHA(S)`)
if (falhas) process.exitCode = 1
