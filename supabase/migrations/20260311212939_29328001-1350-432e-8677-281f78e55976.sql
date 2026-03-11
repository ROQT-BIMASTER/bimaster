-- Remover acesso ao módulo Projetos para todos os roles exceto admin
DELETE FROM public.role_permissoes_modulos 
WHERE modulo_id = 'a6aa92be-30a6-4027-aa0d-225b96cc96fe' 
AND role != 'admin';

-- Remover todas as permissões individuais de usuário para o módulo Projetos
DELETE FROM public.usuario_permissoes_modulos 
WHERE modulo_id = 'a6aa92be-30a6-4027-aa0d-225b96cc96fe';

-- Remover permissões de departamento para o módulo Projetos (se houver)
DELETE FROM public.departamento_permissoes_modulos 
WHERE modulo_id = 'a6aa92be-30a6-4027-aa0d-225b96cc96fe';