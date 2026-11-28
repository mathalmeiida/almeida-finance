-- Almeida Finance | Piloto de usuários e acessos empresariais (não inclui módulo financeiro).
-- Requer a migration 202611280001_af_acessos_familia.sql.
-- Ninguém pode criar empresa por padrão: a habilitação é exclusiva do operador do banco.
BEGIN;
CREATE TABLE IF NOT EXISTS public.af_empresa_habilitacoes (
  usuario_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.af_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK(length(trim(nome)) BETWEEN 1 AND 80),
  titular_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS af_empresas_titular_ativo ON public.af_empresas(titular_id) WHERE ativo;
CREATE TABLE IF NOT EXISTS public.af_empresa_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.af_empresas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  papel text NOT NULL CHECK(papel IN ('titular','admin','gestor','colaborador')),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id,usuario_id)
);
CREATE INDEX IF NOT EXISTS af_empresa_membros_usuario ON public.af_empresa_membros(usuario_id) WHERE ativo;
CREATE TABLE IF NOT EXISTS public.af_empresa_convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.af_empresas(id) ON DELETE CASCADE,
  email text NOT NULL CHECK(length(email)<=254),
  papel text NOT NULL CHECK(papel IN ('admin','gestor','colaborador')),
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','aceito','recusado','cancelado')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  respondido_em timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS af_empresa_convite_pendente ON public.af_empresa_convites(empresa_id,email) WHERE status='pendente';
CREATE INDEX IF NOT EXISTS af_empresa_convites_email ON public.af_empresa_convites(email) WHERE status='pendente';
ALTER TABLE public.af_empresa_habilitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.af_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.af_empresa_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.af_empresa_convites ENABLE ROW LEVEL SECURITY;
-- Sem acesso direto às tabelas por usuários. Todas as operações passam por RPC auditável.
REVOKE ALL ON public.af_empresa_habilitacoes,public.af_empresas,public.af_empresa_membros,public.af_empresa_convites FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.af_empresa_papel_interno(p_empresa uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT m.papel FROM public.af_empresa_membros m JOIN public.af_empresas e ON e.id=m.empresa_id
  WHERE m.empresa_id=p_empresa AND m.usuario_id=auth.uid() AND m.ativo AND e.ativo AND public.af_acessos_usuario_ativo();
$$;
CREATE OR REPLACE FUNCTION public.af_empresa_acao(
  p_acao text, p_empresa uuid DEFAULT NULL, p_id uuid DEFAULT NULL,
  p_email text DEFAULT NULL, p_papel text DEFAULT NULL, p_nome text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid:=auth.uid(); v_email text; v_papel text; v_id uuid; v_total int;
  v_empresa public.af_empresas%ROWTYPE; v_membro public.af_empresa_membros%ROWTYPE;
  v_convite public.af_empresa_convites%ROWTYPE; v_empresas jsonb; v_convites jsonb; v_membros jsonb;
  v_habilitado boolean;
BEGIN
  IF v_uid IS NULL OR NOT public.af_acessos_usuario_ativo() THEN RAISE EXCEPTION 'Sessão inválida ou conta desativada' USING ERRCODE='42501'; END IF;
  SELECT lower(trim(u.email)) INTO v_email FROM auth.users u WHERE u.id=v_uid AND u.email_confirmed_at IS NOT NULL;
  v_habilitado:=EXISTS(SELECT 1 FROM public.af_empresa_habilitacoes WHERE usuario_id=v_uid AND ativo);
  IF p_acao='listar' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'nome',e.nome,'papel',m.papel) ORDER BY e.criado_em),'[]'::jsonb) INTO v_empresas
      FROM public.af_empresas e JOIN public.af_empresa_membros m ON m.empresa_id=e.id
      WHERE m.usuario_id=v_uid AND m.ativo AND e.ativo;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'empresa_id',e.id,'nome',e.nome,'papel',i.papel) ORDER BY i.criado_em DESC),'[]'::jsonb) INTO v_convites
      FROM public.af_empresa_convites i JOIN public.af_empresas e ON e.id=i.empresa_id
      WHERE i.email=v_email AND i.status='pendente' AND e.ativo;
    RETURN jsonb_build_object('empresas',v_empresas,'convites',v_convites,'pode_criar',v_habilitado AND NOT EXISTS(SELECT 1 FROM public.af_empresas WHERE titular_id=v_uid AND ativo));
  ELSIF p_acao='criar' THEN
    IF NOT v_habilitado THEN RAISE EXCEPTION 'Cadastro empresarial ainda não habilitado para esta conta' USING ERRCODE='42501'; END IF;
    PERFORM 1 FROM public.af_empresa_habilitacoes WHERE usuario_id=v_uid AND ativo FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Habilitação indisponível'; END IF;
    IF coalesce(length(trim(p_nome)),0) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Informe o nome da empresa (até 80 caracteres)'; END IF;
    IF EXISTS(SELECT 1 FROM public.af_empresas WHERE titular_id=v_uid AND ativo) THEN RAISE EXCEPTION 'O piloto permite uma empresa por titular'; END IF;
    INSERT INTO public.af_empresas(nome,titular_id) VALUES(trim(p_nome),v_uid) RETURNING id INTO v_id;
    INSERT INTO public.af_empresa_membros(empresa_id,usuario_id,papel) VALUES(v_id,v_uid,'titular');
    RETURN jsonb_build_object('id',v_id);
  ELSIF p_acao='responder' THEN
    SELECT empresa_id INTO v_id FROM public.af_empresa_convites WHERE id=p_id AND email=v_email AND status='pendente';
    IF v_id IS NULL THEN RAISE EXCEPTION 'Convite indisponível' USING ERRCODE='42501'; END IF;
    SELECT * INTO v_empresa FROM public.af_empresas WHERE id=v_id FOR UPDATE;
    SELECT * INTO v_convite FROM public.af_empresa_convites WHERE id=p_id AND empresa_id=v_id AND email=v_email AND status='pendente' FOR UPDATE;
    IF NOT FOUND OR v_empresa.ativo IS NOT TRUE OR p_papel IS NULL OR p_papel NOT IN ('aceito','recusado') THEN RAISE EXCEPTION 'Convite indisponível'; END IF;
    IF p_papel='aceito' THEN
      IF NOT EXISTS(SELECT 1 FROM public.af_empresa_membros WHERE empresa_id=v_id AND usuario_id=v_uid AND ativo) THEN
        IF NOT EXISTS(SELECT 1 FROM public.af_empresa_habilitacoes WHERE usuario_id=v_empresa.titular_id AND ativo) THEN RAISE EXCEPTION 'Piloto da empresa não está habilitado'; END IF;
        -- O convite não sobrevive à perda da permissão de quem o emitiu.
        IF NOT EXISTS(SELECT 1 FROM public.af_empresa_membros m JOIN public.perfis p ON p.id=m.usuario_id WHERE m.empresa_id=v_id AND m.usuario_id=v_convite.criado_por AND m.ativo AND p.ativo AND
          (m.papel='titular' OR (m.papel='admin' AND v_convite.papel<>'admin'))) THEN RAISE EXCEPTION 'O emissor não possui mais permissão'; END IF;
        SELECT count(*) INTO v_total FROM public.af_empresa_membros WHERE empresa_id=v_id AND ativo;
        IF v_total>=5 THEN RAISE EXCEPTION 'A empresa atingiu o limite de 5 usuários'; END IF;
        INSERT INTO public.af_empresa_membros(empresa_id,usuario_id,papel,ativo) VALUES(v_id,v_uid,v_convite.papel,true)
          ON CONFLICT(empresa_id,usuario_id) DO UPDATE SET papel=EXCLUDED.papel,ativo=true,criado_em=now();
      END IF;
    END IF;
    UPDATE public.af_empresa_convites SET status=p_papel,respondido_em=now() WHERE id=p_id;
    RETURN jsonb_build_object('ok',true,'empresa_id',v_id);
  END IF;
  IF public.af_empresa_papel_interno(p_empresa) IS NULL THEN RAISE EXCEPTION 'Empresa indisponível' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_empresa FROM public.af_empresas WHERE id=p_empresa FOR UPDATE;
  v_papel:=public.af_empresa_papel_interno(p_empresa);
  IF v_papel IS NULL THEN RAISE EXCEPTION 'Empresa indisponível' USING ERRCODE='42501'; END IF;
  IF p_acao='detalhes' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'usuario_id',m.usuario_id,'papel',m.papel,'nome',coalesce(nullif(p.nome,''),'Membro'),
      'email',CASE WHEN v_papel IN ('titular','admin') OR m.usuario_id=v_uid THEN u.email ELSE NULL END) ORDER BY m.criado_em,m.id),'[]'::jsonb) INTO v_membros
      FROM public.af_empresa_membros m LEFT JOIN public.perfis p ON p.id=m.usuario_id LEFT JOIN auth.users u ON u.id=m.usuario_id WHERE m.empresa_id=p_empresa AND m.ativo;
    v_convites:='[]'::jsonb;
    IF v_papel IN ('titular','admin') THEN
      SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'papel',i.papel) ORDER BY i.criado_em DESC),'[]'::jsonb) INTO v_convites
        FROM public.af_empresa_convites i WHERE i.empresa_id=p_empresa AND i.status='pendente';
    END IF;
    RETURN jsonb_build_object('nome',v_empresa.nome,'papel',v_papel,'membros',v_membros,'convites',v_convites,'limite',5);
  ELSIF p_acao='sair' THEN
    IF v_papel='titular' THEN RAISE EXCEPTION 'O titular não pode sair da própria empresa'; END IF;
    UPDATE public.af_empresa_membros SET ativo=false WHERE empresa_id=p_empresa AND usuario_id=v_uid;
    UPDATE public.af_empresa_convites SET status='cancelado',respondido_em=now() WHERE empresa_id=p_empresa AND criado_por=v_uid AND status='pendente';
    RETURN jsonb_build_object('ok',true);
  END IF;
  IF v_papel NOT IN ('titular','admin') THEN RAISE EXCEPTION 'Ação reservada ao administrador' USING ERRCODE='42501'; END IF;
  CASE p_acao
    WHEN 'convidar' THEN
      IF NOT EXISTS(SELECT 1 FROM public.af_empresa_habilitacoes WHERE usuario_id=v_empresa.titular_id AND ativo) THEN RAISE EXCEPTION 'Piloto da empresa não está habilitado'; END IF;
      p_email:=lower(trim(p_email));
      IF p_email IS NULL OR length(p_email)>254 OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR p_email=v_email THEN RAISE EXCEPTION 'Informe um e-mail válido de outra pessoa'; END IF;
      IF p_papel IS NULL OR p_papel NOT IN ('admin','gestor','colaborador') OR (p_papel='admin' AND v_papel<>'titular') THEN RAISE EXCEPTION 'Papel não autorizado' USING ERRCODE='42501'; END IF;
      SELECT count(*) INTO v_total FROM public.af_empresa_membros WHERE empresa_id=p_empresa AND ativo;
      IF v_total>=5 THEN RAISE EXCEPTION 'Limite de 5 usuários atingido'; END IF;
      IF EXISTS(SELECT 1 FROM public.af_empresa_membros m JOIN auth.users u ON u.id=m.usuario_id WHERE m.empresa_id=p_empresa AND m.ativo AND lower(trim(u.email))=p_email) THEN RAISE EXCEPTION 'Essa pessoa já possui acesso'; END IF;
      IF EXISTS(SELECT 1 FROM public.af_empresa_convites WHERE empresa_id=p_empresa AND email=p_email AND status='pendente') THEN RAISE EXCEPTION 'Já existe um convite pendente'; END IF;
      INSERT INTO public.af_empresa_convites(empresa_id,email,papel,criado_por) VALUES(p_empresa,p_email,p_papel,v_uid);
    WHEN 'cancelar' THEN
      UPDATE public.af_empresa_convites SET status='cancelado',respondido_em=now() WHERE id=p_id AND empresa_id=p_empresa AND status='pendente' AND (v_papel='titular' OR papel<>'admin');
      IF NOT FOUND THEN RAISE EXCEPTION 'Convite indisponível ou não autorizado'; END IF;
    WHEN 'papel','remover' THEN
      SELECT * INTO v_membro FROM public.af_empresa_membros WHERE id=p_id AND empresa_id=p_empresa AND ativo FOR UPDATE;
      IF NOT FOUND OR v_membro.usuario_id=v_uid OR v_membro.papel='titular' OR (v_membro.papel='admin' AND v_papel<>'titular') THEN RAISE EXCEPTION 'Não é possível alterar esse acesso' USING ERRCODE='42501'; END IF;
      IF p_acao='papel' THEN
        IF p_papel IS NULL OR p_papel NOT IN ('admin','gestor','colaborador') OR (p_papel='admin' AND v_papel<>'titular') THEN RAISE EXCEPTION 'Papel não autorizado'; END IF;
        UPDATE public.af_empresa_membros SET papel=p_papel WHERE id=p_id;
      ELSE
        UPDATE public.af_empresa_membros SET ativo=false WHERE id=p_id;
      END IF;
      IF p_acao='remover' OR p_papel NOT IN ('admin','titular') THEN
        UPDATE public.af_empresa_convites SET status='cancelado',respondido_em=now() WHERE empresa_id=p_empresa AND criado_por=v_membro.usuario_id AND status='pendente';
      END IF;
    WHEN 'editar' THEN
      IF coalesce(length(trim(p_nome)),0) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Nome inválido'; END IF;
      UPDATE public.af_empresas SET nome=trim(p_nome) WHERE id=p_empresa;
    WHEN 'desativar' THEN
      IF v_papel<>'titular' THEN RAISE EXCEPTION 'Somente o titular pode desativar'; END IF;
      UPDATE public.af_empresas SET ativo=false WHERE id=p_empresa;
    ELSE RAISE EXCEPTION 'Ação desconhecida';
  END CASE;
  RETURN jsonb_build_object('ok',true);
END; $$;
REVOKE ALL ON FUNCTION public.af_empresa_papel_interno(uuid),public.af_empresa_acao(text,uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.af_empresa_acao(text,uuid,uuid,text,text,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
