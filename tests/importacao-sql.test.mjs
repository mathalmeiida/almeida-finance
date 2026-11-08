// Testes da migration 2026-11_importacao_inteligente.sql em um Postgres real
// (PGlite, em memória). Simula o Supabase: schema auth, auth.uid() e o papel
// "authenticated" sujeito às policies RLS. Não toca em nenhum banco remoto.
// Executar: npm run test:importacao-sql

import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

let falhas = 0, total = 0
function ok(nome, cond, det = '') {
  total++
  if (!cond) falhas++
  console.log(`${cond ? 'PASS' : 'FALHA'} — ${nome}${!cond && det ? ` (${det})` : ''}`)
}

const db = new PGlite()
const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'

// ─── Estrutura mínima equivalente ao Supabase + tabelas do app ───────────────
await db.exec(`
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id UUID PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID $$;
  CREATE ROLE anon; CREATE ROLE authenticated;
  GRANT USAGE ON SCHEMA auth, public TO authenticated, anon;
  GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
  INSERT INTO auth.users VALUES ('${A}'), ('${B}');

  CREATE TABLE public.perfis (id UUID PRIMARY KEY REFERENCES auth.users(id), nome TEXT, ativo BOOLEAN NOT NULL DEFAULT TRUE);
  INSERT INTO public.perfis (id, nome) VALUES ('${A}', 'A'), ('${B}', 'B');
  CREATE TABLE public.categorias (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID REFERENCES auth.users(id), nome TEXT NOT NULL, tipo TEXT);
  ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
  CREATE POLICY c_sel ON public.categorias FOR SELECT USING (usuario_id IS NULL OR auth.uid() = usuario_id);
  INSERT INTO public.categorias (id, usuario_id, nome, tipo) VALUES
    ('aaaaaaaa-0000-0000-0000-000000000001', NULL, 'Alimentação', 'despesa'),
    ('bbbbbbbb-0000-0000-0000-000000000001', '${B}', 'Categoria do B', 'despesa');

  CREATE TABLE public.cartoes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID NOT NULL REFERENCES auth.users(id), nome TEXT NOT NULL);
  ALTER TABLE public.cartoes ENABLE ROW LEVEL SECURITY;
  CREATE POLICY ca ON public.cartoes FOR ALL USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);
  INSERT INTO public.cartoes (id, usuario_id, nome) VALUES
    ('cccccccc-0000-0000-0000-00000000000a', '${A}', 'Cartão A'),
    ('cccccccc-0000-0000-0000-00000000000b', '${B}', 'Cartão B');

  CREATE TABLE public.despesas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID NOT NULL REFERENCES auth.users(id),
    descricao TEXT NOT NULL, valor NUMERIC(12,2) NOT NULL CHECK (valor > 0), data DATE NOT NULL,
    recorrente BOOLEAN DEFAULT FALSE, categoria_id UUID REFERENCES public.categorias(id),
    tipo_despesa TEXT DEFAULT 'variavel', recorrencia_meses INTEGER, frequencia TEXT DEFAULT 'nao_repete',
    forma_pagamento TEXT, cartao_id UUID, pago_em DATE, criado_em TIMESTAMPTZ DEFAULT NOW());
  ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;
  CREATE POLICY d ON public.despesas FOR ALL USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);

  CREATE TABLE public.receitas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID NOT NULL REFERENCES auth.users(id),
    descricao TEXT NOT NULL, valor NUMERIC(12,2) NOT NULL CHECK (valor > 0), data DATE NOT NULL,
    recorrente BOOLEAN DEFAULT FALSE, categoria TEXT, frequencia TEXT, criado_em TIMESTAMPTZ DEFAULT NOW());
  ALTER TABLE public.receitas ENABLE ROW LEVEL SECURITY;
  CREATE POLICY r ON public.receitas FOR ALL USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);

  CREATE TABLE public.compras_cartao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID NOT NULL REFERENCES auth.users(id),
    cartao_id UUID NOT NULL REFERENCES public.cartoes(id), descricao TEXT NOT NULL,
    valor_total NUMERIC(12,2) NOT NULL CHECK (valor_total > 0), data_compra DATE NOT NULL,
    numero_parcelas INTEGER NOT NULL DEFAULT 1, categoria_id UUID REFERENCES public.categorias(id),
    criado_em TIMESTAMPTZ DEFAULT NOW());
  ALTER TABLE public.compras_cartao ENABLE ROW LEVEL SECURITY;
  CREATE POLICY cc ON public.compras_cartao FOR ALL USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);
`)
// Tabelas reais de investimentos (migration existente) + a nova migration.
await db.exec(readFileSync(new URL('../supabase/migrations/2026-10_investimentos.sql', import.meta.url), 'utf8'))
await db.exec(readFileSync(new URL('../supabase/migrations/2026-11_importacao_inteligente.sql', import.meta.url), 'utf8'))
await db.exec(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;`)
ok('migration aplicada (idempotente: segunda execução sem erro)', await db.exec(readFileSync(new URL('../supabase/migrations/2026-11_importacao_inteligente.sql', import.meta.url), 'utf8')).then(() => true, () => false))

async function como(uid, sql, params = []) {
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '${uid || ''}', false); SET ROLE authenticated;`)
  try { return await db.query(sql, params) } finally { await db.exec('RESET ROLE;') }
}
async function erroDe(uid, sql, params) {
  try { await como(uid, sql, params); return null } catch (e) { return e.message }
}
const confirmar = (uid, payload) => como(uid, 'SELECT public.importacao_confirmar($1::jsonb) AS r', [JSON.stringify(payload)])
const arquivo = { formato: 'csv', hash: 'a'.repeat(64), tamanho: 1234 }

