
-- 1. Add criado_por column
ALTER TABLE planos_reducao ADD COLUMN criado_por uuid;

-- Assign existing plans to first admin
UPDATE planos_reducao SET criado_por = (SELECT user_id FROM user_roles WHERE role = 'admin' LIMIT 1) WHERE criado_por IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE planos_reducao ALTER COLUMN criado_por SET NOT NULL;

-- 2. Create sharing table
CREATE TABLE public.planos_reducao_compartilhados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id uuid REFERENCES planos_reducao(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(plano_id, user_id)
);

ALTER TABLE public.planos_reducao_compartilhados ENABLE ROW LEVEL SECURITY;

-- 3. Helper function to check plan access
CREATE OR REPLACE FUNCTION public.user_can_access_plano(p_user_id uuid, p_plano_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM planos_reducao WHERE id = p_plano_id AND criado_por = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM planos_reducao_compartilhados WHERE plano_id = p_plano_id AND user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = p_user_id AND role IN ('admin', 'supervisor')
  );
$$;

-- 4. RLS for planos_reducao (drop old policies first if any)
DO $$ BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "planos_reducao_select" ON planos_reducao;
  DROP POLICY IF EXISTS "planos_reducao_insert" ON planos_reducao;
  DROP POLICY IF EXISTS "planos_reducao_update" ON planos_reducao;
  DROP POLICY IF EXISTS "planos_reducao_delete" ON planos_reducao;
  DROP POLICY IF EXISTS "Authenticated users can manage planos_reducao" ON planos_reducao;
  DROP POLICY IF EXISTS "Allow authenticated users full access to planos_reducao" ON planos_reducao;
END $$;

ALTER TABLE planos_reducao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planos_reducao_select" ON planos_reducao
  FOR SELECT TO authenticated
  USING (public.user_can_access_plano(auth.uid(), id));

CREATE POLICY "planos_reducao_insert" ON planos_reducao
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = criado_por);

CREATE POLICY "planos_reducao_update" ON planos_reducao
  FOR UPDATE TO authenticated
  USING (public.user_can_access_plano(auth.uid(), id));

CREATE POLICY "planos_reducao_delete" ON planos_reducao
  FOR DELETE TO authenticated
  USING (criado_por = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 5. RLS for planos_reducao_compartilhados
CREATE POLICY "compartilhados_select" ON planos_reducao_compartilhados
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM planos_reducao WHERE id = plano_id AND criado_por = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor'))
  );

CREATE POLICY "compartilhados_insert" ON planos_reducao_compartilhados
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM planos_reducao WHERE id = plano_id AND criado_por = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "compartilhados_delete" ON planos_reducao_compartilhados
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM planos_reducao WHERE id = plano_id AND criado_por = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
