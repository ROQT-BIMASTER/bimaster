# Liberar menu de Projetos para a equipe

## Diagnóstico

O submenu "Projetos" no `AppSidebar` já está implementado corretamente (`src/components/dashboard/AppSidebar.tsx`, linhas 1147–1177) com os itens:

- Caixa de Entrada
- Central de Trabalho
- Meus Projetos
- Modelos de Projeto
- Vincular China / Produtos Importados (admin)
- Minha Equipe / Relatórios (admin/supervisor)

A renderização desse bloco é gated por `hasModulePermission("projetos")`. Cada item de tela é gated por `ScreenProtectedRoute` (via `hasScreenPermission`).

Consultando o banco:

- O módulo `projetos` está cadastrado e ativo em `modulos_sistema`.
- As telas (`projetos_home`, `projetos_inbox`, `projetos_minhas_tarefas`, `projetos_dashboard`, `projetos_equipe`, `projetos_aprovacoes`, `projetos_vincular_china`, `projetos_produto_brasil`) existem e estão ativas em `telas_sistema`.
- **`role_permissoes_modulos` só tem `admin` para `projetos`.** Nenhum vínculo para `vendedor`, `supervisor`, `gerente`.
- **`role_permissoes_telas` está vazio para qualquer tela do módulo `projetos`.**

Consequência: para qualquer usuário não-admin (a "equipe"), `hasModulePermission('projetos')` retorna `false`, então o bloco inteiro do menu não é renderizado — exatamente o sintoma do print da Ingrid (perfil `vendedor`).

## O que será feito

Criar uma migration única que insere as permissões faltantes (idempotente, com `ON CONFLICT DO NOTHING`):

1. **Módulo `projetos`** liberado para os roles: `vendedor`, `supervisor`, `gerente` (admin já tem).
2. **Telas básicas** liberadas para `vendedor`, `supervisor`, `gerente`:
   - `projetos_home` (Central de Trabalho)
   - `projetos_inbox` (Caixa de Entrada — usado pelas rotas `/projetos/inbox` e pelo drawer)
   - `projetos_minhas_tarefas` (Meus Projetos / Minhas Tarefas)
   - `projetos_dashboard` (lista de projetos `/dashboard/projetos` e Modelos de Projeto)
3. **Telas administrativas/gerenciais** mantidas restritas:
   - `projetos_equipe`, `projetos_aprovacoes`, `projetos_vincular_china`, `projetos_produto_brasil` permanecem só para `admin` (e quando aplicável `supervisor`, conforme `canSeeProjetosRelatorios`).

A migration **não altera código frontend** — o sidebar e os guards já estão corretos. Apenas dados de permissão.

## Detalhes técnicos (migration SQL)

```sql
-- 1) Módulo projetos para equipe
INSERT INTO public.role_permissoes_modulos (role, modulo_id)
SELECT r::app_role, m.id
FROM unnest(ARRAY['vendedor','supervisor','gerente']) r
CROSS JOIN public.modulos_sistema m
WHERE m.codigo = 'projetos'
ON CONFLICT DO NOTHING;

-- 2) Telas básicas para equipe
INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT r::app_role, t.id
FROM unnest(ARRAY['vendedor','supervisor','gerente']) r
CROSS JOIN public.telas_sistema t
WHERE t.codigo IN (
  'projetos_home',
  'projetos_inbox',
  'projetos_minhas_tarefas',
  'projetos_dashboard'
)
ON CONFLICT DO NOTHING;

-- 3) Telas gerenciais extras para supervisor (Minha Equipe + Relatórios)
INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT 'supervisor'::app_role, t.id
FROM public.telas_sistema t
WHERE t.codigo IN ('projetos_equipe')
ON CONFLICT DO NOTHING;
```

Após a migration, o `PermissionsContext` recarrega permissões no próximo login (ou ao recarregar a sessão), e o submenu "Projetos" passará a aparecer para vendedores, supervisores e gerentes com os itens solicitados: **Central de Trabalho, Meus Projetos, Caixa de Entrada e Modelos de Projeto**.

## Validação

- Após aplicar, repetir as queries de checagem (`role_permissoes_modulos` / `role_permissoes_telas` para `projetos*`) e confirmar que retornam linhas para `vendedor`/`supervisor`/`gerente`.
- Pedir para a Ingrid recarregar o navegador e validar que o bloco "Projetos" aparece no sidebar com os 4 itens.