// ─── Extrato bancário ────────────────────────────────────────────────────────
const pBanco = {
  tipo_documento: 'extrato_bancario', instituicao: 'Itaú', arquivos: [arquivo],
  periodo_inicio: '2026-10-01', periodo_fim: '2026-10-31', total_identificados: 4, total_ignorados: 1, total_duplicados: 0,
  itens: [
    { acao: 'criar', tabela: 'despesas', impressao: 'imp-1', dados: { descricao: 'SUPERMERCADO', valor: 250.4, data: '2026-10-02', categoria_id: 'aaaaaaaa-0000-0000-0000-000000000001', tipo_despesa: 'variavel', forma_pagamento: 'pix' } },
    { acao: 'criar', tabela: 'despesas', impressao: 'imp-2', dados: { descricao: 'UBER', valor: 23.9, data: '2026-10-03', categoria_id: null, forma_pagamento: 'xpto' } },
    { acao: 'criar', tabela: 'receitas', impressao: 'imp-3', dados: { descricao: 'SALARIO', valor: 5000, data: '2026-10-01', categoria: 'Salário' } },
  ],
  regras: [{ destino: 'despesas', padrao: 'SUPERMERCADO', categoria_id: 'aaaaaaaa-0000-0000-0000-000000000001' }, { destino: 'receitas', padrao: 'SALARIO', categoria_nome: 'Salário' }],
}
const rBanco = (await confirmar(A, pBanco)).rows[0].r
ok('extrato: 3 registros criados', rBanco.criados === 3, JSON.stringify(rBanco))
ok('extrato: regras aprendidas gravadas', rBanco.regras === 2)
const despA = (await como(A, 'SELECT * FROM public.despesas ORDER BY data')).rows
ok('despesas gravadas sem recorrência', despA.length === 2 && despA.every(d => d.frequencia === 'nao_repete' && d.recorrente === false))
ok('forma de pagamento fora da lista é descartada', despA.find(d => d.descricao === 'UBER').forma_pagamento === null)
ok('histórico: importação com totais', (await como(A, 'SELECT total_aceitos, total_ignorados, status FROM public.importacoes')).rows[0].total_aceitos === 3)
ok('itens vinculados com hash e impressão', (await como(A, "SELECT count(*)::int n FROM public.importacoes_itens WHERE hash_registro IS NOT NULL AND impressao_digital LIKE 'imp-%'")).rows[0].n === 3)
await confirmar(A, { ...pBanco, itens: [pBanco.itens[0]], regras: [pBanco.regras[0]] })
ok('regra reforçada (usos = 2), sem duplicar', (await como(A, "SELECT usos FROM public.importacao_regras_categoria WHERE padrao = 'SUPERMERCADO'")).rows[0].usos === 2)

// ─── Isolamento entre usuários ───────────────────────────────────────────────
ok('B não vê importações de A', (await como(B, 'SELECT count(*)::int n FROM public.importacoes')).rows[0].n === 0)
ok('B não vê regras de A', (await como(B, 'SELECT count(*)::int n FROM public.importacao_regras_categoria')).rows[0].n === 0)
const idImpA = (await como(A, 'SELECT id FROM public.importacoes ORDER BY criado_em LIMIT 1')).rows[0].id
ok('B não consegue desfazer importação de A', (await erroDe(B, 'SELECT public.importacao_desfazer($1)', [idImpA]))?.includes('não encontrada'))
ok('sem login: recusado', (await erroDe(null, 'SELECT public.importacao_confirmar($1::jsonb)', [JSON.stringify(pBanco)]))?.includes('Não autenticado'))
const erroCatB = await erroDe(A, 'SELECT public.importacao_confirmar($1::jsonb)', [JSON.stringify({ ...pBanco, itens: [{ ...pBanco.itens[0], dados: { ...pBanco.itens[0].dados, categoria_id: 'bbbbbbbb-0000-0000-0000-000000000001' } }] })])
ok('categoria personalizada de outro usuário é recusada', erroCatB?.includes('categoria inválida'), erroCatB)

