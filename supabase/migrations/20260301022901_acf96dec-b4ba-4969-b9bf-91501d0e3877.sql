
-- Create department "Compras e Faturamento"
INSERT INTO public.departamentos (id, nome, descricao, ativo)
VALUES (
  gen_random_uuid(),
  'Compras e Faturamento',
  'Departamento responsável por compras de insumos e faturamento',
  true
);

-- Link module permission: fabrica
INSERT INTO public.departamento_permissoes_modulos (departamento_id, modulo_id)
SELECT d.id, m.id
FROM public.departamentos d, public.modulos_sistema m
WHERE d.nome = 'Compras e Faturamento' AND m.codigo = 'fabrica';

-- Link screen permission: fabrica_mps
INSERT INTO public.departamento_permissoes_telas (departamento_id, tela_id)
SELECT d.id, t.id
FROM public.departamentos d, public.telas_sistema t
WHERE d.nome = 'Compras e Faturamento' AND t.codigo = 'fabrica_mps';
