
-- 1. Create china module
INSERT INTO modulos_sistema (codigo, nome, descricao, icone, ordem, ativo)
VALUES ('china', 'Fábrica China', 'Gestão de submissões, ordens de compra e embarques da fábrica na China', 'Globe', 11, true);

-- 2. Give admin role permission via modulo_id
INSERT INTO role_permissoes_modulos (role, modulo_id)
SELECT 'admin', id FROM modulos_sistema WHERE codigo = 'china';
