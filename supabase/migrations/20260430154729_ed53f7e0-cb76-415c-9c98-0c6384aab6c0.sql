-- =========================================================
-- AUDITORIA PROJETOS — FASE 2 (PERFORMANCE)
-- =========================================================
-- Tudo idempotente e aditivo. RPCs SECURITY DEFINER respeitam
-- a mesma visibilidade já aplicada em projeto_membros / criador_id.

-- ---------------------------------------------------------
-- 1) RPC: get_projetos_collab_avatars
-- Substitui o fan-out N+batches do hook useProjetos.projetoColaboradores.
-- Retorna 1 linha por (projeto_id, user_id) único, com nome/avatar do profile.
-- Apenas projetos onde o usuário corrente é membro OU criador.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_projetos_collab_avatars()
RETURNS TABLE (
  projeto_id uuid,
  user_id    uuid,
  nome       text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH meus_projetos AS (
    SELECT id AS projeto_id FROM public.projetos WHERE criador_id = auth.uid()
    UNION
    SELECT projeto_id FROM public.projeto_membros WHERE user_id = auth.uid()
  ),
  collabs AS (
    SELECT DISTINCT
           t.projeto_id,
           c.user_id
      FROM public.projeto_tarefa_colaboradores c
      JOIN public.projeto_tarefas t ON t.id = c.tarefa_id
     WHERE t.excluida_em IS NULL
       AND t.projeto_id IN (SELECT projeto_id FROM meus_projetos)
  )
  SELECT c.projeto_id,
         c.user_id,
         p.nome,
         p.avatar_url
    FROM collabs c
    LEFT JOIN public.profiles p ON p.id = c.user_id;
$$;

REVOKE ALL ON FUNCTION public.get_projetos_collab_avatars() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_projetos_collab_avatars() TO authenticated;

-- ---------------------------------------------------------
-- 2) RPC: get_meus_projetos_metrics
-- Retorna métricas agregadas server-side para useMeusProjetosRecentes.
-- Evita trazer todas as tarefas para o cliente.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_meus_projetos_metrics(p_limit int DEFAULT 200)
RETURNS TABLE (
  id               uuid,
  nome             text,
  cor              text,
  icone            text,
  status           text,
  total_tarefas    int,
  concluidas       int,
  atrasadas        int,
  minhas_pendentes int,
  updated_at       timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH meus_ids AS (
    SELECT id AS projeto_id FROM public.projetos
     WHERE criador_id = auth.uid() AND status <> 'finalizado'
    UNION
    SELECT pm.projeto_id
      FROM public.projeto_membros pm
      JOIN public.projetos pr ON pr.id = pm.projeto_id
     WHERE pm.user_id = auth.uid() AND pr.status <> 'finalizado'
  ),
  base AS (
    SELECT pr.id, pr.nome, pr.cor, pr.icone, pr.status, pr.updated_at
      FROM public.projetos pr
     WHERE pr.id IN (SELECT projeto_id FROM meus_ids)
     ORDER BY pr.updated_at DESC
     LIMIT GREATEST(1, LEAST(COALESCE(p_limit,200), 500))
  ),
  agg AS (
    SELECT t.projeto_id,
           COUNT(*)::int                                                                                AS total_tarefas,
           COUNT(*) FILTER (WHERE t.status = 'concluida')::int                                          AS concluidas,
           COUNT(*) FILTER (
             WHERE t.status <> 'concluida'
               AND t.data_prazo IS NOT NULL
               AND t.data_prazo < CURRENT_DATE
           )::int                                                                                       AS atrasadas,
           COUNT(*) FILTER (WHERE t.responsavel_id = auth.uid() AND t.status <> 'concluida')::int       AS minhas_pendentes
      FROM public.projeto_tarefas t
     WHERE t.excluida_em IS NULL
       AND t.projeto_id IN (SELECT id FROM base)
     GROUP BY t.projeto_id
  )
  SELECT b.id,
         b.nome,
         COALESCE(b.cor,   '#6366f1')   AS cor,
         COALESCE(b.icone, 'FolderKanban') AS icone,
         b.status,
         COALESCE(a.total_tarefas, 0)    AS total_tarefas,
         COALESCE(a.concluidas, 0)       AS concluidas,
         COALESCE(a.atrasadas, 0)        AS atrasadas,
         COALESCE(a.minhas_pendentes, 0) AS minhas_pendentes,
         b.updated_at
    FROM base b
    LEFT JOIN agg a ON a.projeto_id = b.id
    ORDER BY b.updated_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_meus_projetos_metrics(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_meus_projetos_metrics(int) TO authenticated;

-- ---------------------------------------------------------
-- 3) RPC: count_projeto_tarefas_excluidas
-- Para o badge da lixeira no header (sem buscar registros).
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_projeto_tarefas_excluidas(p_projeto_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
    FROM public.projeto_tarefas t
   WHERE t.projeto_id = p_projeto_id
     AND t.excluida_em IS NOT NULL
     AND (
       EXISTS (SELECT 1 FROM public.projetos pr
                WHERE pr.id = p_projeto_id AND pr.criador_id = auth.uid())
       OR EXISTS (SELECT 1 FROM public.projeto_membros pm
                   WHERE pm.projeto_id = p_projeto_id AND pm.user_id = auth.uid())
     );
$$;

REVOKE ALL ON FUNCTION public.count_projeto_tarefas_excluidas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_projeto_tarefas_excluidas(uuid) TO authenticated;

-- ---------------------------------------------------------
-- 4) Realtime — habilita publicação para tarefas e seções.
-- REPLICA IDENTITY FULL para que UPDATEs tragam o "old"
-- (filtros server-side por projeto_id continuam ok).
-- ---------------------------------------------------------
ALTER TABLE public.projeto_tarefas REPLICA IDENTITY FULL;
ALTER TABLE public.projeto_secoes  REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='projeto_tarefas'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.projeto_tarefas';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='projeto_secoes'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.projeto_secoes';
  END IF;
END $$;