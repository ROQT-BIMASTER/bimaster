

# Auditoria de Permissões — Correção de Rotas Desprotegidas

## Vulnerabilidades Encontradas

Analisei todas as 150+ rotas do `App.tsx` e encontrei **rotas com proteção incompleta** — faltando guard de módulo ou de tela, permitindo acesso lateral.

### Categoria 1: Rotas de Fábrica sem guard de módulo (CRÍTICO)
Linhas 501-521 — **20 rotas** usam `ScreenRoute` (auth + tela) mas **NÃO** verificam `moduleCode="fabrica"`. Um usuário com permissão de tela mas sem o módulo fábrica poderia acessar.

Rotas afetadas:
- `/dashboard/fabrica/recebimentos`, `/fabrica/materias-primas`, `/fabrica/formulas`, `/fabrica/planejamento`, `/fabrica/fiscal`, `/fabrica/ordens-producao`, `/fabrica/apontamentos`, `/fabrica/qualidade`, `/fabrica/paradas`, `/fabrica/maquinas`, `/fabrica/operadores`, `/fabrica/produtos-acabados`, `/fabrica/revisao-fichas`, `/fabrica/comunicacao-revisoes`, `/fabrica/executivo`, `/fabrica/fornecedores` e sub-rotas

### Categoria 2: Rotas Financeiro sem guard de módulo (CRÍTICO)
Linhas 601-624 — **~25 rotas** usam `ScreenRoute` sem `ModuleRoute moduleCode="financeiro"`. Mesma vulnerabilidade.

Rotas afetadas: todas as sub-rotas de `/dashboard/financeiro/*` exceto a rota index (linha 597) e trade (600).

### Categoria 3: Rotas de Preços sem guard de módulo (MÉDIO)
Linhas 557-562 — 5 rotas usam `ScreenRoute` sem `ModuleRoute moduleCode="precos"`.

### Categoria 4: Comercial lançamentos sem guard de módulo (MÉDIO)
Linha 546 — `/dashboard/comercial/lancamentos` usa `ScreenRoute` sem `ModuleRoute`.

### Categoria 5: Trade Formulários sem proteção granular (ALTO)
Linhas 702-704 — 3 rotas usam apenas `ProtectedRoute` (autenticação pura). **Qualquer usuário autenticado** pode acessar:
- `/dashboard/trade/formularios/builder`
- `/dashboard/trade/formularios/admin`
- `/dashboard/trade/formularios/dashboard`

### Categoria 6: Financeiro plano-reducao sem guard de tela (BAIXO)
Linha 623 — usa `ModuleRoute` mas não tem `ScreenProtectedRoute`.

## Plano de Correção

### Alteração única: `src/App.tsx`

**1. Fábrica** — Envolver todas as ~20 rotas ScreenRoute com `ModuleRoute moduleCode="fabrica"`:
```tsx
// ANTES:
<ScreenRoute screenCode="fabrica_recebimentos">...</ScreenRoute>
// DEPOIS:
<ModuleRoute moduleCode="fabrica"><ScreenProtectedRoute screenCode="fabrica_recebimentos">...</ScreenProtectedRoute></ModuleRoute>
```

**2. Financeiro** — Envolver todas as ~25 rotas ScreenRoute com `ModuleRoute moduleCode="financeiro"` (exceto as admin-only como sync/exportacao que mantêm `screenCode="admin"`):
```tsx
// ANTES:
<ScreenRoute screenCode="financeiro_contas_pagar">...</ScreenRoute>
// DEPOIS:  
<ModuleRoute moduleCode="financeiro"><ScreenProtectedRoute screenCode="financeiro_contas_pagar">...</ScreenProtectedRoute></ModuleRoute>
```

**3. Preços** — Envolver 5 rotas com `ModuleRoute moduleCode="precos"`.

**4. Comercial lançamentos** — Adicionar `ModuleRoute moduleCode="comercial"`.

**5. Trade formulários** — Alterar de `ProtectedRoute` para `ModuleRoute moduleCode="trade"` + `ScreenProtectedRoute screenCode="trade_admin"`.

**6. Plano redução** — Adicionar `ScreenProtectedRoute screenCode="financeiro_plano_reducao"` (ou reusar `financeiro_dre`).

## Arquivos

| Arquivo | Alteração |
|---|---|
| `src/App.tsx` | Corrigir ~55 rotas com guard de módulo faltante + 3 rotas trade sem proteção granular |

## Impacto

- Zero mudança visual para usuários com permissões corretas
- Bloqueia acesso lateral via URL direta para usuários sem módulo autorizado
- Defesa em profundidade: auth + módulo + tela em **todas** as rotas protegidas

