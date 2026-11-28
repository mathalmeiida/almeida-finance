-- Almeida Finance Pro / Etapa 2. Validar DEV antes de PROD.
-- Não executar junto com outras migrations. Não altera lançamentos existentes.
BEGIN;
DO $$ DECLARE item text; BEGIN
  FOREACH item IN ARRAY ARRAY['perfis.id','perfis.papel','perfis.ativo','consultoria_acessos.consultor_id','consultoria_acessos.cliente_id','consultoria_acessos.status','receitas.usuario_id','receitas.valor','receitas.data','despesas.usuario_id','despesas.valor','despesas.data','faturas_cartao.usuario_id','faturas_cartao.ano_mes','faturas_cartao.valor_total'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=split_part(item,'.',1) AND column_name=split_part(item,'.',2)) THEN
      RAISE EXCEPTION 'Coluna obrigatória ausente: %', item;
    END IF;
  END LOOP;
END $$;
DO $$ BEGIN
  IF to_regclass('public.consultoria_acessos') IS NULL OR to_regprocedure('public.e_admin()') IS NULL THEN
    RAISE EXCEPTION 'Instale primeiro a migration de consultoria da Etapa 1';
  END IF;
END $$;

-- Verifica identidade real, papel, atividade e consentimento a cada chamada.
CREATE OR REPLACE FUNCTION public.consultor_autorizado(dono_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND dono_id <> auth.uid() AND EXISTS (
    SELECT 1 FROM public.consultoria_acessos a
    JOIN public.perfis c ON c.id = a.consultor_id
    JOIN public.perfis p ON p.id = a.cliente_id
    WHERE a.consultor_id = auth.uid() AND a.cliente_id = dono_id
      AND a.status = 'autorizado' AND c.papel = 'admin' AND c.ativo IS TRUE AND p.ativo IS TRUE
  );
$$;
REVOKE ALL ON FUNCTION public.consultor_autorizado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consultor_autorizado(uuid) TO authenticated;

-- A solicitação nasce pendente: o consultor não pode se autoautorizar por INSERT.
DROP POLICY IF EXISTS "Acessos: solicitar (admin consultor)" ON public.consultoria_acessos;
CREATE POLICY "Acessos: solicitar (admin consultor)" ON public.consultoria_acessos FOR INSERT TO authenticated
  WITH CHECK (public.e_admin() AND auth.uid() = consultor_id AND status = 'pendente' AND respondido_em IS NULL);
-- Registros profissionais privados, em histórico append-only. Não são lançamentos.
CREATE TABLE IF NOT EXISTS public.af_pro_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('nota','plano')),
  conteudo text NOT NULL CHECK (char_length(btrim(conteudo)) BETWEEN 1 AND 4000),
  criado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (consultor_id <> cliente_id)
);
ALTER TABLE public.af_pro_registros ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS af_pro_registros_vinculo_idx ON public.af_pro_registros(consultor_id,cliente_id,criado_em DESC);
DROP POLICY IF EXISTS af_pro_registros_leitura ON public.af_pro_registros;
CREATE POLICY af_pro_registros_leitura ON public.af_pro_registros FOR SELECT TO authenticated
  USING (consultor_id = auth.uid() AND public.consultor_autorizado(cliente_id));
DROP POLICY IF EXISTS af_pro_registros_insercao ON public.af_pro_registros;
CREATE POLICY af_pro_registros_insercao ON public.af_pro_registros FOR INSERT TO authenticated
  WITH CHECK (consultor_id = auth.uid() AND public.consultor_autorizado(cliente_id));
REVOKE ALL ON public.af_pro_registros FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.af_pro_registros TO authenticated;
GRANT INSERT (consultor_id,cliente_id,tipo,conteudo) ON public.af_pro_registros TO authenticated;

