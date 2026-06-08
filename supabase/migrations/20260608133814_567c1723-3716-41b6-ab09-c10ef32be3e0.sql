
-- 1) Tabela de leituras por usuário/tarefa
CREATE TABLE IF NOT EXISTS public.projeto_tarefa_chat_leituras (
  user_id uuid NOT NULL,
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tarefa_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_tarefa_chat_leituras TO authenticated;
GRANT ALL ON public.projeto_tarefa_chat_leituras TO service_role;

ALTER TABLE public.projeto_tarefa_chat_leituras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User manages own task chat reads"
  ON public.projeto_tarefa_chat_leituras;
CREATE POLICY "User manages own task chat reads"
  ON public.projeto_tarefa_chat_leituras
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ptc_leituras_tarefa
  ON public.projeto_tarefa_chat_leituras (tarefa_id);

-- 2) RPC: lista tarefas/subtarefas com chat para o usuário atual
CREATE OR REPLACE FUNCTION public.rpc_chat_tarefas_do_usuario()
RETURNS TABLE (
  tarefa_id uuid,
  projeto_id uuid,
  projeto_nome text,
  projeto_cor text,
  parent_tarefa_id uuid,
  parent_titulo text,
  titulo text,
  codigo text,
  status text,
  is_subtask boolean,
  ultima_mensagem text,
  ultima_mensagem_em timestamptz,
  ultimo_autor_id uuid,
  ultimo_autor_nome text,
  nao_lidas int,
  mencoes_abertas int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT auth.uid() AS uid
  ),
  -- Tarefas em que o usuário tem algum vínculo direto
  tarefas_interesse AS (
    SELECT DISTINCT t.id
    FROM public.projeto_tarefas t, me
    WHERE t.excluida_em IS NULL
      AND (
        t.responsavel_id = me.uid
        OR t.criador_id = me.uid
        OR EXISTS (
          SELECT 1 FROM public.projeto_tarefa_colaboradores c
           WHERE c.tarefa_id = t.id AND c.user_id = me.uid
        )
        OR EXISTS (
          SELECT 1 FROM public.projeto_tarefa_seguidores s
           WHERE s.tarefa_id = t.id AND s.user_id = me.uid
        )
        OR EXISTS (
          SELECT 1 FROM public.projeto_tarefa_messages m
           WHERE m.tarefa_id = t.id AND me.uid = ANY(m.mentions)
        )
      )
      -- Só listar tarefas que realmente tenham conversa
      AND EXISTS (
        SELECT 1 FROM public.projeto_tarefa_messages m
         WHERE m.tarefa_id = t.id
      )
  ),
  ultima AS (
    SELECT DISTINCT ON (m.tarefa_id)
      m.tarefa_id,
      m.conteudo AS texto,
      m.created_at,
      m.user_id
    FROM public.projeto_tarefa_messages m
    WHERE m.tarefa_id IN (SELECT id FROM tarefas_interesse)
    ORDER BY m.tarefa_id, m.created_at DESC
  ),
  contagens AS (
    SELECT
      m.tarefa_id,
      COUNT(*) FILTER (
        WHERE m.user_id <> (SELECT uid FROM me)
          AND m.created_at > COALESCE(l.last_read_at, '1970-01-01'::timestamptz)
      )::int AS nao_lidas,
      COUNT(*) FILTER (
        WHERE m.user_id <> (SELECT uid FROM me)
          AND m.created_at > COALESCE(l.last_read_at, '1970-01-01'::timestamptz)
          AND (SELECT uid FROM me) = ANY(m.mentions)
      )::int AS mencoes
    FROM public.projeto_tarefa_messages m
    LEFT JOIN public.projeto_tarefa_chat_leituras l
      ON l.tarefa_id = m.tarefa_id
     AND l.user_id = (SELECT uid FROM me)
    WHERE m.tarefa_id IN (SELECT id FROM tarefas_interesse)
    GROUP BY m.tarefa_id, l.last_read_at
  )
  SELECT
    t.id AS tarefa_id,
    t.projeto_id,
    p.nome AS projeto_nome,
    p.cor AS projeto_cor,
    t.parent_tarefa_id,
    pt.titulo AS parent_titulo,
    t.titulo,
    t.codigo,
    t.status,
    COALESCE(t.is_subtask, false) AS is_subtask,
    u.texto AS ultima_mensagem,
    u.created_at AS ultima_mensagem_em,
    u.user_id AS ultimo_autor_id,
    pr.nome AS ultimo_autor_nome,
    COALESCE(c.nao_lidas, 0) AS nao_lidas,
    COALESCE(c.mencoes, 0) AS mencoes_abertas
  FROM public.projeto_tarefas t
  JOIN tarefas_interesse ti ON ti.id = t.id
  JOIN public.projetos p ON p.id = t.projeto_id
  LEFT JOIN public.projeto_tarefas pt ON pt.id = t.parent_tarefa_id
  LEFT JOIN ultima u ON u.tarefa_id = t.id
  LEFT JOIN contagens c ON c.tarefa_id = t.id
  LEFT JOIN public.profiles pr ON pr.id = u.user_id
  ORDER BY u.created_at DESC NULLS LAST;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_chat_tarefas_do_usuario() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.rpc_chat_tarefas_do_usuario() TO authenticated;

-- 3) RPC: marcar tarefa como lida pelo usuário
CREATE OR REPLACE FUNCTION public.rpc_tarefa_chat_marcar_lida(p_tarefa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_can_access_projeto_via_tarefa(auth.uid(), p_tarefa_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  INSERT INTO public.projeto_tarefa_chat_leituras (user_id, tarefa_id, last_read_at)
  VALUES (auth.uid(), p_tarefa_id, now())
  ON CONFLICT (user_id, tarefa_id)
  DO UPDATE SET last_read_at = EXCLUDED.last_read_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_tarefa_chat_marcar_lida(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.rpc_tarefa_chat_marcar_lida(uuid) TO authenticated;
