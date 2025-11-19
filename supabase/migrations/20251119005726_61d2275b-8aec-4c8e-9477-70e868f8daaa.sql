-- Adicionar coluna modulo_codigo à tabela telas_sistema
ALTER TABLE public.telas_sistema 
ADD COLUMN IF NOT EXISTS modulo_codigo varchar(50) REFERENCES public.modulos_sistema(codigo);

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_telas_sistema_modulo_codigo ON public.telas_sistema(modulo_codigo);

-- Inserir módulos do sistema se não existirem
INSERT INTO public.modulos_sistema (codigo, nome, descricao, icone, ordem, ativo)
VALUES 
  ('PROSPECTS', 'Prospecção', 'Módulo de gestão de prospects e pipeline de vendas', 'Users', 10, true),
  ('MARKETING', 'Marketing', 'Módulo de marketing digital e monitoramento de redes sociais', 'Megaphone', 20, true),
  ('TRADE', 'Trade Marketing', 'Módulo de trade marketing e gestão de PDV', 'Store', 30, true),
  ('RELATORIOS', 'Relatórios', 'Módulo de relatórios e análises', 'FileText', 40, true)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  icone = EXCLUDED.icone,
  ordem = EXCLUDED.ordem,
  ativo = EXCLUDED.ativo;

-- Inserir telas do sistema relacionadas aos módulos
INSERT INTO public.telas_sistema (codigo, nome, rota, descricao, icone, modulo_codigo, ordem, ativo)
VALUES 
  -- Módulo Prospects
  ('PROSPECTS_DASHBOARD', 'Dashboard de Prospecção', '/dashboard/prospects', 'Dashboard principal do módulo de prospecção', 'LayoutDashboard', 'PROSPECTS', 1, true),
  ('PROSPECTS_KANBAN', 'Kanban de Prospects', '/kanban', 'Quadro kanban de gestão de prospects', 'Columns', 'PROSPECTS', 2, true),
  ('PROSPECTS_MAPA', 'Mapa de Prospects', '/mapa', 'Visualização geográfica de prospects', 'Map', 'PROSPECTS', 3, true),
  ('PROSPECTS_LISTA', 'Lista de Prospects', '/prospects', 'Listagem completa de prospects', 'Users', 'PROSPECTS', 4, true),
  ('PROSPECTS_ATIVIDADES', 'Atividades', '/atividades', 'Gestão de atividades e follow-ups', 'Calendar', 'PROSPECTS', 5, true),
  ('PROSPECTS_MUNICIPIOS', 'Municípios', '/municipios', 'Gestão de municípios e territórios', 'MapPin', 'PROSPECTS', 6, true),
  
  -- Módulo Marketing
  ('MARKETING_DASHBOARD', 'Dashboard de Marketing', '/dashboard/marketing', 'Dashboard principal do módulo de marketing', 'LayoutDashboard', 'MARKETING', 1, true),
  ('MARKETING_SOCIAL', 'Redes Sociais', '/marketing', 'Monitoramento de redes sociais', 'Share2', 'MARKETING', 2, true),
  ('MARKETING_WHATSAPP', 'WhatsApp', '/whatsapp-monitoring', 'Monitoramento de WhatsApp', 'MessageCircle', 'MARKETING', 3, true),
  
  -- Módulo Trade Marketing
  ('TRADE_DASHBOARD', 'Dashboard de Trade', '/dashboard/trade', 'Dashboard principal do módulo de trade', 'LayoutDashboard', 'TRADE', 1, true),
  ('TRADE_LOJAS', 'Lojas', '/trade/stores', 'Gestão de lojas e PDV', 'Store', 'TRADE', 2, true),
  ('TRADE_VISITAS', 'Visitas', '/trade/visits', 'Gestão de visitas ao PDV', 'ClipboardCheck', 'TRADE', 3, true),
  ('TRADE_FOTOS', 'Fotos', '/trade/photos', 'Galeria de fotos do PDV', 'Camera', 'TRADE', 4, true),
  ('TRADE_AUDITORIAS', 'Auditorias', '/trade/auditorias', 'Auditorias de gôndola', 'Search', 'TRADE', 5, true),
  ('TRADE_PERFORMANCE', 'Performance', '/trade/performance', 'Análise de performance de vendas', 'TrendingUp', 'TRADE', 6, true),
  
  -- Módulo Relatórios
  ('RELATORIOS_DASHBOARD', 'Relatórios', '/relatorios', 'Dashboard de relatórios gerenciais', 'FileText', 'RELATORIOS', 1, true)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  rota = EXCLUDED.rota,
  descricao = EXCLUDED.descricao,
  icone = EXCLUDED.icone,
  modulo_codigo = EXCLUDED.modulo_codigo,
  ordem = EXCLUDED.ordem,
  ativo = EXCLUDED.ativo;

-- Adicionar foreign keys nas tabelas de permissões
ALTER TABLE public.role_permissoes_modulos
DROP CONSTRAINT IF EXISTS role_permissoes_modulos_modulo_id_fkey,
ADD CONSTRAINT role_permissoes_modulos_modulo_id_fkey 
  FOREIGN KEY (modulo_id) REFERENCES public.modulos_sistema(id) ON DELETE CASCADE;

ALTER TABLE public.role_permissoes_telas
DROP CONSTRAINT IF EXISTS role_permissoes_telas_tela_id_fkey,
ADD CONSTRAINT role_permissoes_telas_tela_id_fkey 
  FOREIGN KEY (tela_id) REFERENCES public.telas_sistema(id) ON DELETE CASCADE;

-- Garantir permissões padrão para administradores em todos os módulos
INSERT INTO public.role_permissoes_modulos (role, modulo_id)
SELECT 'admin'::app_role, id FROM public.modulos_sistema
WHERE ativo = true
ON CONFLICT (role, modulo_id) DO NOTHING;

-- Garantir permissões padrão para administradores em todas as telas
INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT 'admin'::app_role, id FROM public.telas_sistema
WHERE ativo = true
ON CONFLICT (role, tela_id) DO NOTHING;