-- Restringir acessos de Nathalia Oliveira e Daniella Mello apenas a:
-- Central de Trabalho, Meus Projetos, Modelos de Projeto, Minha Equipe, Relatórios.
-- Modelos de Projeto não tem código em telas_sistema (controle via sidebar).

DELETE FROM public.usuario_permissoes_telas
WHERE usuario_id IN (
  'f8b9a84e-67d2-449a-bc5a-3d15a9dfd379',
  '4e3c3625-91cb-4987-bc22-010f72cd151c'
)
AND tela_id IN (
  SELECT id FROM public.telas_sistema
  WHERE codigo IN (
    'marketing_social',
    'MARKETING_SOCIAL',
    'projetos_aprovacoes',
    'projetos_aprovacoes_central',
    'projetos_aprovacoes_auditoria',
    'projetos_inbox'
  )
);

-- Garantir as 5 telas necessárias (projetos_home, projetos_dashboard, projetos_equipe)
INSERT INTO public.usuario_permissoes_telas (usuario_id, tela_id)
SELECT u.usuario_id, t.id
FROM (
  VALUES
    ('f8b9a84e-67d2-449a-bc5a-3d15a9dfd379'::uuid),
    ('4e3c3625-91cb-4987-bc22-010f72cd151c'::uuid)
) AS u(usuario_id)
CROSS JOIN public.telas_sistema t
WHERE t.codigo IN ('projetos_home','projetos_dashboard','projetos_equipe')
ON CONFLICT (usuario_id, tela_id) DO NOTHING;

-- Remover módulo marketing dessas usuárias (se tiver sido concedido)
DELETE FROM public.usuario_permissoes_modulos
WHERE usuario_id IN (
  'f8b9a84e-67d2-449a-bc5a-3d15a9dfd379',
  '4e3c3625-91cb-4987-bc22-010f72cd151c'
)
AND modulo_id IN (SELECT id FROM public.modulos_sistema WHERE codigo = 'marketing');