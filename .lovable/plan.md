

# Inteligencia Comercial por Municipios - Painel Estrategico

## Objetivo
Criar uma tela dedicada e extremamente profissional para analise de todos os 5.571 municipios brasileiros, cruzando dados do IBGE (populacao, PIB, renda per capita) com dados comerciais (clientes, prospects, receita, ticket medio) para fornecer inteligencia territorial granular e acionavel.

## Arquitetura da Solucao

### 1. RPC no Banco de Dados (Server-Side Aggregation)
**Funcao:** `fn_get_municipios_intelligence`

Como sao 5.571 municipios, o cruzamento de dados sera feito no banco de dados via RPC para performance, seguindo o padrao ja estabelecido no projeto (`get_portfolio_kpis`, `get_concentracao_uf`, etc.).

A funcao recebera parametros opcionais:
- `p_uf` (text) - Filtro por estado
- `p_regiao` (text) - Filtro por regiao
- `p_microrregiao_id` (integer) - Filtro por microrregiao
- `p_search` (text) - Busca por nome de municipio
- `p_status` (text) - Filtro por status comercial (todos, com_clientes, sem_clientes, com_prospects, virgem)
- `p_limit` (integer) - Paginacao
- `p_offset` (integer) - Paginacao

Retornara para cada municipio:
- Dados IBGE: nome, UF, regiao, microrregiao, populacao, PIB, renda per capita
- Dados Comerciais: total de clientes, clientes com compra, receita ultima, receita maior, ticket medio
- Prospects e Leads: total de prospects, total de leads minerados
- Indicadores Calculados: "clientes por 10 mil habitantes" (densidade comercial), "receita por habitante" (intensidade comercial), status do municipio (Ativo, Prospect, Virgem)
- Vendedor atribuido (via vendedor_territorios)

Tambem criara uma funcao auxiliar `fn_get_municipios_kpis` para os KPIs resumo com os mesmos filtros.

### 2. Hook de Dados
**Arquivo:** `src/hooks/useMunicipiosIntelligence.ts`

- Chama a RPC com filtros e paginacao
- Gerencia estado de filtros (UF, regiao, microrregiao, status, busca)
- Cache de 5 minutos via React Query
- Expoe KPIs agregados e dados paginados

### 3. Pagina Principal
**Arquivo:** `src/pages/MunicipiosIntelligence.tsx`

Layout profissional em secoes:

**Cabecalho:**
- Breadcrumb: Comercial > Inteligencia Comercial > Municipios
- Titulo "Inteligencia Municipal" com subtitulo
- Filtros avancados: UF, Regiao, Microrregiao, Status Comercial
- Botao de exportar Excel

**KPIs Estrategicos (6 cards):**
- Total de Municipios (filtrado)
- Municipios Atendidos (com clientes)
- Taxa de Penetracao Municipal
- Receita Total nos Municipios
- Densidade Comercial Media (clientes/10k hab)
- PIB Total dos Municipios Filtrados

**Grafico de Dispersao (Scatter Plot):**
- Eixo X: PIB per Capita do municipio
- Eixo Y: Receita da empresa no municipio
- Tamanho do ponto: Populacao
- Cor: Status (Ativo = verde, Prospect = amarelo, Virgem = cinza)
- Permite identificar visualmente municipios ricos onde a empresa ainda nao atua

**Top 10 Oportunidades:**
- Card especial mostrando os 10 municipios com maior PIB onde a empresa NAO tem clientes
- Cada item com populacao, PIB per capita e indicacao de "Mercado nao explorado"

**Tabela Operacional Completa:**
- Paginacao server-side (50 por pagina)
- Colunas: Municipio | UF | Microrregiao | Populacao | PIB | PIB/Capita | Clientes | Receita | Ticket Medio | Densidade Comercial | Status | Vendedor
- Ordenacao por qualquer coluna
- Badge de status colorido (Ativo/Prospect/Virgem/Lead)
- Linha de totais
- Exportacao Excel completa (todos os registros filtrados)

### 4. Componentes

**a) `MunicipiosKPICards.tsx`** - 6 KPIs estrategicos com icones e cores
**b) `MunicipiosScatterChart.tsx`** - Grafico de dispersao PIB vs Receita
**c) `MunicipiosOpportunityCard.tsx`** - Top 10 oportunidades nao exploradas
**d) `MunicipiosTable.tsx`** - Tabela paginada com ordenacao, filtros e export
**e) `MunicipiosFilters.tsx`** - Barra de filtros avancados (UF, Regiao, Microrregiao, Status)

### 5. Navegacao e Rota

- Nova rota: `/dashboard/comercial/municipios-inteligencia`
- Adicionar no sidebar do Comercial: "Municipios" com icone Building2
- Adicionar no modulo Comercial em "Dados de Mercado" como link secundario
- Botao de acesso direto na pagina de Inteligencia Comercial existente

## Detalhes Tecnicos

### Migracao SQL
Duas funcoes RPC novas:

1. `fn_get_municipios_intelligence` - Retorna dados paginados dos municipios com cruzamento comercial
2. `fn_get_municipios_kpis` - Retorna KPIs agregados dos municipios filtrados

Ambas fazem LEFT JOIN de `ibge_municipios` com `clientes` (via `ibge_municipio_id`), `prospects` e `leads_minerados` (via fuzzy match UF + nome), e `vendedor_territorios` (via microrregiao).

### Classificacao de Status
```text
Ativo      = Tem clientes com compra
Prospect   = Tem prospects cadastrados (sem clientes)
Lead       = Tem leads minerados (sem clientes nem prospects)
Virgem     = Nenhum registro comercial
```

### Performance
- Paginacao server-side (50 registros por pagina) para os 5.571 municipios
- RPCs com indices existentes (ibge_municipio_id nos clientes, uf_sigla nos municipios)
- Cache de 5 minutos no React Query
- Exportacao Excel busca todos os registros filtrados (sem paginacao) em chamada separada

### Arquivos Novos (7)
1. `src/hooks/useMunicipiosIntelligence.ts`
2. `src/pages/MunicipiosIntelligence.tsx`
3. `src/components/comercial/municipios/MunicipiosKPICards.tsx`
4. `src/components/comercial/municipios/MunicipiosScatterChart.tsx`
5. `src/components/comercial/municipios/MunicipiosOpportunityCard.tsx`
6. `src/components/comercial/municipios/MunicipiosTable.tsx`
7. `src/components/comercial/municipios/MunicipiosFilters.tsx`

### Arquivos Modificados (3)
1. `src/App.tsx` - Nova rota `/dashboard/comercial/municipios-inteligencia`
2. `src/components/dashboard/AppSidebar.tsx` - Item "Municipios" no menu Comercial
3. `src/pages/modules/ComercialModule.tsx` - Link em "Dados de Mercado"

### Migracao SQL (1)
1. Criar `fn_get_municipios_intelligence` e `fn_get_municipios_kpis`

