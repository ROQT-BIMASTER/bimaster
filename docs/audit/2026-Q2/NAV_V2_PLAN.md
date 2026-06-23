# PR-Nav-0 — Scaffold inerte da nova navegação

Status: **entregue (inerte)** — 23/06/2026
Branch sugerida: `nav/pr-0-scaffold`

## Resumo

Fundação aditiva para a refatoração visual da navegação (rail 68px +
sidebar contextual + launcher ⌘K). Nenhum arquivo existente foi
alterado e nenhum código de produção importa os novos arquivos —
ficam fora do bundle até a Fase 1.

## Arquivos entregues (4 novos, 0 deleções, 0 edições)

| Arquivo | Papel |
|---|---|
| `src/config/navigation/types.ts` | Tipos `NavCategory` / `NavModule` / `NavPage` / `NavVersion` / `NavTree`. |
| `src/config/navigation/sidebarConfig.ts` | Função pura `buildNavTree()` que combina `sidebar_categories` + `sidebar_category_modules` + `module-screens-map`. Zero hooks, testável. |
| `src/lib/featureFlags/navigationVersion.ts` | `getNavVersion()` + `useNavVersion()`. Fallback `'v1'` em qualquer erro. |
| `docs/audit/2026-Q2/migrations-pendentes/nav_version_preference.sql` | Migration entregue como artefato versionado, **não aplicada** neste PR. Aditiva, idempotente, default `'v1'`, `CHECK (nav_version IN ('v1','v2'))`. |

## Garantias de não-quebra

- Nenhum arquivo existente modificado.
- Nenhum import dos novos arquivos no `src/` (verificável por `rg "navigationVersion|config/navigation"`).
- Migration **não aplicada**: entregue em `docs/audit/2026-Q2/migrations-pendentes/`.
  Equipe decide janela de deploy via o fluxo controlado de migrations.
- Default `'v1'` preserva o menu atual mesmo após a migration aplicada.
- Nenhuma policy RLS, role ou lógica de autorização tocada.

## Telas de referência (contrato visual da Fase 1)

Três estados do rail (`docs/audit/2026-Q2/NAV_V2_PLAN.md`):

```text
A) Compacto puro (68px)
   - logo 38px, ícones 44px, dividers entre Fixados/Outros
   - badge sync OK (verde) no canto inferior do ícone do módulo
   - sino sticky no topo, grid-launcher sticky no bottom

B) Hover 500ms → tooltip rica
   - nome do módulo + nº de páginas, "você está aqui" se módulo ativo,
     última página visitada, atalho de teclado (⌘E p/ Estoque),
     indicador de "Fixado" com pin

C) Click / hover longo → popover lateral (NÃO expande o rail)
   - submenu completo do módulo, botão de pin no header
   - item destacado (barra primary + fundo), some ao mover cursor pra fora
```

Launcher ⌘K (1080×680), claro e escuro:

```text
- Search "Para onde você quer ir?", chips ⌘K / ESC
- Coluna esquerda: Acesso Rápido → Recentes (5 últimas)
- Coluna direita: Recentes (chip "AQUI" na página atual) + grid de módulos
  agrupado por categoria (ícone + descrição + "N páginas")
- Item com "AQUI" marcado quando há módulo ativo
- Permissões intactas: itens ADMIN com pílula âmbar + cadeado para quem
  tem acesso; invisível para os demais
```

## Pré-merge (checklist do time)

- [ ] `bun run lint` verde
- [ ] `bunx vitest run` verde
- [ ] `typecheck` + `build` verdes no CI
- [ ] `rg "config/navigation|featureFlags/navigationVersion" src` retorna **0** matches
- [ ] Revisão de 1 dev (mudança trivial e aditiva)
- [ ] Decidir janela para aplicar `migrations-pendentes/nav_version_preference.sql`

## Roadmap pós-merge

| Fase | Conteúdo | Risco | Rollback |
|---|---|---|---|
| **1** | Implementar `AppRail`, `ContextualSidebar`, `Launcher` (⌘K), `SidebarSwitch` em `DashboardLayout`. v1 e v2 coexistem; default `'v1'`. Testes de matriz de permissão (v2 ≡ v1 por role). | Baixo (opt-in) | Remover `<SidebarSwitch/>` ou flipar default. |
| **2** | Toggle visível para admins em `/admin/preferencias-ui`. | Baixo | Esconder toggle. |
| **3** | Beta opt-in (usuários selecionados via `nav_version='v2'`). | Baixo | `UPDATE user_ui_preferences SET nav_version='v1'`. |
| **4** | Soft default `'v2'` para novos usuários. | Médio | Reverter default da coluna. |
| **5** | Default geral `'v2'`; banner "voltar para clássico" por 30 dias. | Médio | Banner já permite escolha. |
| **6** | Remover código v1, `SidebarSwitch`, coluna `nav_version`. | Baixo | — |

Rollback ≤ 5 min em qualquer fase.

## Fora de escopo desta PR

- Componentes visuais (rail, sidebar contextual, launcher, tooltips, popovers).
- Alterações em `DashboardLayout`, `AppSidebar`, `useSidebarConfig`.
- Telemetria de navegação, atalhos de teclado, sino sticky, ERP status dot.
- Documentação completa do design system v2 (vai junto da Fase 1).
