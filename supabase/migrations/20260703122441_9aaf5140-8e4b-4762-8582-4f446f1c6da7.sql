
CREATE TABLE IF NOT EXISTS public.permissoes_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela text NOT NULL,          -- 'usuario_permissoes_modulos' | 'usuario_permissoes_telas'
  acao text NOT NULL,            -- 'grant' | 'revoke'
  usuario_alvo uuid NOT NULL,    -- profile afetado
  recurso_id uuid NOT NULL,      -- modulo_id ou tela_id
  recurso_codigo text,           -- código legível
  recurso_nome text,             -- nome legível
  alterado_por uuid,             -- auth.uid() quem alterou
  alterado_por_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.permissoes_auditoria TO authenticated;
GRANT ALL ON public.permissoes_auditoria TO service_role;

ALTER TABLE public.permissoes_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view permission audit"
  ON public.permissoes_auditoria FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_permissoes_auditoria_usuario ON public.permissoes_auditoria(usuario_alvo);
CREATE INDEX IF NOT EXISTS idx_permissoes_auditoria_created_at ON public.permissoes_auditoria(created_at DESC);

-- Trigger genérica para módulos
CREATE OR REPLACE FUNCTION public.audit_usuario_permissoes_modulos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codigo text; v_nome text; v_email text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT codigo, nome INTO v_codigo, v_nome FROM public.modulos_sistema WHERE id = NEW.modulo_id;
    SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.permissoes_auditoria
      (tabela, acao, usuario_alvo, recurso_id, recurso_codigo, recurso_nome, alterado_por, alterado_por_email)
    VALUES ('usuario_permissoes_modulos','grant', NEW.usuario_id, NEW.modulo_id, v_codigo, v_nome, auth.uid(), v_email);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT codigo, nome INTO v_codigo, v_nome FROM public.modulos_sistema WHERE id = OLD.modulo_id;
    SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.permissoes_auditoria
      (tabela, acao, usuario_alvo, recurso_id, recurso_codigo, recurso_nome, alterado_por, alterado_por_email)
    VALUES ('usuario_permissoes_modulos','revoke', OLD.usuario_id, OLD.modulo_id, v_codigo, v_nome, auth.uid(), v_email);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_permissoes_modulos ON public.usuario_permissoes_modulos;
CREATE TRIGGER trg_audit_permissoes_modulos
AFTER INSERT OR DELETE ON public.usuario_permissoes_modulos
FOR EACH ROW EXECUTE FUNCTION public.audit_usuario_permissoes_modulos();

-- Trigger genérica para telas
CREATE OR REPLACE FUNCTION public.audit_usuario_permissoes_telas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codigo text; v_nome text; v_email text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT codigo, nome INTO v_codigo, v_nome FROM public.telas_sistema WHERE id = NEW.tela_id;
    SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.permissoes_auditoria
      (tabela, acao, usuario_alvo, recurso_id, recurso_codigo, recurso_nome, alterado_por, alterado_por_email)
    VALUES ('usuario_permissoes_telas','grant', NEW.usuario_id, NEW.tela_id, v_codigo, v_nome, auth.uid(), v_email);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT codigo, nome INTO v_codigo, v_nome FROM public.telas_sistema WHERE id = OLD.tela_id;
    SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.permissoes_auditoria
      (tabela, acao, usuario_alvo, recurso_id, recurso_codigo, recurso_nome, alterado_por, alterado_por_email)
    VALUES ('usuario_permissoes_telas','revoke', OLD.usuario_id, OLD.tela_id, v_codigo, v_nome, auth.uid(), v_email);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_permissoes_telas ON public.usuario_permissoes_telas;
CREATE TRIGGER trg_audit_permissoes_telas
AFTER INSERT OR DELETE ON public.usuario_permissoes_telas
FOR EACH ROW EXECUTE FUNCTION public.audit_usuario_permissoes_telas();
