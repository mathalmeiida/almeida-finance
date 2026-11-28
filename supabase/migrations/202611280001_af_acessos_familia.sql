-- Almeida Finance | Família: validar primeiro no DEV. Requer o schema familiar existente.
-- Substitui exclusivamente as policies de family_groups, family_members e family_invitations.
-- Não altera policies nem dados financeiros pessoais. Não habilita cobrança.
BEGIN;

ALTER TABLE public.family_groups ADD COLUMN IF NOT EXISTS af_titular_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
-- O schema antigo não guardava titular. Preserva grupos e usa o primeiro admin ativo.
UPDATE public.family_groups g SET af_titular_id = (
  SELECT m.user_id FROM public.family_members m
  WHERE m.group_id=g.id AND m.ativo AND m.papel='admin'
  ORDER BY m.juntou_em,m.id LIMIT 1
) WHERE g.af_titular_id IS NULL;

CREATE OR REPLACE FUNCTION public.af_acessos_usuario_ativo()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM public.perfis p WHERE p.id=auth.uid() AND p.ativo IS TRUE);
$$;
CREATE OR REPLACE FUNCTION public.af_acessos_admin_real()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM public.perfis p WHERE p.id=auth.uid() AND p.ativo IS TRUE AND p.papel='admin');
$$;
-- Defesa adicional contra alteração direta de plano/papel pelo próprio usuário.
-- Não intercepta atualizações realizadas pelo proprietário do banco ou por RPCs privilegiadas.
CREATE OR REPLACE FUNCTION public.af_acessos_proteger_perfil()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF current_user IN ('authenticated','anon') AND NOT public.af_acessos_admin_real() THEN
    IF TG_OP='INSERT' THEN
      IF coalesce(NEW.papel,'user')<>'user' OR coalesce(NEW.subscription_plan,'free') NOT IN ('free','trial')
         OR coalesce(NEW.plano_override,false) OR NEW.ativo IS FALSE THEN
        RAISE EXCEPTION 'Campos de assinatura e acesso são administrados pelo servidor' USING ERRCODE='42501';
      END IF;
    ELSIF NEW.papel IS DISTINCT FROM OLD.papel OR NEW.subscription_plan IS DISTINCT FROM OLD.subscription_plan
       OR NEW.plano_override IS DISTINCT FROM OLD.plano_override OR NEW.ativo IS DISTINCT FROM OLD.ativo THEN
      RAISE EXCEPTION 'Campos de assinatura e acesso são administrados pelo servidor' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS zz_af_acessos_proteger_perfil ON public.perfis;
CREATE TRIGGER zz_af_acessos_proteger_perfil BEFORE INSERT OR UPDATE ON public.perfis
  FOR EACH ROW EXECUTE FUNCTION public.af_acessos_proteger_perfil();

CREATE OR REPLACE FUNCTION public.af_familia_papel(p_group uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT m.papel FROM public.family_members m JOIN public.family_groups g ON g.id=m.group_id
  WHERE m.group_id=p_group AND m.user_id=auth.uid() AND m.ativo AND g.ativo AND public.af_acessos_usuario_ativo();
$$;
CREATE OR REPLACE FUNCTION public.af_familia_limite_interno(p_titular uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT CASE WHEN p.ativo IS NOT TRUE THEN 0
    WHEN p.papel='admin' OR p.plano_override OR p.subscription_plan='plus' THEN 5
    WHEN p.subscription_plan='premium' THEN 2 ELSE 0 END
    FROM public.perfis p WHERE p.id=p_titular),0);
$$;

-- Remove policies antigas que permitiam inserção pelo próprio usuário e recursão na mesma tabela.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT schemaname,tablename,policyname FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename IN ('family_groups','family_members','family_invitations')
  LOOP EXECUTE format('DROP POLICY %I ON %I.%I',r.policyname,r.schemaname,r.tablename); END LOOP;
END $$;
ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_groups,public.family_members,public.family_invitations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.family_groups,public.family_members TO authenticated;
CREATE POLICY af_familia_grupo_select ON public.family_groups FOR SELECT TO authenticated
 USING (public.af_familia_papel(id) IS NOT NULL);
CREATE POLICY af_familia_membro_select ON public.family_members FOR SELECT TO authenticated
 USING (ativo AND public.af_familia_papel(group_id) IS NOT NULL);
