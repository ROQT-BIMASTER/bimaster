
-- 1.1 Registro da tela
INSERT INTO public.telas_sistema (codigo, nome, descricao, rota, modulo_codigo, icone, ativo, ordem, acesso_padrao)
VALUES ('financeiro_torre_despesas',
        'Torre de Despesas',
        'Torre de Controle de Despesas — variação por departamento (MoM/YoY), drill até o título, e fila de alertas de risco/fraude com trilha de auditoria.',
        '/dashboard/financeiro/torre-despesas',
        'financeiro', 'TowerControl', true, 12, false)
ON CONFLICT (codigo) DO UPDATE
  SET nome = EXCLUDED.nome,
      descricao = EXCLUDED.descricao,
      rota = EXCLUDED.rota,
      modulo_codigo = EXCLUDED.modulo_codigo,
      icone = EXCLUDED.icone,
      ativo = true,
      ordem = EXCLUDED.ordem;

-- 1.2a admin sempre
WITH t AS (SELECT id FROM public.telas_sistema WHERE codigo = 'financeiro_torre_despesas')
INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT 'admin'::app_role, t.id FROM t
ON CONFLICT (role, tela_id) DO NOTHING;

-- 1.2b papéis com módulo financeiro
WITH t AS (SELECT id FROM public.telas_sistema WHERE codigo = 'financeiro_torre_despesas')
INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT rpm.role, t.id
FROM public.role_permissoes_modulos rpm
JOIN public.modulos_sistema ms ON ms.id = rpm.modulo_id AND ms.codigo = 'financeiro'
CROSS JOIN t
ON CONFLICT (role, tela_id) DO NOTHING;

-- 1.2c usuários com módulo financeiro
WITH t AS (SELECT id FROM public.telas_sistema WHERE codigo = 'financeiro_torre_despesas')
INSERT INTO public.usuario_permissoes_telas (usuario_id, tela_id)
SELECT DISTINCT upm.usuario_id, t.id
FROM public.usuario_permissoes_modulos upm
JOIN public.modulos_sistema ms ON ms.id = upm.modulo_id AND ms.codigo = 'financeiro'
CROSS JOIN t
WHERE NOT EXISTS (
  SELECT 1 FROM public.usuario_permissoes_telas x
  WHERE x.usuario_id = upm.usuario_id AND x.tela_id = t.id
);

-- 1.2d departamentos com módulo financeiro
WITH t AS (SELECT id FROM public.telas_sistema WHERE codigo = 'financeiro_torre_despesas')
INSERT INTO public.departamento_permissoes_telas (departamento_id, tela_id)
SELECT DISTINCT dpm.departamento_id, t.id
FROM public.departamento_permissoes_modulos dpm
JOIN public.modulos_sistema ms ON ms.id = dpm.modulo_id AND ms.codigo = 'financeiro'
CROSS JOIN t
WHERE NOT EXISTS (
  SELECT 1 FROM public.departamento_permissoes_telas x
  WHERE x.departamento_id = dpm.departamento_id AND x.tela_id = t.id
);
