-- Adicionar tela de permissão para Central de Aprovações de Departamentos no módulo Financeiro
INSERT INTO public.telas_sistema (codigo, nome, modulo_codigo, descricao, ativo, rota)
VALUES ('financeiro_aprovacoes_depts', 'Aprovações de Departamentos', 'financeiro', 'Central unificada de aprovações de despesas de departamentos', true, '/dashboard/departamentos/aprovacoes')
ON CONFLICT (codigo) DO NOTHING;