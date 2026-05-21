
-- ============================================================
-- BRIEFING MEMBROS — trava de permissões equivalente a Projetos
-- ============================================================

CREATE TABLE IF NOT EXISTS public.briefing_membros (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id uuid NOT NULL REFERENCES public.briefings(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  papel       text NOT NULL DEFAULT 'membro'
              CHECK (papel IN ('gestor_produto','coordenador','regulatorio','design',
                               'controle_arte','admin_cofre','diretoria','membro')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (briefing_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_briefing_membros_briefing ON public.briefing_membros(briefing_id);
CREATE INDEX IF NOT EXISTS idx_briefing_membros_user ON public.briefing_membros(user_id);

ALTER TABLE public.briefing_membros ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper SECURITY DEFINER — evita recursão entre policies
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_access_briefing(_briefing_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.briefings b
    WHERE b.id = _briefing_id
      AND (
        b.user_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.briefing_membros bm
          WHERE bm.briefing_id = b.id AND bm.user_id = _user_id
        )
        OR (
          b.projeto_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.projeto_membros pm
            WHERE pm.projeto_id = b.projeto_id AND pm.user_id = _user_id
          )
        )
        OR public.has_role(_user_id, 'admin')
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_briefing(_briefing_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.briefings b
    WHERE b.id = _briefing_id
      AND (
        b.user_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.briefing_membros bm
          WHERE bm.briefing_id = b.id AND bm.user_id = _user_id
            AND bm.papel IN ('gestor_produto','coordenador')
        )
        OR public.has_role(_user_id, 'admin')
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_edit_briefing(_briefing_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.briefings b
    WHERE b.id = _briefing_id
      AND (
        b.user_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.briefing_membros bm
          WHERE bm.briefing_id = b.id AND bm.user_id = _user_id
            AND bm.papel <> 'membro'
        )
        OR (
          b.projeto_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.projeto_membros pm
            WHERE pm.projeto_id = b.projeto_id AND pm.user_id = _user_id
          )
        )
        OR public.has_role(_user_id, 'admin')
      )
  )
$$;

-- ============================================================
-- RLS de briefing_membros
-- ============================================================

CREATE POLICY "briefing_membros: visualizar quem tem acesso"
  ON public.briefing_membros FOR SELECT TO authenticated
  USING (public.can_access_briefing(briefing_id, auth.uid()));

CREATE POLICY "briefing_membros: gerenciar (insert) quem tem manage"
  ON public.briefing_membros FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_briefing(briefing_id, auth.uid()));

CREATE POLICY "briefing_membros: atualizar quem tem manage"
  ON public.briefing_membros FOR UPDATE TO authenticated
  USING (public.can_manage_briefing(briefing_id, auth.uid()))
  WITH CHECK (public.can_manage_briefing(briefing_id, auth.uid()));

CREATE POLICY "briefing_membros: remover quem tem manage"
  ON public.briefing_membros FOR DELETE TO authenticated
  USING (public.can_manage_briefing(briefing_id, auth.uid()));

-- ============================================================
-- Substituir RLS de briefings (criador-only -> herança/membros)
-- ============================================================

DROP POLICY IF EXISTS "Briefings: criador ve" ON public.briefings;
DROP POLICY IF EXISTS "Briefings: criador atualiza" ON public.briefings;
DROP POLICY IF EXISTS "Briefings: criador deleta" ON public.briefings;
DROP POLICY IF EXISTS "Briefings: criador insere" ON public.briefings;

CREATE POLICY "Briefings: ver quem tem acesso"
  ON public.briefings FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.briefing_membros bm
      WHERE bm.briefing_id = briefings.id AND bm.user_id = auth.uid()
    )
    OR (
      projeto_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.projeto_membros pm
        WHERE pm.projeto_id = briefings.projeto_id AND pm.user_id = auth.uid()
      )
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Briefings: inserir como criador"
  ON public.briefings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Briefings: editar quem tem permissao"
  ON public.briefings FOR UPDATE TO authenticated
  USING (public.can_edit_briefing(id, auth.uid()))
  WITH CHECK (public.can_edit_briefing(id, auth.uid()));

CREATE POLICY "Briefings: deletar apenas criador ou admin"
  ON public.briefings FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- ============================================================
-- Backfill: criador vira admin (gestor_produto) automaticamente
-- ============================================================

INSERT INTO public.briefing_membros (briefing_id, user_id, papel)
SELECT id, user_id, 'gestor_produto'
FROM public.briefings
ON CONFLICT (briefing_id, user_id) DO NOTHING;

-- Trigger: ao criar briefing, insere criador como gestor_produto
CREATE OR REPLACE FUNCTION public.briefing_seed_creator_membro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.briefing_membros (briefing_id, user_id, papel)
  VALUES (NEW.id, NEW.user_id, 'gestor_produto')
  ON CONFLICT (briefing_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_briefing_seed_creator ON public.briefings;
CREATE TRIGGER trg_briefing_seed_creator
AFTER INSERT ON public.briefings
FOR EACH ROW EXECUTE FUNCTION public.briefing_seed_creator_membro();
