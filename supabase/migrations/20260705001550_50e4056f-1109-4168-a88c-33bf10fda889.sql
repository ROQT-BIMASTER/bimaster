
INSERT INTO public.sidebar_menu_items
  (module_code, item_code, label, icon, route, screen_code, parent_group, ordem, ativo)
VALUES
  ('cadastros','cad_fornecedores','Fornecedores','Truck','/dashboard/fornecedores','cadastros_fornecedores','Contas a Pagar',1,true),
  ('cadastros','cad_bancos','Contas Bancárias','Landmark','/dashboard/bancos','cadastros_bancos','Contas a Pagar',2,true),
  ('cadastros','cad_portadores','Portadores','CreditCard','/dashboard/portadores','cadastros_portadores','Contas a Pagar',3,true),
  ('cadastros','cad_centros_custo','Centros de Custo','Building2','/dashboard/centros-custo','cadastros_centros_custo','Contas a Pagar',4,true),
  ('cadastros','cad_plano_contas','Plano de Contas','ListTree','/dashboard/financeiro/plano-contas','cadastros_plano_contas','Contas a Pagar',5,true),
  ('cadastros','cad_empresas','Empresas','Building','/dashboard/empresas','cadastros_empresas','Auxiliares',6,true),
  ('cadastros','cad_departamentos','Departamentos','Users','/dashboard/departamentos','cadastros_departamentos','Auxiliares',7,true),
  ('cadastros','cad_clientes','Clientes','UserRound','/dashboard/clientes','cadastros_clientes','Auxiliares',8,true)
ON CONFLICT (module_code, item_code) DO NOTHING;

DELETE FROM public.role_permissoes_modulos
WHERE role IN ('supervisor','gerente','consultor','suporte')
  AND modulo_id = (SELECT id FROM public.modulos_sistema WHERE codigo='cadastros');

DELETE FROM public.role_permissoes_telas
WHERE role IN ('supervisor','gerente','consultor','suporte')
  AND tela_id IN (SELECT id FROM public.telas_sistema WHERE codigo LIKE 'cadastros_%');
