-- Create projetos module
INSERT INTO modulos_sistema (codigo, nome, descricao, icone, ativo)
VALUES ('projetos', 'Projetos', 'Módulo de Gestão de Projetos', 'FolderKanban', true)
ON CONFLICT DO NOTHING;

-- Grant projetos module to relevant roles
INSERT INTO role_permissoes_modulos (modulo_id, role)
SELECT id, 'gerente' FROM modulos_sistema WHERE codigo = 'projetos'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissoes_modulos (modulo_id, role)
SELECT id, 'supervisor' FROM modulos_sistema WHERE codigo = 'projetos'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissoes_modulos (modulo_id, role)
SELECT id, 'vendedor' FROM modulos_sistema WHERE codigo = 'projetos'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissoes_modulos (modulo_id, role)
SELECT id, 'promotor' FROM modulos_sistema WHERE codigo = 'projetos'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissoes_modulos (modulo_id, role)
SELECT id, 'admin' FROM modulos_sistema WHERE codigo = 'projetos'
ON CONFLICT DO NOTHING;