// ─── Validação e atomicidade ─────────────────────────────────────────────────
const antes = (await como(A, 'SELECT count(*)::int n FROM public.despesas')).rows[0].n
const eValor = await erroDe(A, 'SELECT public.importacao_confirmar($1::jsonb)', [JSON.stringify({ ...pBanco, itens: [pBanco.itens[0], { ...pBanco.itens[1], dados: { ...pBanco.itens[1].dados, valor: -5 } }] })])
ok('valor inválido: erro indica o lançamento', eValor?.includes('Lançamento 2'), eValor)
ok('valor inválido: nada é gravado (rollback total)', (await como(A, 'SELECT count(*)::int n FROM public.despesas')).rows[0].n === antes)
ok('data fora do limite recusada', (await erroDe(A, 'SELECT public.importacao_confirmar($1::jsonb)', [JSON.stringify({ ...pBanco, itens: [{ ...pBanco.itens[0], dados: { ...pBanco.itens[0].dados, data: '1980-01-01' } }] })]))?.includes('data'))
ok('hash de arquivo inválido recusado', (await erroDe(A, 'SELECT public.importacao_confirmar($1::jsonb)', [JSON.stringify({ ...pBanco, arquivos: [{ ...arquivo, hash: 'x' }] })]))?.includes('arquivo'))
ok('mais de 2.000 itens recusado', (await erroDe(A, 'SELECT public.importacao_confirmar($1::jsonb)', [JSON.stringify({ ...pBanco, itens: Array(2001).fill(pBanco.itens[0]) })]))?.includes('2.000'))
await db.exec(`UPDATE public.perfis SET ativo = FALSE WHERE id = '${B}'`)
ok('conta desativada não importa', (await erroDe(B, 'SELECT public.importacao_confirmar($1::jsonb)', [JSON.stringify(pBanco)]))?.includes('desativada'))
await db.exec(`UPDATE public.perfis SET ativo = TRUE WHERE id = '${B}'`)

// ─── Fatura de cartão ────────────────────────────────────────────────────────
const compra = { acao: 'criar', tabela: 'compras_cartao', impressao: 'f-1', dados: { cartao_id: 'cccccccc-0000-0000-0000-00000000000a', descricao: 'MERCADO LIVRE', valor_total: 1500, data_compra: '2026-08-05', numero_parcelas: 10, categoria_id: null } }
const rFat = (await confirmar(A, { tipo_documento: 'fatura_cartao', arquivos: [{ ...arquivo, formato: 'pdf' }], itens: [compra] })).rows[0].r
ok('fatura: compra parcelada gravada uma vez (10x)', rFat.criados === 1 && (await como(A, 'SELECT numero_parcelas FROM public.compras_cartao')).rows[0].numero_parcelas === 10)
ok('fatura: cartão de outro usuário recusado', (await erroDe(A, 'SELECT public.importacao_confirmar($1::jsonb)', [JSON.stringify({ tipo_documento: 'fatura_cartao', itens: [{ ...compra, dados: { ...compra.dados, cartao_id: 'cccccccc-0000-0000-0000-00000000000b' } }] })]))?.includes('cartão inválido'))
ok('fatura: parcelas > 120 recusadas', (await erroDe(A, 'SELECT public.importacao_confirmar($1::jsonb)', [JSON.stringify({ tipo_documento: 'fatura_cartao', itens: [{ ...compra, dados: { ...compra.dados, numero_parcelas: 500 } }] })]))?.includes('parcelas'))

