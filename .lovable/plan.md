

# Mover Botão "ERP Sync" para Menu de Administração

## Problema

O botão "ERP Sync" aparece diretamente na tela de Contas a Receber (visível na screenshot). Essa funcionalidade é administrativa e deve ficar apenas no menu de Administração.

## Alterações

### 1. Remover botão "ERP Sync" da página Contas a Receber (`src/pages/ContasAReceber.tsx`)
- Remover o bloco `{isAdmin && (<Button asChild ... ERP Sync ... </Button>)}` (linhas 833-839)

### 2. Adicionar links de Sync no menu Administração (`src/components/dashboard/AppSidebar.tsx`)
- No grupo "Governança Financeira", adicionar:
  - `MenuItemLink` para `/dashboard/financeiro/contas-a-pagar/sync` com título "Sync Contas a Pagar"
  - `MenuItemLink` para `/dashboard/financeiro/contas-a-receber/sync` com título "Sync Contas a Receber"

### 3. Proteger rotas de sync como admin (`src/App.tsx`)
- Alterar a rota `/dashboard/financeiro/contas-a-receber/sync` de `screenCode="financeiro_contas_receber"` para `screenCode="admin"`
- A rota `/dashboard/financeiro/contas-a-pagar/sync` já usa `screenCode="financeiro_contas_pagar"` — alterar para `screenCode="admin"`

## Arquivos

| Arquivo | Alteração |
|---|---|
| `src/pages/ContasAReceber.tsx` | Remover botão ERP Sync |
| `src/components/dashboard/AppSidebar.tsx` | Adicionar 2 links de sync no grupo Governança Financeira |
| `src/App.tsx` | Proteger rotas de sync com screenCode="admin" |

