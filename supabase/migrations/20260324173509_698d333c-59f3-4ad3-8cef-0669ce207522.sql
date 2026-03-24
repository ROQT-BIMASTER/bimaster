-- Create safe view that masks CPF and RG for non-admin users
CREATE OR REPLACE VIEW public.team_member_details_safe
WITH (security_invoker = on)
AS
SELECT
  id,
  user_id,
  nome_completo,
  CASE
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN cpf
    WHEN cpf IS NOT NULL THEN '***.' || RIGHT(cpf, 2)
    ELSE NULL
  END AS cpf,
  CASE
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN rg
    WHEN rg IS NOT NULL THEN '***' || RIGHT(rg, 2)
    ELSE NULL
  END AS rg,
  CASE
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN data_nascimento
    ELSE NULL
  END AS data_nascimento,
  email_pessoal,
  whatsapp,
  tamanho_camiseta,
  equipe_comercial,
  supervisor_nome,
  observacoes,
  created_at,
  updated_at,
  created_by
FROM public.team_member_details;