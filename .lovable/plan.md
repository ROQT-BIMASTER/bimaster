

# Painel de Inteligencia Comercial: Market Share e Penetracao

## Contexto Atual

Seus dados hoje:
- **5.571 municipios** catalogados (IBGE)
- **1.000+ clientes** ativos no ERP (em 405 cidades)
- **233 prospects** em prospecao (41 municipios)
- **27 leads minerados** (4 cidades)
- **Sem tabela de territorios/vendedores por regiao** (lacuna critica)

## O que Grandes Empresas Fazem

Empresas como Ambev, Unilever e P&G usam 3 metricas-chave para medir dominio de mercado:

| Metrica | Formula | O que mede |
|---------|---------|------------|
| **Penetracao** | Municipios com clientes / Total de municipios da UF | Em quantos lugares voce esta presente |
| **Cobertura Numerica** | Clientes ativos / Total de estabelecimentos potenciais (leads) | Quantos clientes voce tem vs. quantos existem |
| **Pipeline Coverage** | Prospects ativos / Leads minerados na regiao | Quanto do potencial esta sendo trabalhado |

Alem disso, cruzam isso com dados economicos (PIB, populacao) para priorizar regioes de maior retorno.

---

## Plano de Implementacao

### Fase 1 - Tabela de Territorios e Atribuicao de Vendedores

Criar a estrutura que falta: vincular vendedores a regioes geograficas.

**Nova tabela `vendedor_territorios`:**
- Vincula um vendedor (profile) a UFs e/ou microrregioes IBGE
- Permite que um vendedor atenda multiplas regioes
- Base para distribuicao automatica de leads

**Nova tabela `market_coverage_snapshot`:**
- Tabela materializada com metricas pre-calculadas por UF/microrregiao
- Atualizada por database function (evita queries pesadas em tempo real)
- Campos: total_municipios, municipios_com_clientes, total_clientes_erp, total_prospects, total_leads, populacao, pib

### Fase 2 - Database Function para Calcular Metricas

Uma funcao SQL `fn_calcular_cobertura_mercado()` que cruza automaticamente:

```text
+------------------+     +----------------+     +-----------------+
| ibge_municipios  |     |    clientes    |     |    prospects     |
| (5.571 cidades)  |<--->| (cidade + uf)  |     | (municipio + uf) |
+------------------+     +----------------+     +-----------------+
        |                        |                       |
        v                        v                       v
+---------------------------------------------------------------+
|              market_coverage_snapshot                          |
|  UF | municipios_total | com_clientes | com_prospects |        |
|     | com_leads | penetracao_% | cobertura_% | pipeline_%     |
+---------------------------------------------------------------+
```

### Fase 3 - Dashboard de Inteligencia Comercial

Uma nova pagina `/dashboard/comercial/inteligencia` com:

**Painel Superior - KPIs Globais:**
- Penetracao Nacional (405 cidades atendidas / 5.571 = 7,3%)
- Cobertura de Prospecao (41 cidades em prospecao)
- Pipeline de Mineracao (4 cidades mineradas)
- Market Size (populacao total das regioes atendidas)

**Tabela Cruzada Principal (o coracao do painel):**

| UF | Municipios | Com Clientes | Penetracao | Prospects | Leads | Cobertura | PIB Regiao | Pop. |
|----|-----------|-------------|-----------|----------|-------|----------|-----------|------|
| SP | 645 | 156 | 24,2% | 24 | 24 | 100% | R$ X bi | Y mi |
| GO | 246 | 47 | 19,1% | 0 | 0 | 0% | R$ X bi | Y mi |
| PE | 185 | 0 | 0% | 50 | 0 | - | R$ X bi | Y mi |

Colunas da tabela:
- UF, Total Municipios (IBGE), Municipios com Clientes ERP, % Penetracao
- Qtde Clientes ERP, Qtde Prospects, Qtde Leads Minerados
- % Cobertura (prospects+clientes / leads), PIB, Populacao
- Vendedor(es) responsavel(eis)

**Grafico de Penetracao por UF** (barras horizontais com Recharts)

**Mapa de Calor** (tabela com cores de intensidade por penetracao)

### Fase 4 - Distribuicao Automatica de Leads por Territorio

Ao converter leads em prospects, o sistema:
1. Identifica a cidade/UF do lead
2. Busca o vendedor atribuido aquele territorio
3. Atribui automaticamente o `vendedor_id` no prospect

---

## Detalhamento Tecnico

### Migracao SQL

1. Criar tabela `vendedor_territorios` (vendedor_id, uf, microrregiao_id, ativo)
2. Criar tabela `market_coverage_snapshot` (uf, metricas calculadas, updated_at)
3. Criar funcao `fn_calcular_cobertura_mercado()` que faz os JOINs e popula o snapshot
4. Criar funcao `fn_atribuir_vendedor_territorio(cidade, uf)` para auto-atribuicao
5. RLS policies para ambas as tabelas

### Novos Componentes React

1. `src/pages/MarketIntelligence.tsx` - Pagina principal do painel
2. `src/components/comercial/MarketCoverageTable.tsx` - Tabela cruzada com filtros
3. `src/components/comercial/PenetrationChart.tsx` - Grafico de penetracao
4. `src/components/comercial/MarketKPICards.tsx` - Cards de KPI no topo
5. `src/components/comercial/VendedorTerritorioManager.tsx` - Gestao de territorios
6. `src/hooks/useMarketCoverage.ts` - Hook com queries de cobertura

### Rota

- `/dashboard/comercial/inteligencia` - Registrada no App.tsx dentro do modulo comercial
- Link adicionado ao `ComercialModule.tsx` na secao "Dados de Mercado"

### Integracao com Fluxo Existente

- O hook `useLeadMining` sera atualizado para usar `fn_atribuir_vendedor_territorio` na conversao
- A pagina de LeadMining ganha um indicador visual de qual vendedor sera atribuido
- Os filtros de UF/cidade ja existentes no IBGE sao reaproveitados