-- RPC devolve somente os campos e agregados necessários, nunca dados de outro cliente.
-- SECURITY DEFINER é deliberado: mesmo com perfis visíveis ao admin, esta função
-- só retorna informação após consentimento. Não executa SQL dinâmico nem escritas.
CREATE OR REPLACE FUNCTION public.af_pro_ficha_cliente(p_cliente uuid, p_mes date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil jsonb;
  v_inicio date;
  v_fim date;
  v_receitas numeric;
  v_despesas numeric;
  v_qr bigint;
  v_qd bigint;
  v_faturas numeric;
  v_registros jsonb;
BEGIN
  IF public.consultor_autorizado(p_cliente) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Acesso de consultoria não autorizado' USING ERRCODE='42501';
  END IF;
  IF p_mes IS NULL OR p_mes < DATE '2000-01-01' OR p_mes >= DATE '2101-01-01' THEN
    RAISE EXCEPTION 'Mês inválido' USING ERRCODE='22023';
  END IF;
  v_inicio := date_trunc('month',p_mes::timestamp)::date;
  v_fim := (v_inicio + interval '1 month')::date;
  SELECT to_jsonb(p) INTO STRICT v_perfil FROM public.perfis p WHERE p.id=p_cliente;
  SELECT sum(r.valor),count(*) INTO v_receitas,v_qr FROM public.receitas r
    WHERE r.usuario_id=p_cliente AND r.data>=v_inicio AND r.data<v_fim;
  SELECT sum(d.valor),count(*) INTO v_despesas,v_qd FROM public.despesas d
    WHERE d.usuario_id=p_cliente AND d.data>=v_inicio AND d.data<v_fim;
  -- Usa somente faturas consolidadas cadastradas, não deduz saldo de empréstimos.
  SELECT sum(CASE WHEN COALESCE((to_jsonb(f)->>'pago')::boolean,false) THEN 0
    ELSE greatest(0,f.valor_total - COALESCE((to_jsonb(f)->>'valor_pago_acumulado')::numeric,0)) END)
    INTO v_faturas FROM public.faturas_cartao f
    WHERE f.usuario_id=p_cliente AND f.ano_mes=to_char(v_inicio,'YYYY-MM');
  SELECT COALESCE(jsonb_agg(to_jsonb(n) ORDER BY n.criado_em DESC),'[]'::jsonb) INTO v_registros
    FROM (SELECT id,tipo,conteudo,criado_em FROM public.af_pro_registros
      WHERE consultor_id=auth.uid() AND cliente_id=p_cliente ORDER BY criado_em DESC LIMIT 100) n;
  RETURN jsonb_build_object('cliente_id',p_cliente,'nome',v_perfil->>'nome','email',v_perfil->>'email',
    'saldo_base',v_perfil->'saldo_base','reserva_atual',v_perfil->'reserva_atual','meta_reserva',v_perfil->'meta_reserva',
    'receitas',v_receitas,'despesas',v_despesas,'qtd_receitas',v_qr,'qtd_despesas',v_qd,
    'faturas_abertas',v_faturas,'registros',v_registros);
END $$;
REVOKE ALL ON FUNCTION public.af_pro_ficha_cliente(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.af_pro_ficha_cliente(uuid,date) TO authenticated;

-- Registro do login: apenas a própria conta e horário do servidor.
CREATE OR REPLACE FUNCTION public.af_pro_registrar_login()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501'; END IF;
  UPDATE public.perfis SET ultimo_acesso=now() WHERE id=auth.uid() AND ativo IS TRUE;
END $$;
REVOKE ALL ON FUNCTION public.af_pro_registrar_login() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.af_pro_registrar_login() TO authenticated;

-- O visualizador antigo usa SELECT diretamente. Completa as policies de leitura
-- apenas nas tabelas conhecidas que já têm RLS ativa e coluna de proprietário.
-- Não concede nenhum privilégio adicional de escrita.
DO $$ DECLARE t text; pol text; BEGIN
  FOREACH t IN ARRAY ARRAY['receitas','despesas','cartoes','compras_cartao','metas','parcelamentos','despesas_tipo_excecoes','faturas_cartao','pagamentos_fatura','categorias','subcategorias'] LOOP
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='usuario_id') THEN
      IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=t AND c.relrowsecurity) THEN
        RAISE EXCEPTION 'RLS não ativa na tabela %',t;
      END IF;
      pol:='af_pro_leitura_autorizada';
      IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=pol) THEN
        EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.consultor_autorizado(usuario_id))',pol,t);
      END IF;
    END IF;
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='af_pro_registros';
