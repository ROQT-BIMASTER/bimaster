## Objetivo

Eliminar o lag de 0.5–2s ao clicar em um módulo pela primeira vez, baixando os chunks **em background** logo após o login, somente para os módulos que o usuário tem permissão. Sem alterar rotas, guards, lazy loading ou config de build.

## Verificações já feitas no repo

| Premissa do prompt | Estado real | Ajuste necessário |
|---|---|---|
| `PermissionsContext` expõe permissões | Sim, mas a propriedade é **`modules: string[]`** — não `accessibleModules` | Usar `modules` direto (não criar alias novo no contexto, evita risco) |
| Sidebar com NavLinks | É `src/components/dashboard/AppSidebar.tsx` (não `layout/Sidebar*`) | Adaptar Bloco 4 para esse arquivo |
| Páginas referenciadas no `MODULE_LOADERS` | Todas as 12 verificadas existem em `src/pages/` | OK |
| `lazyWithRetry`, `ModuleProtectedRoute`, `vite.config` | Não tocar | OK |
| `requestIdleCallback` fallback | Plano correto (Safari não suporta) | OK |

## Mudanças

### 1. `src/hooks/useModulePreloader.ts` (novo)

- Mapa `MODULE_LOADERS: Record<string, () => Promise<unknown>>` exportado.
- Hook usa `usePermissions().modules` (não `accessibleModules`) e `useAuth().session`.
- Dispara via `requestIdleCallback` (fallback `setTimeout(200)`).
- `Set` interno garante idempotência por sessão.
- Falhas silenciosas via `logger.warn` — `lazyWithRetry` cobre o caso real.

Codes inicialmente mapeados (todos verificados existirem):
`financeiro`, `contas_pagar`, `contas_receber`, `fluxo_caixa`, `conciliacao`, `trade`, `marketing`, `influencers`, `fabrica`, `fabrica_tabelas_preco`, `composicao`, `embalagens`, `amostras`, `china`, `china_ordens`, `china_torre`, `comercial`, `prospects`, `comercial_mapa`, `projetos`, `central_trabalho`, `central_aprovacoes`.

Codes desconhecidos são silenciosamente ignorados (sem erro).

### 2. `src/components/performance/ModulePreloader.tsx` (novo)

Componente headless: chama o hook e retorna `null`.

### 3. `src/App.tsx` (1 linha)

Adicionar `<ModulePreloader />` dentro da árvore, após `PermissionsProvider`. Nada mais é tocado.

### 4. `src/components/dashboard/AppSidebar.tsx` (hover prefetch)

Após ler o arquivo, adicionar `onMouseEnter`/`onFocus` em cada link de módulo chamando um helper local:

```ts
import { MODULE_LOADERS } from "@/hooks/useModulePreloader";
const prefetch = (code: string) => { (MODULE_LOADERS as any)[code]?.().catch(() => {}); };
```

Sem mudar estilos, ordem ou estrutura — apenas dois handlers por link.

## Não-objetivos

- Não criar `accessibleModules` no `PermissionsContext` (já temos `modules`; introduzir alias é mudança desnecessária no contrato do contexto).
- Não pré-carregar módulos sem permissão.
- Não tocar em `vite.config.ts`, `App.tsx` (além da 1 linha), `ModuleProtectedRoute`, `lazyWithRetry`, ou Suspense fallbacks.
- Não fazer Phase B/C/D (refactor de pastas, wrappers em `lazy()`, virtualização).

## Validação

1. Build do harness deve passar sem novos warnings de chunk size.
2. Lint sem novos erros.
3. `bunx vitest run` verde.
4. Smoke RLS: `bash scripts/security/e2e-authenticated-sensitive-columns.sh`.
5. Manual em preview: DevTools Network → após login com usuário que tem acesso a 3 módulos, ver 3 chunks baixados em background ~200ms depois.

## Risco e rollback

**Risco:** baixo. Código 100% aditivo. Pior caso = preload silenciosamente não dispara, UX fica idêntica à atual.

**Rollback** (sem migration):
1. Remover `<ModulePreloader />` de `App.tsx`.
2. Remover handlers `onMouseEnter`/`onFocus` no `AppSidebar.tsx`.
3. Opcional: deletar os 2 arquivos novos.

## Entregáveis

- 2 arquivos novos: `useModulePreloader.ts`, `ModulePreloader.tsx`
- 2 arquivos editados (mínimo): `App.tsx` (+3 linhas: import + componente), `AppSidebar.tsx` (handlers em N links)
- Confirmação no resumo final de quais module codes foram efetivamente mapeados.