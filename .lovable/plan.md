

# Auditoria de Segurança: Bloqueio de Telas e Módulos

## Resultado Geral: Sistema SÓLIDO — 96/100

A arquitetura de segurança é robusta e bem implementada. A proteção opera em 3 camadas:

1. **Camada de Rota** — `ProtectedRoute` (autenticação), `ModuleRoute` (módulo), `ScreenRoute` (tela)
2. **Camada de Sidebar** — `showModule()` e `hasModulePermission()` ocultam itens não autorizados
3. **Camada de Banco** — RLS + RPC `get_all_user_permissions` + session invalidation via Realtime

## Pontos Fortes Confirmados

| Controle | Status |
|---|---|
| Todas as ~100 rotas `/dashboard/*` protegidas por guards | OK |
| Admin bypass centralizado no `PermissionsContext` (server-side via RPC) | OK |
| Impersonação restrita a admins com persistência segura (userId verificado) | OK |
| Session invalidation em tempo real ao trocar role | OK |
| Cache de permissões com verificação de userId no localStorage | OK |
| Safety timeout evita tela branca infinita | OK |
| Usuários inativos/bloqueados redirecionados | OK |
| Clientes isolados no portal | OK |
| Configurações admin-only via tabs condicionais | OK |

## 4 Lacunas Identificadas

### 1. Configurações acessível a TODOS os autenticados (Risco: Baixo)
**Linha 406**: `/dashboard/configuracoes` usa apenas `ProtectedRoute`, sem guard de módulo.
- A página internamente filtra tabs por role (admin/supervisor), mas qualquer vendedor/promotor pode acessar a rota e ver seu perfil.
- **Veredicto**: Intencional — a tela mostra "Meu Perfil" para todos e tabs admin ficam ocultas. **Sem ação necessária.**

### 2. Rota `/integração` não existe no App.tsx (Risco: Nulo)
O usuário está em `/integração` (com acento), mas essa rota não está definida. Cairá no catch-all `*` → ErrorPage. **Sem vulnerabilidade.**

### 3. Contas a Receber sem ScreenRoute granular (Risco: Baixo)
**Linhas 588-591**: As rotas de CR usam `ModuleRoute moduleCode="financeiro"` em vez de `ScreenRoute screenCode="financeiro_contas_receber"`, diferente de CP que usa `ScreenRoute`. Isso significa que qualquer usuário com acesso ao módulo financeiro pode acessar CR, mesmo sem permissão específica de tela.
- **Impacto**: Supervisores financeiros que deveriam ver apenas CP também veem CR.

### 4. Cobrança/Fluxo de Caixa/Plano Contas sem ScreenRoute (Risco: Baixo)
**Linhas 591-598**: Rotas como `fluxo-de-caixa`, `plano-contas`, `saldos-bancarios`, `central-pagamentos`, `investimentos`, `conciliacao-bancaria` usam apenas `ModuleRoute moduleCode="financeiro"` sem granularidade de tela. Qualquer usuário do módulo financeiro acessa tudo.

## Plano de Correção

### Ação Única: Adicionar ScreenRoute nas rotas financeiras que faltam

**Arquivo: `src/App.tsx`**

Substituir `ModuleRoute moduleCode="financeiro"` por `ScreenRoute screenCode="..."` nas rotas:

| Rota | screenCode sugerido |
|---|---|
| `/dashboard/financeiro/contas-a-receber` | `financeiro_contas_receber` |
| `/dashboard/financeiro/contas-a-receber/auditoria` | `financeiro_contas_receber` |
| `/dashboard/financeiro/contas-a-receber/sync` | `financeiro_contas_receber` |
| `/dashboard/financeiro/cobranca` | `financeiro_cobranca` |
| `/dashboard/financeiro/fluxo-de-caixa` | `financeiro_fluxo_caixa` |
| `/dashboard/financeiro/plano-contas` | `financeiro_plano_contas` |
| `/dashboard/financeiro/saldos-bancarios` | `financeiro_saldos_bancarios` |
| `/dashboard/financeiro/central-pagamentos` | `financeiro_pagamentos` |
| `/dashboard/financeiro/consolidado` | `financeiro_consolidado` |
| `/dashboard/financeiro/conciliacao-bancaria` | `financeiro_conciliacao` |
| `/dashboard/financeiro/investimentos` | `financeiro_investimentos` |
| `/dashboard/financeiro/classificar-banco` | `financeiro_classificar_banco` |

**Pré-requisito**: Verificar se esses screenCodes já existem na tabela `telas_sistema`. Se não, criar uma migração para inseri-los antes de aplicar os guards (senão ninguém acessa).

**Abordagem segura**: Primeiro verificar quais telas já existem no banco via query, depois criar migração para as faltantes, e só então alterar as rotas.

## Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `src/App.tsx` | Trocar ModuleRoute por ScreenRoute em ~12 rotas financeiras |
| Migração SQL | Inserir screenCodes faltantes em `telas_sistema` |

