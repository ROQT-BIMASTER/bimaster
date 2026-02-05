
# Painel de Supervisor - Trade Marketing

## Objetivo

Criar um painel similar ao "Visao Executiva Trade Marketing" para supervisores visualizarem exclusivamente os dados de suas equipes, com filtro por membro opcional.

## Arquitetura da Solucao

```text
+-----------------------------------------------------------------------+
|                     ARQUITETURA DO PAINEL SUPERVISOR                   |
+-----------------------------------------------------------------------+
|                                                                       |
|  +--------------------------+    +-----------------------------+      |
|  |   TradeExecutiveDashboard |    |  TradeSupervisorDashboard   |      |
|  |   (Diretoria/Admin)      |    |  (Supervisores)             |      |
|  |                          |    |                             |      |
|  |  Dados: GLOBAIS          |    |  Dados: EQUIPE FILTRADA     |      |
|  |  Acesso: trade_admin     |    |  Acesso: supervisor role    |      |
|  +--------------------------+    +-----------------------------+      |
|            |                                 |                        |
|            v                                 v                        |
|  +---------------------------+   +-----------------------------+      |
|  | useTradeExecutiveDashboard|   | useTradeSupervisorDashboard |      |
|  | (sem filtro de equipe)    |   | (COM filtro por subordinados)|     |
|  +---------------------------+   +-----------------------------+      |
|                                              |                        |
|                                              v                        |
|                                  +-------------------------+          |
|                                  |   get_subordinados      |          |
|                                  |   (RPC existente)       |          |
|                                  +-------------------------+          |
|                                                                       |
+-----------------------------------------------------------------------+
```

## Interface Visual do Painel

```text
+-----------------------------------------------------------------------+
| [Logo] Visao da Equipe - Trade Marketing       [Este mes v] [Atualizar]|
|        Painel consolidado da sua equipe                               |
| Periodo: 01/02/2026 ate 05/02/2026                                    |
+-----------------------------------------------------------------------+
|                                                                       |
| +---------------------+  +----------------------+  FILTRO POR MEMBRO  |
| |  MINHA EQUIPE       |  |  KPIs PRINCIPAIS     |  +--------------+   |
| |                     |  |                      |  | Todos        |   |
| |  [x] Todos (4)      |  |  12    5    8   85%  |  | Nathalia  [ ]|   |
| |  [ ] Nathalia       |  | PDVs Visitas Fotos   |  | Douglas   [ ]|   |
| |  [ ] Douglas        |  +----------------------+  | Juliana   [ ]|   |
| |  [ ] Juliana        |                           | Monique   [ ]|   |
| |  [ ] Monique        |                           +--------------+   |
| +---------------------+                                              |
|                                                                       |
| +-----------------------------------+  +-----------------------------+|
| |  EVOLUCAO - VISITAS E FOTOS       |  |  TOP CLIENTES (EQUIPE)      ||
| |  [Grafico de area]                |  |  [Grafico de barras]        ||
| +-----------------------------------+  +-----------------------------+|
|                                                                       |
| +-------------------------------------------------------------------+|
| |  VISITAS RECENTES DA EQUIPE                                       ||
| |  +-------+----------+-----------+--------+--------+               ||
| |  | PDV   | Vendedor | Data      | Status | Score  |               ||
| |  +-------+----------+-----------+--------+--------+               ||
| |  | Loja A| Nathalia | 05/02     | OK     | 95%    |               ||
| |  | Loja B| Douglas  | 04/02     | OK     | 88%    |               ||
| +-------------------------------------------------------------------+|
|                                                                       |
| +-------------------------------------------------------------------+|
| |  FOTOS RECENTES DA EQUIPE                                         ||
| |  [Grade de fotos com miniaturas]                                  ||
| +-------------------------------------------------------------------+|
+-----------------------------------------------------------------------+
```

## Componentes a Criar

### 1. Nova Pagina: `TradeSupervisorDashboard.tsx`

Pagina principal do painel do supervisor com:
- Filtro de periodo (mesmo do dashboard executivo)
- Seletor de membro da equipe (ou todos)
- Reutilizacao dos componentes visuais existentes
- Dados filtrados apenas para a equipe

