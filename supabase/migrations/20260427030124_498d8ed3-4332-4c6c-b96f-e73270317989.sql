DROP FUNCTION IF EXISTS public.listar_evidencias_etapa_perfil(uuid);

CREATE OR REPLACE FUNCTION public.listar_evidencias_etapa_perfil(p_etapa_id uuid)
RETURNS TABLE (
  espelho_id uuid,
  instancia_id uuid,
  status text,
  exige_documentos boolean,
  projeto_id uuid,
  projeto_nome text,
  projeto_tarefa_id uuid,
  tarefa_titulo text,
  tarefa_status text,
  evidencia_documento_id uuid,
  evidencia_documento_label text,
  evidencia_observacao text,
  concluida_em timestamptz,
  concluida_por uuid,
  concluida_por_nome text,
  responsavel_id uuid,
  responsavel_nome text,
  entidade_tipo text,
  entidade_id uuid,
  acao_solicitada_em timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id AS espelho_id,
    e.instancia_id,
    e.status,
    e.exige_documentos,
    e.projeto_id,
    p.nome AS projeto_nome,
    e.projeto_tarefa_id,
    t.titulo AS tarefa_titulo,
    t.status::text AS tarefa_status,
    e.evidencia_documento_id,
    COALESCE(d.label, d.tipo) AS evidencia_documento_label,
    e.evidencia_observacao,
    e.concluida_em,
    e.concluida_por,
    COALESCE(pc.nome, pc.email) AS concluida_por_nome,
    t.responsavel_id,
    COALESCE(pr.nome, pr.email) AS responsavel_nome,
    i.entidade_tipo::text,
    i.entidade_id,
    e.acao_solicitada_em
  FROM public.processo_tarefa_espelho e
  LEFT JOIN public.projetos p ON p.id = e.projeto_id
  LEFT JOIN public.projeto_tarefas t ON t.id = e.projeto_tarefa_id
  LEFT JOIN public.processo_etapa_documentos d ON d.id = e.evidencia_documento_id
  LEFT JOIN public.profiles pc ON pc.id = e.concluida_por
  LEFT JOIN public.profiles pr ON pr.id = t.responsavel_id
  LEFT JOIN public.processo_instancias i ON i.id = e.instancia_id
  WHERE e.etapa_id = p_etapa_id
  ORDER BY e.created_at DESC;
$$;