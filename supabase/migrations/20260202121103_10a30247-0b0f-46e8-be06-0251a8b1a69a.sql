-- 1. Criar a tela trade_admin
INSERT INTO telas_sistema (codigo, nome, descricao, modulo_codigo, rota, icone, ordem, ativo)
VALUES ('trade_admin', 'Administrativo Trade', 'Módulo administrativo do Trade Marketing', 'trade', '/dashboard/trade/admin', 'Settings', 0, true)
ON CONFLICT (codigo) DO NOTHING;

-- 2. Atribuir permissão exclusiva para Milene Harumi
INSERT INTO usuario_permissoes_telas (usuario_id, tela_id)
SELECT '7eb17733-d824-4758-8ddf-7b9606ef4991', id 
FROM telas_sistema 
WHERE codigo = 'trade_admin'
ON CONFLICT DO NOTHING;