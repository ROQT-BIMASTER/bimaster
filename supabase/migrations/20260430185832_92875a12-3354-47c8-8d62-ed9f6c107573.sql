
-- 1) Perfil aprendido por usuário+projeto
CREATE TABLE IF NOT EXISTS public.projeto_copilot_user_profile (
  user_id uuid NOT NULL,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  perfil_resumo text NOT NULL DEFAULT '',
  preferencias jsonb NOT NULL DEFAULT '{}'::jsonb,
  mensagens_observadas integer NOT NULL DEFAULT 0,
  ultima_atualizacao timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, projeto_id)
);

ALTER TABLE public.projeto_copilot_user_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY copilot_profile_select ON public.projeto_copilot_user_profile
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

-- inserts/updates apenas via service role (edge function)
CREATE POLICY copilot_profile_no_direct_insert ON public.projeto_copilot_user_profile
  FOR INSERT WITH CHECK (false);
CREATE POLICY copilot_profile_no_direct_update ON public.projeto_copilot_user_profile
  FOR UPDATE USING (false);

-- 2) Colunas em threads (salvo + expira em 30d)
ALTER TABLE public.projeto_copilot_threads
  ADD COLUMN IF NOT EXISTS salvo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days');

-- 3) Colunas em relatórios (salvo + nome personalizado)
ALTER TABLE public.projeto_copilot_relatorios
  ADD COLUMN IF NOT EXISTS salvo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nome_personalizado text;

-- 4) Tabela de vínculo relatório <-> tarefa (N:N)
CREATE TABLE IF NOT EXISTS public.projeto_copilot_relatorio_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relatorio_id uuid NOT NULL REFERENCES public.projeto_copilot_relatorios(id) ON DELETE CASCADE,
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  anexo_id uuid REFERENCES public.projeto_tarefa_anexos(id) ON DELETE SET NULL,
  criado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (relatorio_id, tarefa_id)
);

CREATE INDEX IF NOT EXISTS idx_copilot_rel_tarefas_tarefa ON public.projeto_copilot_relatorio_tarefas(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_copilot_rel_tarefas_relatorio ON public.projeto_copilot_relatorio_tarefas(relatorio_id);

ALTER TABLE public.projeto_copilot_relatorio_tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY copilot_rel_tarefas_select ON public.projeto_copilot_relatorio_tarefas
  FOR SELECT USING (
    user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id) OR is_admin()
  );

CREATE POLICY copilot_rel_tarefas_no_direct_insert ON public.projeto_copilot_relatorio_tarefas
  FOR INSERT WITH CHECK (false);
CREATE POLICY copilot_rel_tarefas_no_direct_delete ON public.projeto_copilot_relatorio_tarefas
  FOR DELETE USING (false);

-- 5) RPC: salvar relatório (toggle salvo + nome personalizado)
CREATE OR REPLACE FUNCTION public.copilot_set_relatorio_salvo(
  _relatorio_id uuid,
  _salvo boolean,
  _nome_personalizado text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _owner uuid;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT user_id INTO _owner FROM public.projeto_copilot_relatorios WHERE id = _relatorio_id;
  IF _owner IS NULL THEN RAISE EXCEPTION 'Relatório não encontrado'; END IF;
  IF _owner <> _user AND NOT is_admin() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  UPDATE public.projeto_copilot_relatorios
     SET salvo = _salvo,
         nome_personalizado = COALESCE(_nome_personalizado, nome_personalizado),
         expires_at = CASE WHEN _salvo THEN now() + interval '100 years' ELSE now() + interval '30 days' END
   WHERE id = _relatorio_id;
END $$;

REVOKE ALL ON FUNCTION public.copilot_set_relatorio_salvo(uuid, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.copilot_set_relatorio_salvo(uuid, boolean, text) TO authenticated;

-- 6) RPC: salvar/desmarcar conversa
CREATE OR REPLACE FUNCTION public.copilot_set_thread_salvo(
  _thread_id uuid,
  _salvo boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _owner uuid;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT user_id INTO _owner FROM public.projeto_copilot_threads WHERE id = _thread_id;
  IF _owner IS NULL THEN RAISE EXCEPTION 'Conversa não encontrada'; END IF;
  IF _owner <> _user AND NOT is_admin() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  UPDATE public.projeto_copilot_threads
     SET salvo = _salvo,
         expires_at = CASE WHEN _salvo THEN now() + interval '100 years' ELSE now() + interval '30 days' END
   WHERE id = _thread_id;
END $$;

REVOKE ALL ON FUNCTION public.copilot_set_thread_salvo(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.copilot_set_thread_salvo(uuid, boolean) TO authenticated;
