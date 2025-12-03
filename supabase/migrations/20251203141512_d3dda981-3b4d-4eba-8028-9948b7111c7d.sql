
-- Inserir telas que estavam sem controle de permissão
INSERT INTO public.telas_sistema (codigo, nome, descricao, rota, icone, ordem, ativo) 
VALUES 
  ('dashboard', 'Dashboard', 'Dashboard principal do sistema', '/dashboard', 'LayoutDashboard', 1, true),
  ('relatorios', 'Relatórios', 'Relatórios do sistema', '/dashboard/relatorios', 'FileText', 5, true),
  ('ai_analytics', 'Painel de IA', 'Analytics e insights de IA', '/dashboard/ai-analytics', 'Brain', 6, true),
  ('chat', 'Chat', 'Chat interno da equipe', '/dashboard/chat', 'MessageSquare', 7, true),
  ('tarefas', 'Tarefas', 'Gerenciamento de tarefas', '/dashboard/tarefas', 'CheckSquare', 8, true),
  ('instalar_app', 'Instalar App', 'Instalação do PWA', '/dashboard/instalar-app', 'Download', 10, true)
ON CONFLICT (codigo) DO UPDATE SET 
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  rota = EXCLUDED.rota,
  icone = EXCLUDED.icone;

-- Dar acesso a todas as telas básicas para todos os roles (exceto cliente)
INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT r.role, t.id
FROM (
  SELECT unnest(ARRAY['admin', 'supervisor', 'vendedor', 'promotor']::app_role[]) as role
) r
CROSS JOIN public.telas_sistema t
WHERE t.codigo IN ('dashboard', 'relatorios', 'ai_analytics', 'chat', 'tarefas', 'instalar_app')
  AND t.ativo = true
ON CONFLICT DO NOTHING;
