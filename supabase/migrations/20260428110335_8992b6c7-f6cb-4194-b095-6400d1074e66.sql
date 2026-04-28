-- Concede permissão individual ao módulo "Projetos" para toda a equipe de Trade Marketing
-- Mantém os acessos atuais (módulo trade via departamento) e acrescenta Projetos
INSERT INTO public.usuario_permissoes_modulos (usuario_id, modulo_id)
SELECT p.id, 'a6aa92be-30a6-4027-aa0d-225b96cc96fe'::uuid
FROM public.profiles p
WHERE p.departamento_id = 'fc2c8fa9-b9b3-4aca-8994-8ced5f145f43'
  AND NOT EXISTS (
    SELECT 1 FROM public.usuario_permissoes_modulos upm
    WHERE upm.usuario_id = p.id
      AND upm.modulo_id = 'a6aa92be-30a6-4027-aa0d-225b96cc96fe'::uuid
  );