### 2. Novo Hook: `useTradeSupervisorDashboard.ts`

Hook que adapta o `useTradeExecutiveDashboard` para:
- Buscar IDs dos subordinados via `get_subordinados`
- Filtrar todas as queries pelos IDs da equipe
- Permitir selecao de membro especifico

### 3. Componente: `SupervisorTeamSelector.tsx`

Seletor compacto para escolher membro da equipe ou ver todos.

## Fluxo de Dados

```text
1. Supervisor acessa /dashboard/trade/minha-equipe

2. Hook carrega subordinados:
   get_subordinados(supervisor_id) -> [id1, id2, id3, id4]

3. Queries sao filtradas:
   - visits: .in('atribuido_por', [id1, id2, id3, id4])
   - photos: .in('created_by', [id1, id2, id3, id4])
   - stores: .in('vendedor_id', [id1, id2, id3, id4])
   - lancamentos: .in('created_by', [id1, id2, id3, id4])

4. Se usuario selecionar membro especifico:
   - Filtros mudam para apenas aquele ID

5. Dados sao exibidos nos mesmos componentes visuais
```

## Alteracoes no Sistema

### Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/TradeSupervisorDashboard.tsx` | Pagina principal do painel |
| `src/hooks/useTradeSupervisorDashboard.ts` | Hook de dados filtrados por equipe |
| `src/components/trade/supervisor/SupervisorTeamSelector.tsx` | Seletor de membros |

### Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/App.tsx` | Adicionar rota `/dashboard/trade/minha-equipe` |
| `src/pages/modules/TradeModule.tsx` | Adicionar card de acesso para supervisores |

### Banco de Dados

Nenhuma alteracao necessaria - usa infraestrutura existente:
- `get_subordinados` RPC
- Tabelas `visits`, `photos`, `stores`, `trade_campaign_lancamentos`

## Seguranca e Permissoes

### Regras de Acesso

1. **Visibilidade da rota**: Apenas usuarios com role `supervisor` no menu
2. **Dados**: Filtrados automaticamente pelo hook usando `get_subordinados`
3. **Sem acesso a dados de outras equipes**: RPC retorna apenas subordinados do supervisor logado

### Implementacao de Seguranca

```typescript
// No hook useTradeSupervisorDashboard.ts
const { data: subordinados } = await supabase
  .rpc('get_subordinados', { _user_id: user.id });

const teamIds = [
  user.id, // Inclui o proprio supervisor
  ...subordinados.map(s => s.subordinado_id)
];

// Todas as queries usam .in('campo_id', teamIds)
```

## Reutilizacao de Componentes

Componentes do Dashboard Executivo que serao reutilizados:
- `TradeExecutiveKPIs` - Cards de KPIs
- `TradeExecutiveEvolutionChart` - Grafico de evolucao
- `TradeExecutiveTopClients` - Top clientes
- `TradeExecutiveVisitsTable` - Tabela de visitas
- `TradeExecutivePhotosGallery` - Galeria de fotos

## Navegacao

### Onde aparecera o acesso

No `TradeModule.tsx`, na secao "Performance e Vendas" para supervisores:

```text
Performance e Vendas
+------------------------+
| Minha Equipe      [NOVO]|  <- Acesso ao painel do supervisor
| Promoções              |
| Performance            |
| Equipe                 |
+------------------------+
```

### Rota

- URL: `/dashboard/trade/minha-equipe`
- Protecao: Role `supervisor` ou `admin`

## Beneficios

1. **Foco na equipe**: Supervisor ve apenas dados relevantes
2. **Filtro por membro**: Analise individual de cada vendedor
3. **Mesma experiencia visual**: Consistencia com o dashboard executivo
4. **Seguranca**: Dados isolados por hierarquia
5. **Performance**: Queries otimizadas com filtros especificos

## Ordem de Implementacao

1. Criar hook `useTradeSupervisorDashboard.ts` com logica de filtro
2. Criar componente `SupervisorTeamSelector.tsx`
3. Criar pagina `TradeSupervisorDashboard.tsx`
4. Adicionar rota no `App.tsx`
5. Adicionar link no menu do `TradeModule.tsx`
6. Testar com usuario supervisor (Michele)