// ─── Investimentos ───────────────────────────────────────────────────────────
await como(A, `INSERT INTO public.investimentos (usuario_id, nome, categoria, valor_aplicado, valor_atual, quantidade) VALUES ('${A}', 'PETR4', 'acoes', 1800, 2000, 60)`)
const idPetr = (await como(A, "SELECT id FROM public.investimentos WHERE nome = 'PETR4'")).rows[0].id
const pInv = {
  tipo_documento: 'extrato_investimentos', arquivos: [{ ...arquivo, formato: 'xlsx' }],
  itens: [
    { acao: 'criar', tabela: 'investimentos', ref: 'novo:MXRF11', impressao: 'i-0', dados: { nome: 'MXRF11', categoria: 'fii', valor_atual: 105, valor_aplicado: 0, quantidade: 10 } },
    { acao: 'criar', tabela: 'investimentos_movimentacoes', impressao: 'i-1', dados: { investimento_ref: 'novo:MXRF11', tipo: 'rendimento', valor: 12.3, data: '2026-09-17' } },
    { acao: 'criar', tabela: 'investimentos_movimentacoes', impressao: 'i-2', dados: { investimento_id: idPetr, tipo: 'dividendo', valor: 150, data: '2026-09-15' } },
    { acao: 'conciliar', tabela: 'investimentos', registro_id: idPetr, impressao: 'i-3', dados: { valor_atual: 3040, quantidade: 80 } },
  ],
}
const rInv = (await confirmar(A, pInv)).rows[0].r
ok('investimentos: 3 criados + 1 conciliado', rInv.criados === 3 && rInv.alterados === 1, JSON.stringify(rInv))
const petr = (await como(A, 'SELECT valor_atual, valor_aplicado, quantidade FROM public.investimentos WHERE id = $1', [idPetr])).rows[0]
ok('conciliação SUBSTITUI o valor atual (3.040), sem somar movimentos', Number(petr.valor_atual) === 3040 && Number(petr.valor_aplicado) === 1800 && Number(petr.quantidade) === 80)
ok('movimentações importadas não afetam saldo (afeta_saldo = false)', (await como(A, 'SELECT bool_and(NOT afeta_saldo) ok FROM public.investimentos_movimentacoes')).rows[0].ok === true)
ok('movimentação ligada ao investimento novo pela referência', (await como(A, "SELECT count(*)::int n FROM public.investimentos_movimentacoes m JOIN public.investimentos i ON i.id = m.investimento_id WHERE i.nome = 'MXRF11'")).rows[0].n === 1)
ok('investimento de outro usuário recusado', (await erroDe(B, 'SELECT public.importacao_confirmar($1::jsonb)', [JSON.stringify({ ...pInv, itens: [pInv.itens[2]] })]))?.includes('investimento inválido'))

// ─── Duplicidade: complementar e substituir ─────────────────────────────────
await como(A, `INSERT INTO public.despesas (usuario_id, descricao, valor, data) VALUES ('${A}', 'Mercado manual', 80, '2026-10-20')`)
await como(A, `INSERT INTO public.despesas (usuario_id, descricao, valor, data, frequencia, recorrente) VALUES ('${A}', 'Aluguel', 2000, '2026-01-05', 'mensal', TRUE)`)
const idManual = (await como(A, "SELECT id FROM public.despesas WHERE descricao = 'Mercado manual'")).rows[0].id
const idAluguel = (await como(A, "SELECT id FROM public.despesas WHERE descricao = 'Aluguel'")).rows[0].id
const rComp = (await confirmar(A, { tipo_documento: 'extrato_bancario', itens: [
  { acao: 'complementar', tabela: 'despesas', registro_id: idManual, impressao: 'k-1', dados: { descricao: 'MERCADO X', valor: 80, data: '2026-10-20', categoria_id: 'aaaaaaaa-0000-0000-0000-000000000001' } },
] })).rows[0].r
const manual = (await como(A, 'SELECT descricao, categoria_id FROM public.despesas WHERE id = $1', [idManual])).rows[0]
ok('complementar: preenche só a categoria vazia, mantém a descrição', rComp.alterados === 1 && manual.descricao === 'Mercado manual' && manual.categoria_id === 'aaaaaaaa-0000-0000-0000-000000000001')
ok('substituir lançamento recorrente é recusado', (await erroDe(A, 'SELECT public.importacao_confirmar($1::jsonb)', [JSON.stringify({ tipo_documento: 'extrato_bancario', itens: [{ acao: 'substituir', tabela: 'despesas', registro_id: idAluguel, dados: { descricao: 'ALUGUEL', valor: 2100, data: '2026-10-05' } }] })]))?.includes('recorrente'))

// ─── Desfazer ────────────────────────────────────────────────────────────────
const idImpComp = rComp.importacao_id
const rDesComp = (await como(A, 'SELECT public.importacao_desfazer($1) r', [idImpComp])).rows[0].r
ok('desfazer complemento restaura o estado anterior', rDesComp.desfeitos === 1 && (await como(A, 'SELECT categoria_id FROM public.despesas WHERE id = $1', [idManual])).rows[0].categoria_id === null)
ok('desfazer de novo é recusado', (await erroDe(A, 'SELECT public.importacao_desfazer($1)', [idImpComp]))?.includes('já foi desfeita'))

