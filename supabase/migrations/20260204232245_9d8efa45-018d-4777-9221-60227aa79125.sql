-- Criar módulo departamentos
INSERT INTO modulos_sistema (codigo, nome, descricao, icone, ordem, ativo)
VALUES ('departamentos', 'Gestão de Departamentos', 
        'Gestão de despesas, verbas e aprovações por departamento', 
        'Building2', 75, true);

-- Criar telas do módulo
INSERT INTO telas_sistema (codigo, nome, descricao, modulo_codigo, rota, icone, ordem, ativo)
VALUES 
  ('departamentos_hub', 'Hub de Departamentos', 'Lista de departamentos', 
   'departamentos', '/dashboard/departamentos', 'Building2', 10, true),
  ('departamentos_detail', 'Detalhes do Departamento', 'Visão geral e despesas', 
   'departamentos', '/dashboard/departamentos/:id', 'FileText', 20, true),
  ('departamentos_dashboard', 'Dashboard Financeiro', 'Métricas e gráficos', 
   'departamentos', '/dashboard/departamentos/:id/dashboard', 'BarChart3', 30, true),
  ('departamentos_aprovacoes', 'Central de Aprovações', 'Aprovação de despesas', 
   'departamentos', '/dashboard/departamentos/:id/aprovacoes', 'CheckCircle', 40, true);