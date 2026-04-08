
INSERT INTO public.telas_sistema (codigo, nome, descricao, modulo_codigo, rota, icone, ordem, ativo)
VALUES (
  'integracao_erp',
  'Portal ERP (Huggs)',
  'Portal de Integração ERP com acesso dedicado',
  'integracao_erp',
  '/dashboard/integracao-erp',
  'key',
  1,
  true
)
ON CONFLICT (codigo) DO NOTHING;
