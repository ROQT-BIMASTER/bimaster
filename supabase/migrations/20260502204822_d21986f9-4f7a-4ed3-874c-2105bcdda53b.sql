-- View consolidada de aprovações + RPC pessoal + índices

CREATE OR REPLACE VIEW public.vw_aprovacoes_consolidado
WITH (security_invoker = true)
AS
SELECT
  i.id,
  i.config_id,
  i.tarefa_id,
  i.secao_id,
  i.projeto_id,
  i.lote_nome,
  i.titulo,
  i.status,
  i.etapa_atual_ordem,
  i.rodada,
  i.prazo_lote,
  i.created_at,
  i.created_by,
  cfg.nome AS config_nome,
  et.nome AS etapa_nome,
  et.tipo_aprovacao,
  ev.responsavel_id AS etapa_responsavel_id,
  ev.prazo_em AS etapa_prazo_em,
  ev.entrou_em AS etapa_entrou_em,
  CASE
    WHEN i.status IN ('concluido','cancelado') THEN false
    WHEN ev.prazo_em IS NULL THEN false
    ELSE ev.prazo_em < now()
  END AS atrasado,
  CASE
    WHEN i.status IN ('concluido','cancelado') OR ev.prazo_em IS NULL THEN NULL
    ELSE EXTRACT(DAY FROM (ev.prazo_em - now()))::int
  END AS dias_restantes,
  p.nome AS projeto_nome,
  s.nome AS secao_nome,
  t.titulo AS tarefa_titulo,
  (SELECT COUNT(*) FROM public.fluxo_aprovacao_lote_documentos d WHERE d.instancia_id = i.id) AS qtd_documentos
FROM public.fluxo_aprovacao_instancias i
LEFT JOIN public.fluxo_aprovacao_config cfg ON cfg.id = i.config_id
LEFT JOIN public.fluxo_aprovacao_etapas et
  ON et.config_id = i.config_id AND et.ordem = i.etapa_atual_ordem AND et.ativo = true
LEFT JOIN LATERAL (
  SELECT e.responsavel_id, e.prazo_em, e.entrou_em
  FROM public.fluxo_aprovacao_etapa_eventos e
  WHERE e.instancia_id = i.id
    AND e.etapa_ordem = i.etapa_atual_ordem
    AND e.rodada = i.rodada
    AND e.decisao = 'pendente'
  ORDER BY e.entrou_em DESC
  LIMIT 1
) ev ON true
LEFT JOIN public.projetos p ON p.id = i.projeto_id
LEFT JOIN public.projeto_secoes s ON s.id = i.secao_id
LEFT JOIN public.projeto_tarefas t ON t.id = i.tarefa_id;

GRANT SELECT ON public.vw_aprovacoes_consolidado TO authenticated;

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_fai_status_etapa
  ON public.fluxo_aprovacao_instancias(status, etapa_atual_ordem);

CREATE INDEX IF NOT EXISTS idx_faee_responsavel_pendente
  ON public.fluxo_aprovacao_etapa_eventos(responsavel_id)
  WHERE decisao = 'pendente';

CREATE INDEX IF NOT EXISTS idx_faee_instancia_etapa_rodada
  ON public.fluxo_aprovacao_etapa_eventos(instancia_id, etapa_ordem, rodada);

-- RPC: lotes onde o user é responsável (titular ou suplente) da etapa pendente atual
CREATE OR REPLACE FUNCTION public.rpc_aprovacoes_pendentes_para(_user_id uuid)
RETURNS SETOF public.vw_aprovacoes_consolidado
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT v.*
  FROM public.vw_aprovacoes_consolidado v
  WHERE v.status NOT IN ('concluido','cancelado')
    AND (
      v.etapa_responsavel_id = _user_id
      OR EXISTS (
        SELECT 1 FROM public.fluxo_aprovacao_etapas et2
        WHERE et2.config_id = v.config_id
          AND et2.ordem = v.etapa_atual_ordem
          AND et2.ativo = true
          AND (et2.responsavel_id = _user_id OR et2.responsavel_secundario_id = _user_id)
      )
    )
  ORDER BY v.atrasado DESC NULLS LAST, v.etapa_prazo_em ASC NULLS LAST, v.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_aprovacoes_pendentes_para(uuid) TO authenticated;