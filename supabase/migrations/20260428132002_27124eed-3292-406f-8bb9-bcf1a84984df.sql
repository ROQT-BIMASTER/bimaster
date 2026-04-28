
DELETE FROM usuario_permissoes_modulos
WHERE usuario_id = '2f3df7bd-7db9-404a-8093-d80168ceab70'
  AND modulo_id IN (SELECT id FROM modulos_sistema WHERE codigo IN ('china','trade'));

DELETE FROM usuario_permissoes_telas
WHERE usuario_id = '2f3df7bd-7db9-404a-8093-d80168ceab70'
  AND tela_id IN (SELECT id FROM telas_sistema WHERE modulo_codigo IN ('china','trade'));
