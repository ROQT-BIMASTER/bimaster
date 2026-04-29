
-- ============================================================================
-- PROJETO CONVITES — Sistema de convites para acesso a projetos
-- ============================================================================

-- Enum de status
DO $$ BEGIN
  CREATE TYPE public.projeto_convite_status AS ENUM (
    'pending', 'accepted', 'declined', 'cancelled', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela
CREATE TABLE IF NOT EXISTS public.projeto_convites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  convidado_user_id UUID,
  convidado_por UUID NOT NULL,
  papel TEXT NOT NULL DEFAULT 'membro',
  secoes_ids UUID[] NOT NULL DEFAULT '{}',
  mensagem TEXT,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status public.projeto_convite_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID,
  CONSTRAINT projeto_convites_email_lower CHECK (email = lower(email)),
  CONSTRAINT projeto_convites_mensagem_len CHECK (mensagem IS NULL OR length(mensagem) <= 500)
);

CREATE UNIQUE INDEX IF NOT EXISTS projeto_convites_unique_pending
  ON public.projeto_convites (projeto_id, email)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_projeto_convites_email ON public.projeto_convites (email);
CREATE INDEX IF NOT EXISTS idx_projeto_convites_user ON public.projeto_convites (convidado_user_id);
CREATE INDEX IF NOT EXISTS idx_projeto_convites_projeto ON public.projeto_convites (projeto_id);
CREATE INDEX IF NOT EXISTS idx_projeto_convites_status ON public.projeto_convites (status);

ALTER TABLE public.projeto_convites ENABLE ROW LEVEL SECURITY;

-- Helper: descobrir email do auth.uid() atual
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT lower(email) FROM auth.users WHERE id = auth.uid();
$$;

-- ============== POLICIES ==============

-- SELECT: convidante, destinatário (por uid ou email), coordenadores/gestores do projeto, admin
CREATE POLICY "convites: select por interessados"
ON public.projeto_convites FOR SELECT
TO authenticated
USING (
  convidado_por = auth.uid()
  OR convidado_user_id = auth.uid()
  OR lower(email) = public.current_user_email()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.projeto_membros pm
    WHERE pm.projeto_id = projeto_convites.projeto_id
      AND pm.user_id = auth.uid()
      AND pm.papel IN ('coordenador', 'gestor_produto')
  )
);

-- INSERT: coordenador/gestor do projeto OU admin; convidado_por deve ser o próprio
CREATE POLICY "convites: insert por coordenadores"
ON public.projeto_convites FOR INSERT
TO authenticated
WITH CHECK (
  convidado_por = auth.uid()
  AND email = lower(email)
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.projeto_membros pm
      WHERE pm.projeto_id = projeto_convites.projeto_id
        AND pm.user_id = auth.uid()
        AND pm.papel IN ('coordenador', 'gestor_produto')
    )
  )
);

-- UPDATE: cancelar (convidante/coordenador/admin). Aceitar/recusar é feito via RPC SECURITY DEFINER.
CREATE POLICY "convites: update cancelar"
ON public.projeto_convites FOR UPDATE
TO authenticated
USING (
  convidado_por = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.projeto_membros pm
    WHERE pm.projeto_id = projeto_convites.projeto_id
      AND pm.user_id = auth.uid()
      AND pm.papel IN ('coordenador', 'gestor_produto')
  )
);

-- ============== TRIGGER: auto-link + notificação ==============

CREATE OR REPLACE FUNCTION public.projeto_convites_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _projeto_nome TEXT;
  _convidante_nome TEXT;
