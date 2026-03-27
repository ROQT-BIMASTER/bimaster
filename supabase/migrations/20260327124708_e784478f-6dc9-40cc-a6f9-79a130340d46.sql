
-- Grant c.nakano (Claudia) access to China and Projetos modules
-- China module
INSERT INTO usuario_permissoes_modulos (usuario_id, modulo_id) VALUES
  ('8503e184-3c98-4cb8-9cf0-e32ae6bc0096', '9edc8260-b080-4432-b055-8747b24c4520'),  -- China
  ('8503e184-3c98-4cb8-9cf0-e32ae6bc0096', 'a6aa92be-30a6-4027-aa0d-225b96cc96fe')   -- Projetos
ON CONFLICT DO NOTHING;

-- China telas for c.nakano
INSERT INTO usuario_permissoes_telas (usuario_id, tela_id) VALUES
  ('8503e184-3c98-4cb8-9cf0-e32ae6bc0096', '08db28b7-e570-4011-813a-e24c1306aea5'),  -- Dashboard China
  ('8503e184-3c98-4cb8-9cf0-e32ae6bc0096', 'a87ec890-6d30-4515-bbf4-8a69e6cd775a'),  -- Submissões
  ('8503e184-3c98-4cb8-9cf0-e32ae6bc0096', '53eaf303-bce6-4995-a2e5-441cbff56751'),  -- Recebimentos
  ('8503e184-3c98-4cb8-9cf0-e32ae6bc0096', '820e1140-ac2a-4ef1-8eff-30a86069c837'),  -- Ordens
  ('8503e184-3c98-4cb8-9cf0-e32ae6bc0096', '935be78e-2724-40a2-8f46-b44572ed1f5f'),  -- Fichas
  ('8503e184-3c98-4cb8-9cf0-e32ae6bc0096', '1f6f8889-ffb2-44cb-8ff1-3770ce937fa6'),  -- Vincular China
  -- Projeto telas
  ('8503e184-3c98-4cb8-9cf0-e32ae6bc0096', 'f4e5d7b7-1a39-4594-ae5a-46a8711d3d10'),  -- Dashboard Projetos
  ('8503e184-3c98-4cb8-9cf0-e32ae6bc0096', 'a7060b9c-ea88-4f4f-9cce-6e551ee63920'),  -- Inbox
  ('8503e184-3c98-4cb8-9cf0-e32ae6bc0096', 'a92909f6-e6ac-4ac6-a9eb-8a5a42e4f34c'),  -- Aprovações
  ('8503e184-3c98-4cb8-9cf0-e32ae6bc0096', 'fe5b6dd0-162f-4eb3-87ab-1099b51ede09')   -- Produtos Brasil
ON CONFLICT DO NOTHING;

-- Grant Luana access to Projetos module (she already has China)
INSERT INTO usuario_permissoes_modulos (usuario_id, modulo_id) VALUES
  ('2f3df7bd-7db9-404a-8093-d80168ceab70', 'a6aa92be-30a6-4027-aa0d-225b96cc96fe')   -- Projetos
ON CONFLICT DO NOTHING;

-- Projeto telas for Luana
INSERT INTO usuario_permissoes_telas (usuario_id, tela_id) VALUES
  ('2f3df7bd-7db9-404a-8093-d80168ceab70', 'f4e5d7b7-1a39-4594-ae5a-46a8711d3d10'),  -- Dashboard Projetos
  ('2f3df7bd-7db9-404a-8093-d80168ceab70', 'a7060b9c-ea88-4f4f-9cce-6e551ee63920'),  -- Inbox
  ('2f3df7bd-7db9-404a-8093-d80168ceab70', 'a92909f6-e6ac-4ac6-a9eb-8a5a42e4f34c'),  -- Aprovações
  ('2f3df7bd-7db9-404a-8093-d80168ceab70', 'fe5b6dd0-162f-4eb3-87ab-1099b51ede09')   -- Produtos Brasil
ON CONFLICT DO NOTHING;

-- Ensure Trade Marketing is blocked: remove any existing permissions for these users
DELETE FROM usuario_permissoes_modulos 
WHERE usuario_id IN ('8503e184-3c98-4cb8-9cf0-e32ae6bc0096', '2f3df7bd-7db9-404a-8093-d80168ceab70')
  AND modulo_id = 'd33394b9-fc47-4e28-befc-f46025269187';  -- Trade Marketing
