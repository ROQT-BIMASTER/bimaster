-- PR-Nav-0: feature flag de navegação v1/v2.
--
-- ESTE ARQUIVO NÃO ESTÁ EM supabase/migrations/ DE PROPÓSITO.
-- É uma migration "pendente" — entregue como artefato versionado para revisão.
-- A equipe decide quando aplicá-la via o fluxo controlado de migrations (tooling
-- Supabase). Enquanto não aplicada, o helper `getNavVersion()` retorna 'v1'
-- pelo fallback e o runtime não quebra.
--
-- Para aplicar, copiar o conteúdo para uma nova migration no fluxo padrão.
-- Aditiva e idempotente. Default 'v1' preserva o menu atual.
-- Sem GRANT novo: coluna em tabela existente (user_ui_preferences).

ALTER TABLE public.user_ui_preferences
  ADD COLUMN IF NOT EXISTS nav_version text NOT NULL DEFAULT 'v1';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_ui_preferences_nav_version_check'
  ) THEN
    ALTER TABLE public.user_ui_preferences
      ADD CONSTRAINT user_ui_preferences_nav_version_check
      CHECK (nav_version IN ('v1', 'v2'));
  END IF;
END $$;

COMMENT ON COLUMN public.user_ui_preferences.nav_version IS
  'Feature flag de navegação. v1 = sidebar clássica; v2 = AppRail + ContextualSidebar + Launcher. Default v1.';
