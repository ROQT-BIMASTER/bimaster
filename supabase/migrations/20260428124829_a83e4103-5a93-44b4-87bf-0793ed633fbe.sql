INSERT INTO public.telas_sistema (codigo, nome, rota, modulo_codigo, ordem, ativo, icone)
SELECT
  'projetos_aprovacoes_auditoria',
  'Auditoria de Aprovações',
  '/dashboard/projetos/aprovacoes/auditoria',
  ts.modulo_codigo,
  COALESCE((SELECT MAX(ordem) FROM public.telas_sistema WHERE modulo_codigo = ts.modulo_codigo), 0) + 1,
  true,
  'shield-check'
FROM public.telas_sistema ts
WHERE ts.codigo = 'projetos_aprovacoes_central'
LIMIT 1
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT r.role, ts.id
FROM public.telas_sistema ts
CROSS JOIN (VALUES ('gerente'::app_role), ('supervisor'::app_role)) AS r(role)
WHERE ts.codigo = 'projetos_aprovacoes_auditoria'
ON CONFLICT (role, tela_id) DO NOTHING;

-- Recria a RPC com nome correto da coluna (usuario_id) e sem campo "permitido".
CREATE OR REPLACE FUNCTION public.get_aprovacoes_audit_logs(
  p_limit  integer DEFAULT 100,
  p_offset integer DEFAULT 0,
  p_action text    DEFAULT NULL
)
RETURNS TABLE (
  id          uuid,
  user_id     uuid,
  user_nome   text,
  user_email  text,
  action      text,
  entity_type text,
  entity_id   uuid,
  old_data    jsonb,
  new_data    jsonb,
  metadata    jsonb,
  created_at  timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_allowed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'gerente'::app_role)
    OR public.has_role(v_uid, 'supervisor'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.usuario_permissoes_telas upt
      JOIN public.telas_sistema ts ON ts.id = upt.tela_id
      WHERE upt.usuario_id = v_uid
        AND ts.codigo IN ('projetos_aprovacoes_central', 'projetos_aprovacoes_auditoria')
    )
  INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Sem permissão para ver auditoria de Aprovações' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.user_id,
    p.nome  AS user_nome,
    p.email AS user_email,
    al.action,
    al.entity_type,
    al.entity_id,
    al.old_data,
    al.new_data,
    al.metadata,
    al.created_at
  FROM public.audit_logs al
  LEFT JOIN public.profiles p ON p.id = al.user_id
  WHERE (
    al.entity_type = 'inbox_scope'
    OR al.entity_type ILIKE 'projetos_aprovac%'
    OR al.entity_type ILIKE 'fluxo_aprovacao%'
    OR (al.metadata ->> 'modulo') = 'projetos_aprovacoes'
  )
  AND (p_action IS NULL OR al.action = p_action)
  ORDER BY al.created_at DESC
  LIMIT GREATEST(LEAST(p_limit, 500), 1)
  OFFSET GREATEST(p_offset, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_aprovacoes_audit_logs(integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_aprovacoes_audit_logs(integer, integer, text) TO authenticated;