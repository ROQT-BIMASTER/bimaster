
INSERT INTO telas_sistema (codigo, nome, descricao, modulo_codigo, rota, icone, ativo, ordem)
VALUES
  ('financeiro_saldos_bancarios', 'Saldos Bancários', 'Visualização de saldos bancários consolidados', 'financeiro', '/dashboard/financeiro/saldos-bancarios', 'Landmark', true, 70),
  ('financeiro_consolidado', 'Consolidado Financeiro', 'Dashboard consolidado financeiro', 'financeiro', '/dashboard/financeiro/consolidado', 'BarChart3', true, 80),
  ('financeiro_conciliacao', 'Conciliação Bancária', 'Conciliação de extratos bancários', 'financeiro', '/dashboard/financeiro/conciliacao-bancaria', 'ArrowLeftRight', true, 90),
  ('financeiro_investimentos', 'Investimentos', 'Gestão de investimentos corporativos', 'financeiro', '/dashboard/financeiro/investimentos', 'TrendingUp', true, 100)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO ui_permissions (role, departamento_id, tela_codigo, componente_codigo, visivel, editavel)
SELECT 'admin', NULL, codigo, '*', true, true
FROM telas_sistema WHERE codigo IN ('financeiro_saldos_bancarios', 'financeiro_consolidado', 'financeiro_conciliacao', 'financeiro_investimentos')
ON CONFLICT DO NOTHING;

INSERT INTO ui_permissions (role, departamento_id, tela_codigo, componente_codigo, visivel, editavel)
SELECT 'supervisor', NULL, codigo, '*', true, true
FROM telas_sistema WHERE codigo IN ('financeiro_saldos_bancarios', 'financeiro_consolidado', 'financeiro_conciliacao', 'financeiro_investimentos')
ON CONFLICT DO NOTHING;

INSERT INTO ui_permissions (role, departamento_id, tela_codigo, componente_codigo, visivel, editavel)
SELECT 'gerente', NULL, codigo, '*', true, false
FROM telas_sistema WHERE codigo IN ('financeiro_saldos_bancarios', 'financeiro_consolidado', 'financeiro_conciliacao', 'financeiro_investimentos')
ON CONFLICT DO NOTHING;
