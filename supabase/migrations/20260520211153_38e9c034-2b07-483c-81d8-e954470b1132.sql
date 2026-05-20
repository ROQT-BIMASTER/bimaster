INSERT INTO public.telas_sistema (codigo, nome, descricao, icone, rota, ativo, ordem)
VALUES ('briefings_agente', 'Briefings', 'Agente de IA para criação e gestão de briefings', 'Sparkles', '/dashboard/briefings', true, 7)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  icone = EXCLUDED.icone,
  rota = EXCLUDED.rota,
  ativo = true;