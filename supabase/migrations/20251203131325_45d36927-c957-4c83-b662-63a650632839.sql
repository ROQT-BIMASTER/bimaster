-- Adicionar permissão de configurações para supervisor
INSERT INTO role_permissoes_modulos (modulo_id, role)
SELECT id, 'supervisor' FROM modulos_sistema WHERE codigo = 'configuracoes'
ON CONFLICT DO NOTHING;