// Extrato: usuário edita uma despesa depois → ela é preservada
const idUber = (await como(A, "SELECT id FROM public.despesas WHERE descricao = 'UBER'")).rows[0].id
await como(A, "UPDATE public.despesas SET valor = 30 WHERE id = $1", [idUber])
const rDes = (await como(A, 'SELECT public.importacao_desfazer($1) r', [rBanco.importacao_id])).rows[0].r
ok('desfazer: 2 removidos, 1 preservado (alterado depois)', rDes.desfeitos === 2 && rDes.mantidos === 1, JSON.stringify(rDes))
ok('despesa editada continua no app', (await como(A, 'SELECT count(*)::int n FROM public.despesas WHERE id = $1', [idUber])).rows[0].n === 1)
ok('status = desfeita_parcial', (await como(A, 'SELECT status FROM public.importacoes WHERE id = $1', [rBanco.importacao_id])).rows[0].status === 'desfeita_parcial')

// Investimentos: conciliação restaurada; investimento novo removido com suas movimentações
const rDesInv = (await como(A, 'SELECT public.importacao_desfazer($1) r', [rInv.importacao_id])).rows[0].r
const petr2 = (await como(A, 'SELECT valor_atual, quantidade FROM public.investimentos WHERE id = $1', [idPetr])).rows[0]
ok('desfazer conciliação volta o valor atual (2.000) e a quantidade (60)', Number(petr2.valor_atual) === 2000 && Number(petr2.quantidade) === 60)
ok('desfazer remove investimento criado e movimentações importadas', rDesInv.desfeitos === 4 && (await como(A, "SELECT count(*)::int n FROM public.investimentos WHERE nome = 'MXRF11'")).rows[0].n === 0, JSON.stringify(rDesInv))

// Investimento novo com movimentação lançada DEPOIS pelo usuário → preservado
const rInv2 = (await confirmar(A, { ...pInv, itens: [pInv.itens[0]] })).rows[0].r
const idMx = (await como(A, "SELECT id FROM public.investimentos WHERE nome = 'MXRF11'")).rows[0].id
await como(A, `INSERT INTO public.investimentos_movimentacoes (usuario_id, investimento_id, tipo, valor, data) VALUES ('${A}', '${idMx}', 'aporte', 100, '2026-11-01')`)
const rDesInv2 = (await como(A, 'SELECT public.importacao_desfazer($1) r', [rInv2.importacao_id])).rows[0].r
ok('investimento com movimentação posterior não é apagado', rDesInv2.mantidos === 1 && (await como(A, 'SELECT count(*)::int n FROM public.investimentos WHERE id = $1', [idMx])).rows[0].n === 1)

// Registro apagado manualmente → "já removido"
const rFat2 = (await confirmar(A, { tipo_documento: 'fatura_cartao', itens: [{ ...compra, impressao: 'f-2' }] })).rows[0].r
await como(A, "DELETE FROM public.compras_cartao WHERE id = (SELECT registro_id FROM public.importacoes_itens WHERE impressao_digital = 'f-2')")
ok('registro já apagado pelo usuário é apenas sinalizado', (await como(A, 'SELECT public.importacao_desfazer($1) r', [rFat2.importacao_id])).rows[0].r.ja_removidos === 1)

// ─── Retenção ────────────────────────────────────────────────────────────────
await db.exec(`UPDATE public.importacoes SET expira_em = NOW() - INTERVAL '1 day' WHERE id = '${rFat.importacao_id}'`)
await confirmar(A, { ...pBanco, itens: [pBanco.itens[0]], regras: [] })
ok('histórico expirado é apagado na próxima importação', (await como(A, 'SELECT count(*)::int n FROM public.importacoes WHERE id = $1', [rFat.importacao_id])).rows[0].n === 0)
ok('lançamento financeiro do histórico expirado continua no app', (await como(A, "SELECT count(*)::int n FROM public.compras_cartao WHERE descricao = 'MERCADO LIVRE'")).rows[0].n >= 1)
ok('usuário pode remover o próprio histórico', await como(A, 'DELETE FROM public.importacoes WHERE id = $1', [rInv2.importacao_id]).then(() => true, () => false))

console.log(`\n${total - falhas}/${total} testes passaram.`)
if (falhas) { console.log(`${falhas} FALHA(S)`); process.exit(1) }
