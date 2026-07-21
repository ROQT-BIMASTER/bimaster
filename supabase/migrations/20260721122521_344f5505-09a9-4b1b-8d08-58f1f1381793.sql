
INSERT INTO modulos_sistema (codigo, nome, descricao, ordem, ativo)
VALUES ('suporte', 'Suporte', 'Central de suporte / help desk', 100, true)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO telas_sistema (codigo, nome, modulo_codigo, rota, ordem, ativo) VALUES
  ('controladoria', 'Controladoria de Produtos', 'geral', '/dashboard/controladoria', 100, true),
  ('aprovacoes', 'Central de Aprovações (Chat)', 'geral', '/dashboard/chat/aprovacoes', 100, true),
  ('suporte_meus_chamados', 'Suporte - Meus Chamados', 'suporte', '/dashboard/suporte', 10, true),
  ('suporte_desk', 'Suporte - Desk', 'suporte', '/dashboard/suporte/desk', 20, true),
  ('suporte_admin_sla', 'Suporte - Admin SLA', 'suporte', '/dashboard/suporte/admin/sla', 30, true),
  ('suporte_rotinas_fixas', 'Suporte - Rotinas Fixas', 'suporte', '/dashboard/suporte/rotinas-fixas', 40, true),
  ('suporte_processos', 'Suporte - Processos', 'suporte', '/dashboard/suporte/processos', 50, true),
  ('projetos_convites', 'Projetos - Convites', 'projetos', '/dashboard/projetos/convites', 100, true),
  ('processos_perfis', 'Processos - Perfis', 'processos', '/dashboard/processos/perfis', 40, true),
  ('processos_etapas_gerenciamento', 'Processos - Gerenciamento de Etapas', 'processos', '/dashboard/processos/etapas-gerenciamento', 50, true),
  ('processos_modulos_catalogo', 'Processos - Catálogo de Módulos', 'processos', '/dashboard/processos/modulos-catalogo', 60, true)
ON CONFLICT (codigo) DO NOTHING;
