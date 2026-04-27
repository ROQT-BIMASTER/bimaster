CREATE OR REPLACE FUNCTION public.listar_evidencias_etapa_perfil(
  p_etapa_id UUID
)
RETURNS TABLE (
  espelho_id UUID,
  instancia_id UUID,
  status TEXT,
  exige_documentos BOOLEAN,
  projeto_id UUID,
  projeto_nome TEXT,
  projeto_tarefa_id UUID,
  tarefa_titulo TEXT,
  tarefa_status TEXT,
  evidencia_documento_id UUID,
  evidencia_documento_label TEXT,
  evidencia_observacao TEXT,
  concluida_em TIMESTAMPTZ,
  concluida_por UUID,
  concluida_por_nome TEXT,
  entidade_tipo TEXT,
  entidade_id UUID
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
    t.status AS tarefa_status,
    e.evidencia_documento_id,
    COALESCE(d.label, d.tipo) AS evidencia_documento_label,
    e.evidencia_observacao,
    e.concluida_em,
    e.concluida_por,
    COALESCE(pr.nome, pr.email) AS concluida_por_nome,
    inst.entidade_tipo,
    inst.entidade_id
  FROM public.processo_tarefa_espelho e
  LEFT JOIN public.projetos p ON p.id = e.projeto_id
  LEFT JOIN public.projeto_tarefas t ON t.id = e.projeto_tarefa_id
  LEFT JOIN public.processo_etapa_documentos d ON d.id = e.evidencia_documento_id
  LEFT JOIN public.profiles pr ON pr.id = e.concluida_por
  LEFT JOIN public.processo_instancias inst ON inst.id = e.instancia_id
  WHERE e.etapa_id = p_etapa_id
  ORDER BY e.concluida_em DESC NULLS LAST, e.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.listar_evidencias_etapa_perfil(UUID) TO authenticated;