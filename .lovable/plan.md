

## Plano: Eliminar duplicação mantendo o Trade Administrativo como hub único

### Diagnóstico rápido

**TradeAdminModule** (que você quer manter) tem 7 cards. **TradeFinanceiro** tem 9 cards + tabs inline. A sobreposição é de ~5 itens (Campanhas, Verbas, Aprovações, Lançamentos, Contas Correntes). O TradeFinanceiro tem 4 itens exclusivos que precisam ser absorvidos.

### O que será feito

#### 1. Adicionar cards faltantes ao TradeAdminModule

Itens que só existem no TradeFinanceiro e serão adicionados ao Admin:

| Card | Rota | Categoria |
|---|---|---|
| Dashboard Financeiro | `/trade/financeiro/dashboard` | Já existe como "Financeiro Trade" — renomear |
| Meu Extrato | `/trade/financeiro/extrato` | Novo card |
| Painel de Lançamentos | `/trade/financeiro/lancamentos-campanhas` | Novo card |
| Contas a Pagar | `/dashboard/contas-a-pagar` | Novo card |
| Plano de Contas | `/dashboard/plano-contas` | Mover para seção secundária |

O card "Financeiro Trade" atual (que aponta para a página duplicada) será **substituído** pelo card "Dashboard Financeiro" apontando direto para `/trade/financeiro/dashboard`.

#### 2. Reorganizar cards em categorias visuais

Agrupar os cards principais com labels de seção:

- **Operacional**: Campanhas, Lançamentos, Painel de Lançamentos
- **Financeiro**: Verbas, Dashboard Financeiro, Contas Correntes, Meu Extrato, Contas a Pagar
- **Gestão**: Aprovações, Visão Executiva

#### 3. Redirecionar TradeFinanceiro

`/dashboard/trade/financeiro` passará a redirecionar para `/dashboard/trade/admin`. Todas as sub-rotas (`/trade/financeiro/dashboard`, `/trade/financeiro/campanhas`, etc.) continuam funcionando normalmente.

#### 4. Mover Plano de Contas para seção secundária

Adicionar "Plano de Contas" à seção colapsável de "Configurações" no TradeAdminModule, já que é um item de configuração.

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/pages/modules/TradeAdminModule.tsx` | Adicionar cards faltantes, reorganizar em categorias, remover card "Financeiro Trade" |
| `src/pages/TradeFinanceiro.tsx` | Substituir conteúdo por `<Navigate to="/dashboard/trade/admin" replace />` |
| Breadcrumbs das sub-páginas de `/trade/financeiro/*` | Atualizar `moduleHref` para `/dashboard/trade/admin` |

### O que NÃO muda
- Nenhum card, KPI ou funcionalidade do TradeAdminModule atual será removido
- Todas as sub-páginas de detalhe continuam acessíveis pelas mesmas URLs
- O layout visual (cards com ícones coloridos, KPIs no topo, seções colapsáveis) permanece idêntico

