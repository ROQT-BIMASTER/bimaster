

# Diagnóstico e Correção: Contas a Receber — Valores Não Exibidos

## Causa Raiz

O módulo de Contas a Receber tem **334.987 registros** no banco. Foram identificados dois problemas críticos:

### Problema 1: Dashboard carrega todos os registros via client-side (LENTO/TIMEOUT)

O componente `DashboardContasReceberAggregated.tsx` usa `fetchAllRows()` para buscar **todos** os registros em lotes de 1.000 e processar no navegador. Com 334k registros, isso gera **335 requisições sequenciais** ao banco, resultando em timeout ou travamento do navegador.

**Ironia**: Existem **9 RPCs prontas** no banco (`get_contas_receber_dashboard_kpis`, `get_contas_receber_evolucao_mensal`, `get_contas_receber_top_clientes`, `get_contas_receber_aging`, `get_contas_receber_status_dist`, `get_contas_receber_pmr_detalhes`) que fazem toda a agregação no PostgreSQL em milissegundos — mas **nenhuma é usada pelo dashboard**.

### Problema 2: Totais da tabela truncados em 1.000 linhas

Na `ContasAReceber.tsx`, a query de totais (linhas 241-262) busca `valor_original, valor_aberto, valor_recebido` **sem paginação**, batendo no limite padrão de 1.000 linhas do PostgREST. Os totais exibidos representam apenas ~0.3% dos dados reais.

## Solução

### 1. Dashboard: Substituir `fetchAllRows` por RPCs existentes

**Arquivo: `src/components/financeiro/DashboardContasReceberAggregated.tsx`**

Substituir a query única que busca 334k registros por **6 queries paralelas** usando as RPCs já criadas:

| Dado | RPC | Retorno |
|------|-----|---------|
| KPIs (totais, vencidos, PMR) | `get_contas_receber_dashboard_kpis` | JSON com ~20 métricas |
| Evolução mensal | `get_contas_receber_evolucao_mensal` | ~12 linhas (meses) |
| Top clientes devedores | `get_contas_receber_top_clientes` | ~10 linhas |
| Aging (faixas de atraso) | `get_contas_receber_aging` | 5 linhas (buckets) |
| Distribuição por status | `get_contas_receber_status_dist` | ~4 linhas |
| PMR detalhes (modal) | `get_contas_receber_pmr_detalhes` | Sob demanda |

Todas as RPCs já aceitam os mesmos parâmetros de filtro (`p_empresas`, `p_ano`, `p_mes`, `p_conta`, `p_portador`) e são `SECURITY DEFINER`, executando no servidor sem limitação de linhas.

- Remover import e uso de `fetchAllRows`
- Substituir a query monolítica por `Promise.all` de 5 RPCs
- Manter PMR detalhes como query separada (só executa ao abrir modal)
- Adaptar os `useMemo` para consumir dados já agregados das RPCs

### 2. Tabela: Criar RPC para totais filtrados

**Migration SQL:**

Criar função `get_contas_receber_totais_filtrados` que recebe os mesmos filtros da tabela e retorna `SUM(valor_original)`, `SUM(valor_aberto)`, `SUM(valor_recebido)` — agregação no PostgreSQL, sem limite de linhas.

**Arquivo: `src/pages/ContasAReceber.tsx`**

Substituir a query de totais (linhas 241-262) por chamada à nova RPC.

### 3. Calendário — já funciona corretamente

O `CalendarioRecebimentosAggregated.tsx` já usa a RPC `get_contas_receber_calendario` — nenhuma alteração necessária.

## Impacto Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Dashboard: requisições | ~335 sequenciais | 5 paralelas |
| Dashboard: tempo | 30s+ / timeout | < 1s |
| Totais tabela: precisão | ~0.3% dos dados | 100% |
| Totais tabela: requisições | 1 (truncada) | 1 RPC |

## O que NÃO muda

- Lógica de filtros, paginação e ordenação da tabela
- RLS policies (RPCs são `SECURITY DEFINER` com filtros de empresa)
- Calendário (já usa RPC)
- Drawer de detalhes
- Exportação Excel

