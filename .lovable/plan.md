

# Auditoria: Telas Sem Entrada no Menu Lateral

## Análise Completa

Comparei **todas as rotas** do `App.tsx` com os links do `AppSidebar.tsx`. Resultado:

### Telas que JÁ estão no menu (admin — seção colapsável no rodapé)
Todas as 23 rotas admin (API Health, Painel Segurança, Rel. APIs, Asana Sync, etc.) **existem** no menu, mas ficam dentro do bloco **"Administração"** — um collapsible pequeno no **rodapé** da sidebar. Pode ser difícil de encontrar se o usuário não rolar até o final.

### Telas SEM entrada no menu lateral

| # | Rota | Página | Onde deveria estar |
|---|------|--------|--------------------|
| 1 | `/dashboard/relatorios` | Relatórios gerais | Seção geral ou admin |
| 2 | `/dashboard/chat` | Chat interno | Seção geral (utilitários) |
| 3 | `/dashboard/contas-pagar` | Gestão Contas a Pagar | Financeiro |
| 4 | `/dashboard/bancos` | Contas Bancárias | Financeiro (finBottomItems tem "Saldos Bancários" mas não "Contas Bancárias") |
| 5 | `/dashboard/pagamentos` | Pagamentos | Financeiro |
| 6 | `/dashboard/marketing/mission-control` | Mission Control Mktg | Já está no array `marketingSubMenus` — OK se permissão ativa |
| 7 | `/dashboard/detalhamento` | Detalhamento Vendas | Comercial (sub-página de clientes, sem link direto) |

### Problema principal
O "Painel de APIs" (`API Health`) **existe** no menu admin, mas fica oculto no collapsible do rodapé. O mesmo vale para todas as telas admin. O usuário provavelmente não está encontrando porque precisa rolar até o final e clicar em "Administração".

## Plano de Correção

### 1. Adicionar as telas faltantes ao menu

No `AppSidebar.tsx`:

- **Financeiro**: Adicionar "Contas Bancárias" (`/dashboard/bancos`) e "Pagamentos" (`/dashboard/pagamentos`) ao `finBottomItems`
- **Seção geral**: Adicionar "Relatórios" (`/dashboard/relatorios`) e "Chat" (`/dashboard/chat`) como itens gerais visíveis
- **Comercial**: Adicionar "Detalhamento Vendas" (`/dashboard/detalhamento`) ao submenu comercial

### 2. Melhorar visibilidade do menu Admin

Opcionalmente, mover a seção "Administração" do rodapé para uma posição mais visível (como uma categoria dedicada no corpo da sidebar), garantindo que admins encontrem facilmente as ferramentas.

## Arquivos

| Arquivo | Alteração |
|---|---|
| `src/components/dashboard/AppSidebar.tsx` | Adicionar ~5 links faltantes + considerar reposicionar seção admin |

