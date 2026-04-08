

# Painel de Performance por Região

## Problema

Os filtros de Região/UF existentes filtram a tabela de ranking, mas como os influenciadores ainda não têm dados de região preenchidos, não mostram resultados úteis. Além disso, falta uma visão consolidada de performance por região.

## Solução

Criar um componente `RegionalPerformancePanel` que agrupa os influenciadores por região/UF e exibe métricas agregadas — sem depender dos filtros atuais.

## Mudanças

### 1. Criar `RegionalPerformancePanel.tsx`

Componente com duas visões:

**Visão por Região** (tabela):
| Região | Influenciadores | Alcance Total | Engajamento Médio | Score Médio | Melhor Influenciador |
|---|---|---|---|---|---|

**Visão por UF** (tabela expansível ao clicar na região):
| UF | Influenciadores | Alcance | Engajamento | Score | Top Influenciador |
|---|---|---|---|---|---|

- Influenciadores sem região aparecem na linha "Não definido"
- Barras de progresso discretas para comparar regiões
- Cores por faixa de performance (mesmo padrão do ranking)
- Botão para expandir/colapsar UFs dentro de cada região

### 2. Integrar no `InfluencerDashboard.tsx`

- Adicionar aba/toggle "Performance Regional" ao lado do toggle Grid/Ranking existente
- Novo viewMode: `"regional"`
- Recebe a lista completa de influenciadores (sem filtro de região aplicado)

### 3. Manter filtros existentes

Os filtros de Região/UF continuam funcionando no ranking/grid — são úteis quando os dados de região estiverem preenchidos (via cadastro manual ou análise de audiência pela IA).

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/marketing/influencers/RegionalPerformancePanel.tsx` | Criar — tabela de performance por região/UF |
| `src/components/marketing/influencers/InfluencerDashboard.tsx` | Modificar — adicionar viewMode "regional" e botão |

