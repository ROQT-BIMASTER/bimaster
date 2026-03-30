
CREATE OR REPLACE FUNCTION public.get_pendencias_por_submissao(p_ids uuid[])
RETURNS TABLE(submissao_id uuid, total int, pendentes int)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pb.submissao_china_id,
         count(*)::int,
         count(*) FILTER (WHERE NOT c.concluido)::int
  FROM produto_brasil_checklist c
  JOIN produtos_brasil pb ON pb.id = c.produto_brasil_id
  WHERE pb.submissao_china_id = ANY(p_ids)
  GROUP BY pb.submissao_china_id;
$$;