-- Convites são consultados somente pela RPC para não ampliar leitura de perfis/e-mails.

CREATE OR REPLACE FUNCTION public.af_familia_acao(
  p_acao text, p_group uuid DEFAULT NULL, p_id uuid DEFAULT NULL,
  p_email text DEFAULT NULL, p_papel text DEFAULT NULL, p_nome text DEFAULT NULL,
  p_descricao text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid(); v_email text; v_papel text; v_grupo public.family_groups%ROWTYPE;
  v_membro public.family_members%ROWTYPE; v_convite public.family_invitations%ROWTYPE;
  v_id uuid; v_limite int; v_total int; v_json jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.af_acessos_usuario_ativo() THEN
    RAISE EXCEPTION 'Sessão inválida ou conta desativada' USING ERRCODE='42501'; END IF;
  SELECT lower(trim(u.email)) INTO v_email FROM auth.users u WHERE u.id=v_uid AND u.email_confirmed_at IS NOT NULL;
  IF p_acao='capacidade_propria' THEN
    RETURN jsonb_build_object('limite',public.af_familia_limite_interno(v_uid), 'grupos_titular',
      (SELECT count(*) FROM public.family_groups WHERE af_titular_id=v_uid AND ativo));
  ELSIF p_acao='criar' THEN
    -- Serializa criações do mesmo titular. Não altera grupos anteriores.
    PERFORM 1 FROM public.perfis WHERE id=v_uid FOR UPDATE;
    IF public.af_familia_limite_interno(v_uid)<2 THEN RAISE EXCEPTION 'Seu plano não permite criar grupo familiar'; END IF;
    IF EXISTS(SELECT 1 FROM public.family_groups WHERE af_titular_id=v_uid AND ativo) THEN RAISE EXCEPTION 'Seu plano permite um grupo familiar próprio'; END IF;
    IF coalesce(length(trim(p_nome)),0) NOT BETWEEN 1 AND 50 OR length(coalesce(p_descricao,''))>200 THEN RAISE EXCEPTION 'Nome ou descrição inválidos'; END IF;
    INSERT INTO public.family_groups(nome,descricao,af_titular_id) VALUES(trim(p_nome),nullif(trim(p_descricao),''),v_uid) RETURNING id INTO v_id;
    INSERT INTO public.family_members(group_id,user_id,papel,ativo) VALUES(v_id,v_uid,'admin',true);
    RETURN jsonb_build_object('id',v_id);
  ELSIF p_acao='listar_convites' AND p_group IS NULL THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'group_id',i.group_id,'email_convidado',i.email_convidado,'status',i.status,'criado_em',i.criado_em,
      'family_groups',jsonb_build_object('id',g.id,'nome',g.nome),'convidado_por',jsonb_build_object('nome_completo',coalesce(nullif(p.nome,''),'Administrador')))
      ORDER BY i.criado_em DESC),'[]'::jsonb) INTO v_json
      FROM public.family_invitations i JOIN public.family_groups g ON g.id=i.group_id LEFT JOIN public.perfis p ON p.id=i.invited_by
      WHERE i.status='pendente' AND g.ativo AND lower(trim(i.email_convidado))=v_email;
    RETURN v_json;
  ELSIF p_acao='responder' THEN
    -- Busca o grupo a partir do convite, nunca de um group_id fornecido pelo cliente.
    SELECT group_id INTO v_id FROM public.family_invitations WHERE id=p_id AND status='pendente' AND lower(trim(email_convidado))=v_email;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Convite inválido ou indisponível' USING ERRCODE='42501'; END IF;
    SELECT * INTO v_grupo FROM public.family_groups WHERE id=v_id FOR UPDATE;
    SELECT * INTO v_convite FROM public.family_invitations WHERE id=p_id AND group_id=v_id AND status='pendente' AND lower(trim(email_convidado))=v_email FOR UPDATE;
    IF NOT FOUND OR v_grupo.ativo IS NOT TRUE OR p_papel IS NULL OR p_papel NOT IN ('aceito','recusado') THEN RAISE EXCEPTION 'Convite indisponível'; END IF;
    IF p_papel='aceito' THEN
      IF NOT EXISTS(SELECT 1 FROM public.family_members m JOIN public.perfis p ON p.id=m.user_id WHERE m.group_id=v_id AND m.user_id=v_convite.invited_by AND m.ativo AND m.papel='admin' AND p.ativo) THEN RAISE EXCEPTION 'O emissor não possui mais permissão'; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.family_members WHERE group_id=v_id AND user_id=v_uid AND ativo) THEN
        v_limite:=public.af_familia_limite_interno(v_grupo.af_titular_id);
        SELECT count(*) INTO v_total FROM public.family_members WHERE group_id=v_id AND ativo;
        IF v_limite=0 OR v_total>=v_limite THEN RAISE EXCEPTION 'O grupo atingiu o limite do plano do titular'; END IF;
        INSERT INTO public.family_members(group_id,user_id,papel,ativo) VALUES(v_id,v_uid,'membro',true)
          ON CONFLICT(group_id,user_id) DO UPDATE SET ativo=true,papel='membro',juntou_em=now();
      END IF;
    END IF;
    UPDATE public.family_invitations SET status=p_papel,respondido_em=now() WHERE id=p_id;
    RETURN jsonb_build_object('ok',true,'group_id',v_id);
  END IF;

  -- Para todas as demais ações, exige vínculo ativo e bloqueia o grupo durante a decisão.
  IF public.af_familia_papel(p_group) IS NULL THEN RAISE EXCEPTION 'Grupo indisponível' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_grupo FROM public.family_groups WHERE id=p_group FOR UPDATE;
  v_papel:=public.af_familia_papel(p_group);
  IF v_papel IS NULL THEN RAISE EXCEPTION 'Grupo indisponível' USING ERRCODE='42501'; END IF;
  v_limite:=public.af_familia_limite_interno(v_grupo.af_titular_id);
  IF p_acao='listar_membros' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'user_id',m.user_id,'papel',m.papel,'ativo',m.ativo,'juntou_em',m.juntou_em,
      'titular',m.user_id=v_grupo.af_titular_id,'user',jsonb_build_object('id',m.user_id,'nome_completo',coalesce(nullif(p.nome,''),'Membro'),
      'email',CASE WHEN m.user_id=v_uid OR v_papel='admin' THEN u.email ELSE NULL END)) ORDER BY m.juntou_em,m.id),'[]'::jsonb) INTO v_json
      FROM public.family_members m LEFT JOIN public.perfis p ON p.id=m.user_id LEFT JOIN auth.users u ON u.id=m.user_id
      WHERE m.group_id=p_group AND m.ativo;
    RETURN jsonb_build_object('membros',v_json,'limite',v_limite,'titular_id',v_grupo.af_titular_id,'papel',v_papel);
  ELSIF p_acao='sair' THEN
    IF v_grupo.af_titular_id=v_uid THEN RAISE EXCEPTION 'O titular não pode sair do próprio grupo'; END IF;
    IF v_papel='admin' AND NOT EXISTS(SELECT 1 FROM public.family_members WHERE group_id=p_group AND ativo AND papel='admin' AND user_id<>v_uid) THEN RAISE EXCEPTION 'O grupo precisa de um administrador'; END IF;
    UPDATE public.family_members SET ativo=false WHERE group_id=p_group AND user_id=v_uid;
    UPDATE public.family_invitations SET status='recusado',respondido_em=now() WHERE group_id=p_group AND invited_by=v_uid AND status='pendente';
    RETURN jsonb_build_object('ok',true);
  END IF;
  IF v_papel<>'admin' THEN RAISE EXCEPTION 'Ação reservada ao administrador' USING ERRCODE='42501'; END IF;
  CASE p_acao
    WHEN 'listar_convites' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.criado_em DESC),'[]'::jsonb) INTO v_json FROM public.family_invitations i WHERE i.group_id=p_group AND i.status='pendente';
      RETURN v_json;
    WHEN 'convidar' THEN
      p_email:=lower(trim(p_email));
      IF p_email IS NULL OR length(p_email)>254 OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR p_email=v_email THEN RAISE EXCEPTION 'Informe um e-mail válido de outra pessoa'; END IF;
      SELECT count(*) INTO v_total FROM public.family_members WHERE group_id=p_group AND ativo;
      IF v_limite=0 OR v_total>=v_limite THEN RAISE EXCEPTION 'Limite de membros do plano atingido'; END IF;
      IF EXISTS(SELECT 1 FROM public.family_members m JOIN auth.users u ON u.id=m.user_id WHERE m.group_id=p_group AND m.ativo AND lower(trim(u.email))=p_email) THEN RAISE EXCEPTION 'Essa pessoa já pertence ao grupo'; END IF;
      IF EXISTS(SELECT 1 FROM public.family_invitations WHERE group_id=p_group AND status='pendente' AND lower(trim(email_convidado))=p_email) THEN RAISE EXCEPTION 'Já existe um convite pendente'; END IF;
      INSERT INTO public.family_invitations(group_id,email_convidado,invited_by) VALUES(p_group,p_email,v_uid) RETURNING id INTO v_id;
      RETURN jsonb_build_object('id',v_id);
    WHEN 'cancelar' THEN
      UPDATE public.family_invitations SET status='recusado',respondido_em=now() WHERE id=p_id AND group_id=p_group AND status='pendente';
      IF NOT FOUND THEN RAISE EXCEPTION 'Convite indisponível'; END IF;
    WHEN 'papel','remover' THEN
      SELECT * INTO v_membro FROM public.family_members WHERE id=p_id AND group_id=p_group AND ativo FOR UPDATE;
      IF NOT FOUND OR v_membro.user_id=v_uid OR v_membro.user_id=v_grupo.af_titular_id THEN RAISE EXCEPTION 'Não é possível alterar esse membro'; END IF;
      IF p_acao='papel' THEN
        IF v_uid IS DISTINCT FROM v_grupo.af_titular_id OR p_papel IS NULL OR p_papel NOT IN ('admin','membro') THEN RAISE EXCEPTION 'Somente o titular pode alterar papéis' USING ERRCODE='42501'; END IF;
        UPDATE public.family_members SET papel=p_papel WHERE id=p_id;
        IF p_papel='membro' THEN UPDATE public.family_invitations SET status='recusado',respondido_em=now() WHERE group_id=p_group AND invited_by=v_membro.user_id AND status='pendente'; END IF;
      ELSE
        IF v_membro.papel='admin' AND v_uid IS DISTINCT FROM v_grupo.af_titular_id THEN RAISE EXCEPTION 'Somente o titular pode remover administradores'; END IF;
        UPDATE public.family_members SET ativo=false WHERE id=p_id;
        UPDATE public.family_invitations SET status='recusado',respondido_em=now() WHERE group_id=p_group AND invited_by=v_membro.user_id AND status='pendente';
      END IF;
    WHEN 'editar' THEN
      IF coalesce(length(trim(p_nome)),0) NOT BETWEEN 1 AND 50 OR length(coalesce(p_descricao,''))>200 THEN RAISE EXCEPTION 'Nome ou descrição inválidos'; END IF;
      UPDATE public.family_groups SET nome=trim(p_nome),descricao=nullif(trim(p_descricao),''),atualizado_em=now() WHERE id=p_group;
    WHEN 'desativar' THEN
      IF v_uid IS DISTINCT FROM v_grupo.af_titular_id THEN RAISE EXCEPTION 'Somente o titular pode desativar'; END IF;
      UPDATE public.family_groups SET ativo=false WHERE id=p_group;
    ELSE RAISE EXCEPTION 'Ação desconhecida';
  END CASE;
  RETURN jsonb_build_object('ok',true);
END; $$;

-- Funções privilegiadas não podem ser executadas por anon/PUBLIC.
REVOKE ALL ON FUNCTION public.af_acessos_usuario_ativo(),public.af_acessos_admin_real(),public.af_acessos_proteger_perfil(),public.af_familia_papel(uuid),public.af_familia_limite_interno(uuid),public.af_familia_acao(text,uuid,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.af_acessos_admin_real(),public.af_familia_papel(uuid),public.af_familia_acao(text,uuid,uuid,text,text,text,text) TO authenticated;
-- Necessário para o trigger invoker quando uma inserção direta por anon for tentada.
GRANT EXECUTE ON FUNCTION public.af_acessos_admin_real() TO anon;
-- Valores vigentes no catálogo; não cria assinaturas nem altera plano dos usuários.
UPDATE public.subscription_plans SET preco_mensal=2990,atualizado_em=now() WHERE id='premium';
UPDATE public.subscription_plans SET preco_mensal=4990,atualizado_em=now() WHERE id='plus';
NOTIFY pgrst, 'reload schema';
COMMIT;
