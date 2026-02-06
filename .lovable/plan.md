
# Painel de Atuacao Imediata - Reativacao Comercial

## Objetivo
Criar um painel visual que destaque clientes que precisam de contato urgente, organizados por nivel de risco baseado nos dias sem compra e valor historico, permitindo ao time comercial priorizar acoes de reativacao.

## Dados Reais Disponiveis
Com base na tabela `clientes`, temos:
- **43 clientes** entre 31-60 dias sem compra (Atencao)
- **57 clientes** entre 61-90 dias (Alerta)
- **59 clientes** entre 91-180 dias (Critico) - R$ 341 mil em risco
- **301 clientes** com 180+ dias (Inativo) - R$ 700 mil em risco

## O que sera construido

### 1. Nova pagina: Painel de Reativacao (`/dashboard/comercial/reativacao`)
Uma pagina dedicada acessivel a partir do modulo comercial, com foco total em acao.

### 2. KPIs de Urgencia (topo da pagina)
Quatro cards com destaque visual por cor de severidade:
- **Atencao** (amarelo): 31-60 dias sem compra - quantidade + valor total
- **Alerta** (laranja): 61-90 dias - quantidade + valor total  
- **Critico** (vermelho): 91-180 dias - quantidade + valor total
- **Inativo** (cinza escuro): 180+ dias - quantidade + valor total

### 3. Grafico de Funil de Risco
Um grafico de barras horizontais (Recharts) mostrando a distribuicao de clientes por faixa de inatividade, com o valor monetario em risco em cada faixa. Cores seguem a severidade.

### 4. Grafico de Evolucao Temporal
Um grafico de area mostrando a concentracao de clientes por "dias sem compra" ao longo do tempo, permitindo visualizar onde esta o maior cluster de inatividade.

### 5. Top Clientes para Acao Imediata (tabela principal)
Tabela interativa com os clientes que precisam de atuacao, contendo:
- Nome do cliente, Cidade, UF
- Dias sem compra (com badge colorido por severidade)
- Data da ultima compra
- Valor da ultima compra
- Limite de credito

**Filtros da tabela:**
- Por nivel de risco (Atencao / Alerta / Critico / Inativo)
- Por UF
- Busca por nome

**Ordenacao padrao:** Valor da ultima compra decrescente dentro de cada faixa, priorizando os clientes de maior valor em risco.

### 6. Resumo por UF
Card lateral mostrando quais estados tem mais receita em risco, destacando SP (R$ 714k), MG, MT e GO como prioridades geograficas.

## Detalhes Tecnicos

### Novo hook: `useClienteReativacao`
- Consulta direta a tabela `clientes` calculando `CURRENT_DATE - data_ultima_compra::date` como dias sem compra
- Filtra apenas clientes com `valor_ultima_compra > 0` (que tem historico de compra)
- Calcula KPIs agregados por faixa de inatividade
- Agrupa dados por UF para o resumo geografico
- Usa React Query com cache key `["clientes-reativacao"]`

### Novos componentes (em `src/components/comercial/`)
1. `ReactivationKPICards.tsx` - Cards de severidade no topo
2. `RiskFunnelChart.tsx` - Grafico de barras horizontais por faixa
3. `InactivityDistributionChart.tsx` - Grafico de area/histograma
4. `ReactivationTable.tsx` - Tabela interativa com filtros
5. `RiskByStateCard.tsx` - Resumo de risco por UF

### Nova pagina
- `src/pages/ClientReactivation.tsx` - Pagina que orquestra todos os componentes
- Rota: `/dashboard/comercial/reativacao`
- Link adicionado no `ComercialModule.tsx`

### Classificacao de risco (logica central)
```text
  0-30 dias  -> Ativo (verde) - sem acao necessaria
 31-60 dias  -> Atencao (amarelo) - monitorar
 61-90 dias  -> Alerta (laranja) - contatar
91-180 dias  -> Critico (vermelho) - acao urgente
  180+ dias  -> Inativo (cinza) - campanha de reativacao
```

### Layout da pagina
```text
+--------------------------------------------------+
| <- Voltar   Painel de Reativacao      [Atualizar] |
+--------------------------------------------------+
| [Atencao:43] [Alerta:57] [Critico:59] [Inativo:301] |
+--------------------------------------------------+
| Funil de Risco (barras)  |  Risco por UF (ranking)|
+--------------------------------------------------+
| Distribuicao de Inatividade (area chart)          |
+--------------------------------------------------+
| Tabela: Top Clientes para Acao Imediata           |
| [Filtro Risco] [Filtro UF] [Busca]                |
| Nome | Cidade | UF | Dias | Data | Valor | Limite|
+--------------------------------------------------+
```

### Sem alteracoes no banco de dados
Todos os calculos serao feitos via query direta na tabela `clientes` existente, usando `CURRENT_DATE - data_ultima_compra::date` para calcular os dias sem compra dinamicamente. Nenhuma migration necessaria.
