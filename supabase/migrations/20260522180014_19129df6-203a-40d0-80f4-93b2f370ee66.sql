
-- 1) metadata em anexos
ALTER TABLE public.projeto_tarefa_anexos
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) asana_gid em chat messages
ALTER TABLE public.projeto_chat_messages
  ADD COLUMN IF NOT EXISTS asana_gid text;
CREATE INDEX IF NOT EXISTS idx_projeto_chat_messages_asana_gid
  ON public.projeto_chat_messages(asana_gid) WHERE asana_gid IS NOT NULL;

-- 3) tabela nova: anexos de chat de projeto
CREATE TABLE IF NOT EXISTS public.projeto_chat_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.projeto_chat_messages(id) ON DELETE CASCADE,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome text NOT NULL,
  storage_path text NOT NULL,
  tipo_arquivo text,
  tamanho bigint,
  asana_gid text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projeto_chat_anexos_message ON public.projeto_chat_anexos(message_id);
CREATE INDEX IF NOT EXISTS idx_projeto_chat_anexos_projeto ON public.projeto_chat_anexos(projeto_id);
CREATE INDEX IF NOT EXISTS idx_projeto_chat_anexos_asana_gid ON public.projeto_chat_anexos(asana_gid) WHERE asana_gid IS NOT NULL;

ALTER TABLE public.projeto_chat_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read chat anexos" ON public.projeto_chat_anexos;
CREATE POLICY "Members read chat anexos"
  ON public.projeto_chat_anexos FOR SELECT
  TO authenticated
  USING (public.user_can_access_projeto(auth.uid(), projeto_id));

DROP POLICY IF EXISTS "Members insert chat anexos" ON public.projeto_chat_anexos;
CREATE POLICY "Members insert chat anexos"
  ON public.projeto_chat_anexos FOR INSERT
  TO authenticated
  WITH CHECK (public.user_can_access_projeto(auth.uid(), projeto_id) AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Authors delete chat anexos" ON public.projeto_chat_anexos;
CREATE POLICY "Authors delete chat anexos"
  ON public.projeto_chat_anexos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND public.user_can_access_projeto(auth.uid(), projeto_id));

-- 4) tabela nova: workspaces monitorados
CREATE TABLE IF NOT EXISTS public.asana_workspaces_descobertos (
  workspace_gid text PRIMARY KEY,
  nome text,
  empresa_id integer REFERENCES public.empresas(id) ON DELETE SET NULL,
  criador_id_padrao uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  auto_descoberta boolean NOT NULL DEFAULT true,
  last_discovery_at timestamptz,
  last_discovery_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.asana_workspaces_descobertos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage asana workspaces" ON public.asana_workspaces_descobertos;
CREATE POLICY "Admins manage asana workspaces"
  ON public.asana_workspaces_descobertos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 5) deep-link no Asana original
ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS asana_workspace_gid text,
  ADD COLUMN IF NOT EXISTS asana_team_gid text;
CREATE INDEX IF NOT EXISTS idx_projetos_asana_workspace ON public.projetos(asana_workspace_gid) WHERE asana_workspace_gid IS NOT NULL;

-- 6) Seed do workspace principal com Ruby Rose-SP como empresa padrão
INSERT INTO public.asana_workspaces_descobertos (workspace_gid, nome, empresa_id, auto_descoberta, ativo)
VALUES ('1143464998190096', 'BiMaster (Asana)', 1, true, true)
ON CONFLICT (workspace_gid) DO UPDATE
SET empresa_id = COALESCE(public.asana_workspaces_descobertos.empresa_id, EXCLUDED.empresa_id),
    nome = COALESCE(public.asana_workspaces_descobertos.nome, EXCLUDED.nome);
