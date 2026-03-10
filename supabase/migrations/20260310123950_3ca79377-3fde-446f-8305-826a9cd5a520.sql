-- Habilitar módulo projetos para todos os roles
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