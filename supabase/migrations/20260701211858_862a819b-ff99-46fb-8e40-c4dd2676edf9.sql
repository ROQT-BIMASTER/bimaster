-- Cria tabela de solicitações de acesso originadas do AccessDeniedNotice.
CREATE TABLE public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL DEFAULT auth.uid(),
  requester_email text,
  resource_kind text NOT NULL,
  resource_id text,
  resource_label text,
  route text,
  justification text NOT NULL,
  status text NOT NULL DEFAULT 'aberto',
  handled_by uuid,
  handled_at timestamptz,
  handled_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_requests_status_chk CHECK (status IN ('aberto','em_analise','aprovado','negado')),
  CONSTRAINT access_requests_justification_chk CHECK (char_length(justification) BETWEEN 10 AND 2000),
  CONSTRAINT access_requests_kind_chk CHECK (char_length(resource_kind) BETWEEN 1 AND 80)
);

CREATE INDEX access_requests_requester_idx ON public.access_requests(requester_id, created_at DESC);
CREATE INDEX access_requests_status_idx ON public.access_requests(status, created_at DESC);

GRANT SELECT, INSERT ON public.access_requests TO authenticated;
GRANT ALL ON public.access_requests TO service_role;

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Requester enxerga apenas as próprias solicitações.
CREATE POLICY "requester reads own access requests"
ON public.access_requests
FOR SELECT
TO authenticated
USING (requester_id = auth.uid());

-- Admin lê e atualiza todas.
CREATE POLICY "admin reads all access requests"
ON public.access_requests
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin updates access requests"
ON public.access_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Insert bloqueado direto: usar a RPC abaixo (padroniza validação + notificação).
-- Mantemos GRANT INSERT porque a RPC roda no papel do usuário; policy restringe.
CREATE POLICY "requester inserts own access request"
ON public.access_requests
FOR INSERT
TO authenticated
WITH CHECK (requester_id = auth.uid());

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.access_requests_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.handled_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_access_requests_updated_at
BEFORE UPDATE ON public.access_requests
FOR EACH ROW EXECUTE FUNCTION public.access_requests_touch_updated_at();

-- Trigger de notificação: notifica todos os admins ativos.
CREATE OR REPLACE FUNCTION public.notify_admin_access_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid;
  v_titulo text;
BEGIN
  v_titulo := 'Nova solicitação de acesso';
  FOR v_admin IN
    SELECT ur.user_id
      FROM public.user_roles ur
     WHERE ur.role = 'admin'::app_role
  LOOP
    INSERT INTO public.notificacoes (user_id, titulo, mensagem, tipo, referencia_id, referencia_tipo)
    VALUES (
      v_admin,
      v_titulo,
      COALESCE(NEW.resource_label, NEW.resource_kind) || ' — ' || left(NEW.justification, 140),
      'solicitacao_acesso',
      NEW.id::text,
      'access_requests'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_admin_access_request
AFTER INSERT ON public.access_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_access_request();

-- RPC principal usada pelo front. SECURITY DEFINER apenas para conseguir
-- pegar o email do próprio usuário mesmo quando `profiles` não é legível pela role.
CREATE OR REPLACE FUNCTION public.rpc_criar_solicitacao_acesso(
  p_resource_kind text,
  p_resource_id text,
  p_resource_label text,
  p_route text,
  p_justification text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_justification IS NULL OR char_length(trim(p_justification)) < 10 THEN
    RAISE EXCEPTION 'justification too short' USING ERRCODE = '22023';
  END IF;
  IF p_resource_kind IS NULL OR char_length(trim(p_resource_kind)) < 1 THEN
    RAISE EXCEPTION 'resource_kind required' USING ERRCODE = '22023';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  INSERT INTO public.access_requests (
    requester_id, requester_email, resource_kind, resource_id,
    resource_label, route, justification
  ) VALUES (
    v_uid, v_email, p_resource_kind, p_resource_id,
    p_resource_label, p_route, p_justification
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_criar_solicitacao_acesso(text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_criar_solicitacao_acesso(text, text, text, text, text) TO authenticated;

-- RPC para admins alterarem status.
CREATE OR REPLACE FUNCTION public.rpc_atualizar_solicitacao_acesso(
  p_id uuid,
  p_status text,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('aberto','em_analise','aprovado','negado') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
  END IF;
  UPDATE public.access_requests
     SET status = p_status,
         handled_by = auth.uid(),
         handled_note = COALESCE(p_note, handled_note)
   WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_atualizar_solicitacao_acesso(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_atualizar_solicitacao_acesso(uuid, text, text) TO authenticated;

-- Vincula a nova página admin no sidebar (categoria Admin já existente).
INSERT INTO public.sidebar_menu_items
  (module_code, item_code, label, route, parent_group, ordem, ativo, require_admin)
VALUES
  ('em_desenvolvimento', 'admin_solicitacoes_acesso', 'Admin / Solicitações de Acesso',
   '/dashboard/admin/solicitacoes-acesso', 'Admin/Governança', 5, true, true)
ON CONFLICT (module_code, item_code) DO NOTHING;