BEGIN
  -- Auto-link: se email casa com profile existente
  IF NEW.convidado_user_id IS NULL THEN
    SELECT id INTO NEW.convidado_user_id
    FROM auth.users WHERE lower(email) = NEW.email LIMIT 1;
  END IF;

  -- Notificação interna se for usuário do sistema
  IF NEW.convidado_user_id IS NOT NULL THEN
    SELECT nome INTO _projeto_nome FROM public.projetos WHERE id = NEW.projeto_id;
    SELECT nome INTO _convidante_nome FROM public.profiles WHERE id = NEW.convidado_por;

    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (
      NEW.convidado_user_id,
      'projeto_convite',
      'Convite para projeto',
      COALESCE(_convidante_nome, 'Alguém') || ' convidou você para o projeto "' || COALESCE(_projeto_nome, 'sem nome') || '"',
      '/dashboard/projetos/convites'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projeto_convites_after_insert ON public.projeto_convites;
CREATE TRIGGER trg_projeto_convites_before_insert
BEFORE INSERT ON public.projeto_convites
FOR EACH ROW EXECUTE FUNCTION public.projeto_convites_after_insert();

-- ============== RPCs ==============

-- Buscar convite por token (para tela pública de aceite, sem expor PII completa)
CREATE OR REPLACE FUNCTION public.get_convite_by_token(_token UUID)
RETURNS TABLE (
  id UUID,
  projeto_id UUID,
  projeto_nome TEXT,
  email TEXT,
  papel TEXT,
  mensagem TEXT,
  status public.projeto_convite_status,
  expires_at TIMESTAMPTZ,
  convidante_nome TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    c.id,
    c.projeto_id,
    p.nome,
    c.email,
    c.papel,
    c.mensagem,
    c.status,
    c.expires_at,
    pr.nome
  FROM public.projeto_convites c
  JOIN public.projetos p ON p.id = c.projeto_id
  LEFT JOIN public.profiles pr ON pr.id = c.convidado_por
  WHERE c.token = _token;
$$;

-- Aceitar convite
CREATE OR REPLACE FUNCTION public.accept_projeto_convite(_token UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _convite RECORD;
  _user_email TEXT;
  _membro_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO _convite FROM public.projeto_convites WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF _convite.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status', 'status', _convite.status);
  END IF;

  IF _convite.expires_at < now() THEN
    UPDATE public.projeto_convites SET status = 'expired' WHERE id = _convite.id;
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  SELECT lower(email) INTO _user_email FROM auth.users WHERE id = auth.uid();
  IF _user_email <> _convite.email THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_mismatch');
  END IF;

  -- Cria membro (idempotente)
  INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
  VALUES (_convite.projeto_id, auth.uid(), _convite.papel)
  ON CONFLICT (projeto_id, user_id) DO UPDATE SET papel = EXCLUDED.papel
  RETURNING id INTO _membro_id;

  -- Aplica seções visíveis (se houver)
  IF array_length(_convite.secoes_ids, 1) > 0 THEN
    DELETE FROM public.projeto_membro_secoes WHERE membro_id = _membro_id;
    INSERT INTO public.projeto_membro_secoes (membro_id, secao_id)
    SELECT _membro_id, unnest(_convite.secoes_ids);
  END IF;

  UPDATE public.projeto_convites
    SET status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
    WHERE id = _convite.id;

  RETURN jsonb_build_object('ok', true, 'projeto_id', _convite.projeto_id);
END;
$$;

-- Recusar
CREATE OR REPLACE FUNCTION public.decline_projeto_convite(_token UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _convite RECORD;
  _user_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO _convite FROM public.projeto_convites WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF _convite.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  SELECT lower(email) INTO _user_email FROM auth.users WHERE id = auth.uid();
  IF _user_email <> _convite.email THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_mismatch');
  END IF;

  UPDATE public.projeto_convites SET status = 'declined' WHERE id = _convite.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Cancelar (pelo convidante/coordenador/admin via UPDATE policy)
CREATE OR REPLACE FUNCTION public.cancel_projeto_convite(_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
BEGIN
  UPDATE public.projeto_convites
    SET status = 'cancelled'
    WHERE id = _id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found_or_invalid');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Marca convites vencidos
CREATE OR REPLACE FUNCTION public.expire_old_convites()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _count INTEGER;
BEGIN
  UPDATE public.projeto_convites
    SET status = 'expired'
    WHERE status = 'pending' AND expires_at < now();
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_convite_by_token(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.accept_projeto_convite(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_projeto_convite(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_projeto_convite(UUID) TO authenticated;
