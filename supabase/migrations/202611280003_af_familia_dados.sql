-- Validação DEV: dados compartilhados somente dentro do grupo autorizado.
-- Não toca receitas, despesas, cartões, investimentos ou metas pessoais.
BEGIN;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT schemaname,tablename,policyname FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename IN ('family_expense_splits','family_split_participants','family_goals','family_goal_contributions')
  LOOP EXECUTE format('DROP POLICY %I ON %I.%I',r.policyname,r.schemaname,r.tablename); END LOOP;
END $$;
ALTER TABLE public.family_expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_split_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_goal_contributions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_expense_splits,public.family_split_participants,public.family_goals,public.family_goal_contributions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.family_expense_splits,public.family_split_participants,public.family_goals,public.family_goal_contributions TO authenticated;
GRANT INSERT ON public.family_goals,public.family_goal_contributions TO authenticated;
GRANT UPDATE(nome,descricao,valor_alvo,data_alvo,ativo,atualizado_em) ON public.family_goals TO authenticated;
CREATE POLICY af_family_expenses_read ON public.family_expense_splits FOR SELECT TO authenticated USING(public.af_familia_papel(group_id) IS NOT NULL);
CREATE POLICY af_family_parts_read ON public.family_split_participants FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.family_expense_splits s WHERE s.id=split_id AND public.af_familia_papel(s.group_id) IS NOT NULL));
CREATE POLICY af_family_goals_read ON public.family_goals FOR SELECT TO authenticated USING(public.af_familia_papel(group_id) IS NOT NULL);
CREATE POLICY af_family_goals_insert ON public.family_goals FOR INSERT TO authenticated WITH CHECK(public.af_familia_papel(group_id) IS NOT NULL AND valor_alvo>0);
CREATE POLICY af_family_goals_update ON public.family_goals FOR UPDATE TO authenticated USING(public.af_familia_papel(group_id) IS NOT NULL) WITH CHECK(public.af_familia_papel(group_id) IS NOT NULL AND valor_alvo>0);
CREATE POLICY af_family_contributions_read ON public.family_goal_contributions FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.family_goals g WHERE g.id=goal_id AND public.af_familia_papel(g.group_id) IS NOT NULL));
CREATE POLICY af_family_contributions_insert ON public.family_goal_contributions FOR INSERT TO authenticated WITH CHECK(contributor_id=auth.uid() AND valor>0 AND EXISTS(SELECT 1 FROM public.family_goals g WHERE g.id=goal_id AND g.ativo AND public.af_familia_papel(g.group_id) IS NOT NULL));

CREATE OR REPLACE FUNCTION public.af_familia_criar_divisao(p_group uuid,p_descricao text,p_valor_total integer,p_paid_by uuid,p_categoria text,p_participantes jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_n int; v_dist int; v_invalid int; v_soma bigint;
BEGIN
  IF public.af_familia_papel(p_group) IS NULL THEN RAISE EXCEPTION 'Grupo indisponível' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.family_groups WHERE id=p_group AND ativo FOR UPDATE;
  IF public.af_familia_papel(p_group) IS NULL THEN RAISE EXCEPTION 'Grupo indisponível' USING ERRCODE='42501'; END IF;
  IF coalesce(length(trim(p_descricao)),0) NOT BETWEEN 1 AND 160 OR p_valor_total IS NULL OR p_valor_total<=0 OR length(coalesce(p_categoria,''))>80 THEN RAISE EXCEPTION 'Descrição ou valor inválido'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.family_members WHERE group_id=p_group AND user_id=p_paid_by AND ativo) THEN RAISE EXCEPTION 'Pagador não pertence ao grupo'; END IF;
  IF p_participantes IS NULL OR jsonb_typeof(p_participantes)<>'array' THEN RAISE EXCEPTION 'Participantes inválidos'; END IF;
  IF jsonb_array_length(p_participantes) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Quantidade de participantes inválida'; END IF;
  SELECT count(*),count(DISTINCT p.user_id),coalesce(sum(p.valor_devido),0),count(*) FILTER(WHERE m.id IS NULL OR p.valor_devido IS NULL OR p.valor_devido<0)
  INTO v_n,v_dist,v_soma,v_invalid FROM jsonb_to_recordset(p_participantes) AS p(user_id uuid,valor_devido integer)
  LEFT JOIN public.family_members m ON m.group_id=p_group AND m.user_id=p.user_id AND m.ativo;
  IF v_n<>v_dist OR v_invalid<>0 OR v_soma<>p_valor_total THEN RAISE EXCEPTION 'As partes devem pertencer ao grupo e somar o valor total'; END IF;
  INSERT INTO public.family_expense_splits(group_id,descricao,valor_total,paid_by,categoria) VALUES(p_group,trim(p_descricao),p_valor_total,p_paid_by,p_categoria) RETURNING id INTO v_id;
  INSERT INTO public.family_split_participants(split_id,participant_id,valor_devido,pago,pago_em)
    SELECT v_id,p.user_id,p.valor_devido,p.user_id=p_paid_by,CASE WHEN p.user_id=p_paid_by THEN now() ELSE NULL END FROM jsonb_to_recordset(p_participantes) AS p(user_id uuid,valor_devido integer);
  RETURN jsonb_build_object('id',v_id);
END; $$;
CREATE OR REPLACE FUNCTION public.af_familia_marcar_pagamento(p_group uuid,p_id uuid,p_pago boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_papel text;
BEGIN
  IF public.af_familia_papel(p_group) IS NULL THEN RAISE EXCEPTION 'Grupo indisponível' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.family_groups WHERE id=p_group AND ativo FOR UPDATE;
  v_papel:=public.af_familia_papel(p_group);
  IF v_papel IS NULL OR p_pago IS NULL THEN RAISE EXCEPTION 'Ação indisponível' USING ERRCODE='42501'; END IF;
  UPDATE public.family_split_participants p SET pago=p_pago,pago_em=CASE WHEN p_pago THEN now() ELSE NULL END
    FROM public.family_expense_splits s WHERE p.id=p_id AND p.split_id=s.id AND s.group_id=p_group
    AND (p.participant_id=auth.uid() OR s.paid_by=auth.uid() OR v_papel='admin')
    AND (p.participant_id<>s.paid_by OR p_pago);
  IF NOT FOUND THEN RAISE EXCEPTION 'Somente o próprio participante, pagador ou administrador pode atualizar esta parte' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('ok',true);
END; $$;
REVOKE ALL ON FUNCTION public.af_familia_criar_divisao(uuid,text,integer,uuid,text,jsonb),public.af_familia_marcar_pagamento(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.af_familia_criar_divisao(uuid,text,integer,uuid,text,jsonb),public.af_familia_marcar_pagamento(uuid,uuid,boolean) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
