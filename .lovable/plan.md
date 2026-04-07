

# Adicionar Telas Faltantes ao Menu Lateral

## Problema

5 rotas existem no `App.tsx` mas não possuem entrada no menu lateral, tornando-as inacessíveis pela navegação.

## Alterações

### `src/components/dashboard/AppSidebar.tsx`

**1. Financeiro — adicionar 3 itens ao array `finBottomItems` (~linha 613):**
- `{ title: "Pagamentos", url: "/dashboard/pagamentos", icon: CreditCard, screenCode: "financeiro_pagamentos" }`
- `{ title: "Contas Bancárias", url: "/dashboard/bancos", icon: Building2, screenCode: "financeiro_contas_bancarias" }`
- `{ title: "Gestão Contas a Pagar", url: "/dashboard/contas-pagar", icon: FileText, screenCode: "financeiro_contas_pagar_gestao" }`

**2. Seção geral — adicionar Chat e Relatórios como itens visíveis para todos os usuários autenticados.**
Adicionar no bloco de itens gerais (perto de "Tarefas"/utilitários, ou como itens fixos no topo):
- `MenuItemLink` para `/dashboard/relatorios` com icon `BarChart3` e título "Relatórios"
- `MenuItemLink` para `/dashboard/chat` com icon `MessageCircle` e título "Chat"

## Arquivos

| Arquivo | Alteração |
|---|---|
| `src/components/dashboard/AppSidebar.tsx` | Adicionar 5 links faltantes |

