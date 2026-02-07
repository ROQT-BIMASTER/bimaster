
# Whitespace Analysis - Analise de Espaco em Branco

## Objetivo
Criar uma nova pagina dedicada que identifica **municipios sem presenca comercial** que ficam **na mesma microrregiao** de municipios onde a empresa ja atua. A logica e simples: se a empresa ja vende em 8 dos 10 municipios de uma microrregiao, os 2 restantes sao os alvos de expansao mais eficientes (logistica proxima, vendedor ja atribuido, mercado conhecido).

## Como Funciona o Score de Expansao

Cada municipio sem presenca recebe um **Score de Expansao** calculado assim:

```text
Score = PIB per Capita x (Municipios Ativos na Microrregiao / Total de Municipios na Microrregiao)
```

Isso prioriza municipios que sao:
1. **Ricos** (alto PIB per capita = potencial de compra)
2. **Proximos de onde ja atuamos** (alta penetracao na microrregiao = logistica facil)

Dados reais do banco confirmam: 477 microrregioes mistas com 2.252 municipios whitespace representando R$ 609 bilhoes de PIB inexplorado.

## Arquitetura

### 1. Nova RPC no Banco de Dados
**Funcao:** `fn_get_whitespace_analysis`

Parametros:
- `p_uf` (text) - Filtro por estado
- `p_regiao` (text) - Filtro por regiao
- `p_min_penetracao` (numeric) - Penetracao minima da microrregiao (ex: 30% = so mostra territorios onde ja temos boa base)
- `p_sort_column` (text) - Coluna de ordenacao
- `p_sort_direction` (text) - Direcao
- `p_limit` / `p_offset` - Paginacao

Retorna para cada municipio whitespace:
- Dados do municipio: nome, UF, populacao, PIB, PIB per capita
- Dados da microrregiao: nome, total de municipios, municipios ativos, penetracao %
- Receita total da microrregiao (demonstra que o territorio ja e produtivo)
- Vendedor atribuido ao territorio
- Score de expansao calculado

**Funcao auxiliar:** `fn_get_whitespace_kpis`

Retorna KPIs agregados:
- Total de municipios whitespace
- PIB total inexplorado
- Populacao total inexplorada
- Microrregioes com oportunidade
- Score medio de expansao

### 2. Hook de Dados
**Arquivo:** `src/hooks/useWhitespaceAnalysis.ts`

- Chama as RPCs com filtros e paginacao
- Gerencia estado de filtros (UF, regiao, penetracao minima)
- Cache de 5 minutos via React Query
- Funcao de exportacao Excel

### 3. Pagina Principal
**Arquivo:** `src/pages/WhitespaceAnalysis.tsx`
**Rota:** `/dashboard/comercial/whitespace`

Layout em secoes:

**Cabecalho:**
- Breadcrumb: Comercial > Inteligencia Comercial > Whitespace
- Titulo "Analise de Espaco em Branco" com subtitulo explicativo
- Filtros: UF, Regiao, Penetracao Minima da Microrregiao (slider 0-100%)

**KPIs Estrategicos (5 cards):**
- Municipios Whitespace (total de alvos)
- PIB Inexplorado (R$ bi)
- Populacao Descoberta
- Microrregioes com Oportunidade
- Score Medio de Expansao

**Grafico de Barras Horizontais - Top 15 Microrregioes:**
- Cada barra mostra a microrregiao
- Barra dividida em 2 cores: municipios ativos (verde) vs municipios whitespace (cinza)
- Ordenadas por score agregado da microrregiao
- Ao lado de cada barra: receita atual + PIB inexplorado

**Tabela Operacional:**
- Paginacao server-side (50 por pagina)
- Colunas: Rank | Municipio | UF | Microrregiao | Populacao | PIB/Capita | Penetracao Micro | Clientes Vizinhos | Receita Micro | Vendedor | Score
- Ordenavel por qualquer coluna
- Badge de penetracao da microrregiao (verde >70%, amarelo >40%, vermelho <40%)
- Exportacao Excel completa

### 4. Componentes

**a) `WhitespaceKPICards.tsx`** - 5 KPIs estrategicos
**b) `WhitespaceMicroChart.tsx`** - Grafico de barras das top microrregioes
**c) `WhitespaceTable.tsx`** - Tabela paginada com score e exportacao
**d) `WhitespaceFilters.tsx`** - Barra de filtros com slider de penetracao

## Detalhes Tecnicos

### Migracao SQL
Duas funcoes RPC novas:

1. `fn_get_whitespace_analysis` - Cruzamento de ibge_municipios com clientes (via ibge_municipio_id), agrupamento por microrregiao para calcular penetracao, filtragem apenas de municipios SEM presenca em microrregioes COM presenca, calculo do score de expansao
2. `fn_get_whitespace_kpis` - Agregacao dos KPIs de whitespace com os mesmos filtros

### Navegacao
- Nova rota: `/dashboard/comercial/whitespace`
- Adicionar no AppSidebar sob Comercial: "Whitespace" com icone Compass
- Adicionar no ComercialModule em "Dados de Mercado"
- Link cruzado na pagina de Inteligencia Municipal

### Arquivos Novos (6)
1. Migracao SQL com as 2 RPCs
2. `src/hooks/useWhitespaceAnalysis.ts`
3. `src/pages/WhitespaceAnalysis.tsx`
4. `src/components/comercial/whitespace/WhitespaceKPICards.tsx`
5. `src/components/comercial/whitespace/WhitespaceMicroChart.tsx`
6. `src/components/comercial/whitespace/WhitespaceTable.tsx`

### Arquivos Modificados (3)
1. `src/App.tsx` - Nova rota
2. `src/components/dashboard/AppSidebar.tsx` - Item no menu
3. `src/pages/modules/ComercialModule.tsx` - Link em Dados de Mercado
