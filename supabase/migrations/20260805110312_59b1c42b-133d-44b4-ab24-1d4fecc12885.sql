-- ============================================================
-- Organização de Projetos em Pastas (Workspaces)
-- Camada puramente aditiva: não altera projetos nem visibilidade.
-- ============================================================

CREATE TABLE public.projeto_pastas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 60),
  cor text NOT NULL DEFAULT '#6366F1',
  icone text NOT NULL DEFAULT 'Folder',
  ordem integer NOT NULL DEFAULT 0,
  escopo text NOT NULL CHECK (escopo IN ('compartilhada', 'pessoal')),
  owner_id uuid NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projeto_pastas_owner_escopo_chk CHECK (
    (escopo = 'pessoal' AND owner_id IS NOT NULL)
    OR (escopo = 'compartilhada' AND owner_id IS NULL)
  )
);

CREATE UNIQUE INDEX projeto_pastas_nome_compartilhada_uidx
  ON public.projeto_pastas (lower(btrim(nome)))
  WHERE escopo = 'compartilhada';

CREATE UNIQUE INDEX projeto_pastas_nome_pessoal_uidx
  ON public.projeto_pastas (owner_id, lower(btrim(nome)))
  WHERE escopo = 'pessoal';

CREATE INDEX projeto_pastas_owner_idx ON public.projeto_pastas (owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_pastas TO authenticated;
GRANT ALL ON public.projeto_pastas TO service_role;

ALTER TABLE public.projeto_pastas ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------

CREATE TABLE public.projeto_pasta_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pasta_id uuid NOT NULL REFERENCES public.projeto_pastas(id) ON DELETE CASCADE,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  user_id uuid NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- No máximo uma pasta compartilhada por projeto
CREATE UNIQUE INDEX projeto_pasta_itens_compartilhada_uidx
  ON public.projeto_pasta_itens (projeto_id)
  WHERE user_id IS NULL;

-- No máximo uma pasta pessoal por (projeto, usuário)
CREATE UNIQUE INDEX projeto_pasta_itens_pessoal_uidx
  ON public.projeto_pasta_itens (projeto_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX projeto_pasta_itens_pasta_idx ON public.projeto_pasta_itens (pasta_id);
CREATE INDEX projeto_pasta_itens_user_idx ON public.projeto_pasta_itens (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_pasta_itens TO authenticated;
GRANT ALL ON public.projeto_pasta_itens TO service_role;

ALTER TABLE public.projeto_pasta_itens ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Quem administra pastas compartilhadas: admin OU gerente geral de Projetos
-- (role gerente, sem supervisor, departamento Projetos) — espelha o front.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pode_gerir_pastas_compartilhadas(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
     OR EXISTS (
       SELECT 1
       FROM public.profiles p
       JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'gerente'
       WHERE p.id = _user_id
         AND p.supervisor_id IS NULL
         AND p.departamento_id = '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130'
     );
$$;

REVOKE ALL ON FUNCTION public.pode_gerir_pastas_compartilhadas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_gerir_pastas_compartilhadas(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- Policies: projeto_pastas
-- ------------------------------------------------------------
CREATE POLICY "pastas_select"
ON public.projeto_pastas FOR SELECT TO authenticated
USING (escopo = 'compartilhada' OR owner_id = auth.uid());

CREATE POLICY "pastas_insert"
ON public.projeto_pastas FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    (escopo = 'pessoal' AND owner_id = auth.uid())
    OR (escopo = 'compartilhada' AND public.pode_gerir_pastas_compartilhadas(auth.uid()))
  )
);

CREATE POLICY "pastas_update"
ON public.projeto_pastas FOR UPDATE TO authenticated
USING (
  (escopo = 'pessoal' AND owner_id = auth.uid())
  OR (escopo = 'compartilhada' AND public.pode_gerir_pastas_compartilhadas(auth.uid()))
)
WITH CHECK (
  (escopo = 'pessoal' AND owner_id = auth.uid())
  OR (escopo = 'compartilhada' AND public.pode_gerir_pastas_compartilhadas(auth.uid()))
);

CREATE POLICY "pastas_delete"
ON public.projeto_pastas FOR DELETE TO authenticated
USING (
  (escopo = 'pessoal' AND owner_id = auth.uid())
  OR (escopo = 'compartilhada' AND public.pode_gerir_pastas_compartilhadas(auth.uid()))
);

CREATE TRIGGER projeto_pastas_touch_updated_at
BEFORE UPDATE ON public.projeto_pastas
FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

-- ------------------------------------------------------------
-- Policies: projeto_pasta_itens
-- Vínculo pessoal: só o próprio usuário.
-- Vínculo compartilhado: só quem gere pastas compartilhadas.
-- Em ambos os casos, a pasta precisa ser visível ao usuário.
-- ------------------------------------------------------------
CREATE POLICY "pasta_itens_select"
ON public.projeto_pasta_itens FOR SELECT TO authenticated
USING (
  user_id IS NULL OR user_id = auth.uid()
);

CREATE POLICY "pasta_itens_insert"
ON public.projeto_pasta_itens FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    (user_id = auth.uid() AND pasta_id IN (
      SELECT id FROM public.projeto_pastas
      WHERE escopo = 'pessoal' AND owner_id = auth.uid()
    ))
    OR (user_id IS NULL
        AND public.pode_gerir_pastas_compartilhadas(auth.uid())
        AND pasta_id IN (
          SELECT id FROM public.projeto_pastas WHERE escopo = 'compartilhada'
        ))
  )
);

CREATE POLICY "pasta_itens_update"
ON public.projeto_pasta_itens FOR UPDATE TO authenticated
USING (
  (user_id = auth.uid())
  OR (user_id IS NULL AND public.pode_gerir_pastas_compartilhadas(auth.uid()))
)
WITH CHECK (
  (user_id = auth.uid() AND pasta_id IN (
    SELECT id FROM public.projeto_pastas
    WHERE escopo = 'pessoal' AND owner_id = auth.uid()
  ))
  OR (user_id IS NULL
      AND public.pode_gerir_pastas_compartilhadas(auth.uid())
      AND pasta_id IN (
        SELECT id FROM public.projeto_pastas WHERE escopo = 'compartilhada'
      ))
);

CREATE POLICY "pasta_itens_delete"
ON public.projeto_pasta_itens FOR DELETE TO authenticated
USING (
  (user_id = auth.uid())
  OR (user_id IS NULL AND public.pode_gerir_pastas_compartilhadas(auth.uid()))
);