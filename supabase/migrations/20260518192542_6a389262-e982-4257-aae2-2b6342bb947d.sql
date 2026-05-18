INSERT INTO public.ui_permissions (role, tela_codigo, componente_codigo, visivel, editavel)
VALUES
  ('gerente', 'trade_admin', 'page', true, true),
  ('supervisor', 'trade_admin', 'page', true, true)
ON CONFLICT DO NOTHING;