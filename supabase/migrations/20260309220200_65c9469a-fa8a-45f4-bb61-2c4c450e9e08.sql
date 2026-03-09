
-- 1. Create projeto_membros table
CREATE TABLE public.projeto_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  papel text NOT NULL DEFAULT 'membro' CHECK (papel IN ('coordenador', 'membro')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(projeto_id, user_id)
);

-- 2. Create projeto_membro_secoes table
CREATE TABLE public.projeto_membro_secoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membro_id uuid NOT NULL REFERENCES public.projeto_membros(id) ON DELETE CASCADE,
  secao_id uuid NOT NULL REFERENCES public.projeto_secoes(id) ON DELETE CASCADE,
  UNIQUE(membro_id, secao_id)
);

-- 3. Security definer function: can user access project?
CREATE OR REPLACE FUNCTION public.user_can_access_projeto(_user_id uuid, _projeto_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projetos WHERE id = _projeto_id AND criador_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM projeto_membros WHERE projeto_id = _projeto_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- 4. Security definer function: can user access section?
CREATE OR REPLACE FUNCTION public.user_can_access_secao(_user_id uuid, _secao_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    -- Coordenador do projeto vê todas as seções
    SELECT 1 FROM projeto_secoes ps
    JOIN projeto_membros pm ON pm.projeto_id = ps.projeto_id
    WHERE ps.id = _secao_id AND pm.user_id = _user_id AND pm.papel = 'coordenador'
  ) OR EXISTS (
    -- Criador do projeto vê todas as seções
    SELECT 1 FROM projeto_secoes ps
    JOIN projetos p ON p.id = ps.projeto_id
    WHERE ps.id = _secao_id AND p.criador_id = _user_id
  ) OR EXISTS (
    -- Membro com acesso explícito à seção
    SELECT 1 FROM projeto_membro_secoes pms
    JOIN projeto_membros pm ON pm.id = pms.membro_id
    WHERE pms.secao_id = _secao_id AND pm.user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- 5. Enable RLS
ALTER TABLE public.projeto_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_membro_secoes ENABLE ROW LEVEL SECURITY;

-- 6. Drop old permissive SELECT policies
DROP POLICY IF EXISTS "Authenticated users can view projetos" ON public.projetos;
DROP POLICY IF EXISTS "Authenticated users can view projeto_secoes" ON public.projeto_secoes;
DROP POLICY IF EXISTS "Authenticated users can view projeto_tarefas" ON public.projeto_tarefas;

-- 7. New SELECT policies
CREATE POLICY "Users view accessible projects" ON public.projetos
  FOR SELECT TO authenticated
  USING (public.user_can_access_projeto(auth.uid(), id));

CREATE POLICY "Users view accessible sections" ON public.projeto_secoes
  FOR SELECT TO authenticated
  USING (public.user_can_access_secao(auth.uid(), id));

CREATE POLICY "Users view accessible tasks" ON public.projeto_tarefas
  FOR SELECT TO authenticated
  USING (public.user_can_access_secao(auth.uid(), secao_id));

-- 8. RLS for projeto_membros
CREATE POLICY "Members view own project memberships" ON public.projeto_membros
  FOR SELECT TO authenticated
  USING (public.user_can_access_projeto(auth.uid(), projeto_id));

CREATE POLICY "Coordinators manage members" ON public.projeto_membros
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projetos WHERE id = projeto_id AND criador_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM projeto_membros WHERE projeto_id = projeto_membros.projeto_id AND user_id = auth.uid() AND papel = 'coordenador'
    )
  );

CREATE POLICY "Coordinators delete members" ON public.projeto_membros
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projetos WHERE id = projeto_id AND criador_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM projeto_membros pm2 WHERE pm2.projeto_id = projeto_membros.projeto_id AND pm2.user_id = auth.uid() AND pm2.papel = 'coordenador' AND pm2.id != projeto_membros.id
    )
  );

-- 9. RLS for projeto_membro_secoes
CREATE POLICY "Members view section assignments" ON public.projeto_membro_secoes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projeto_membros pm WHERE pm.id = membro_id AND public.user_can_access_projeto(auth.uid(), pm.projeto_id)
    )
  );

CREATE POLICY "Coordinators manage section assignments" ON public.projeto_membro_secoes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projeto_membros pm
      JOIN projeto_membros coord ON coord.projeto_id = pm.projeto_id
      WHERE pm.id = membro_id AND coord.user_id = auth.uid() AND coord.papel = 'coordenador'
    )
  );

CREATE POLICY "Coordinators delete section assignments" ON public.projeto_membro_secoes
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projeto_membros pm
      JOIN projeto_membros coord ON coord.projeto_id = pm.projeto_id
      WHERE pm.id = membro_id AND coord.user_id = auth.uid() AND coord.papel = 'coordenador'
    )
  );

-- 10. Insert existing project creators as coordenadores
INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
SELECT id, criador_id, 'coordenador' FROM public.projetos
ON CONFLICT (projeto_id, user_id) DO NOTHING;
