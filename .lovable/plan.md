

# Substituir Grafico de Dispersao por Painel de Cobertura Comercial

## Problema
O grafico de dispersao (Scatter Plot) de "PIB per Capita vs Receita" nao esta sendo util porque:
- Trabalha com dados paginados (apenas 50 registros por pagina), gerando pontos esparsos
- A maioria dos municipios se concentra no canto inferior esquerdo (receita zero ou baixa), tornando a visualizacao ilegivel
- Nao oferece insight acionavel real para a equipe comercial

## Solucao Proposta
Substituir o scatter chart por um **Painel de Cobertura Comercial** muito mais informativo, composto por dois elementos visuais complementares:

### 1. Grafico de Rosca (Donut Chart) - Distribuicao de Status
Um grafico de rosca centralizado mostrando a distribuicao dos municipios por status comercial:
- **Ativo** (verde) - Municipios com clientes e vendas
- **Prospect** (amarelo) - Municipios com prospects cadastrados
- **Lead** (azul) - Municipios com leads minerados
- **Virgem** (cinza) - Municipios sem nenhum registro comercial

No centro da rosca: o numero total de municipios e a taxa de penetracao em destaque.

Este grafico utiliza os **dados dos KPIs** (ja agregados no servidor para todos os municipios filtrados), nao os dados paginados - garantindo que sempre mostre o cenario completo.

### 2. Metricas Laterais de Contexto
Ao lado da rosca, metricas resumidas para dar dimensao ao potencial inexplorado:
- Populacao total dos municipios Virgem
- PIB total dos municipios sem presenca
- Percentual de municipios ainda nao atendidos

## O que sera modificado

### Arquivo editado
**`src/components/comercial/municipios/MunicipiosScatterChart.tsx`**
- Substituir completamente o conteudo pelo novo componente `MunicipiosCoberturaChart`
- Manter o mesmo nome do arquivo e a mesma interface (`data` + `loading`) para nao alterar a pagina principal
- Adicionar props de `kpis` para usar os dados agregados (ou calcular a distribuicao a partir dos dados KPI)

### Arquivo editado
**`src/pages/MunicipiosIntelligence.tsx`**
- Passar os dados de KPIs como prop adicional para o componente do grafico, garantindo que a distribuicao reflita todos os municipios filtrados (nao apenas a pagina atual)

## Detalhes tecnicos

### Dados utilizados
O grafico usara os campos ja disponiveis nos KPIs:
- `municipios_atendidos` (Ativos)
- `municipios_prospect`
- `municipios_lead`  
- `municipios_virgem`
- `total_municipios`
- `taxa_penetracao`
- `populacao_total`
- `pib_total`

Isso elimina o problema de dados paginados - os KPIs sempre refletem o universo completo com os filtros aplicados.

### Biblioteca
Utilizara `PieChart` + `Pie` + `Cell` do Recharts (ja instalado) com `innerRadius` para criar o efeito de rosca.

### Layout do card
```text
+---------------------------------------------------+
| Cobertura Comercial Municipal                      |
| Distribuicao de status entre os municipios          |
| filtrados                                          |
+---------------------------------------------------+
|                                                     |
|    [  Donut Chart  ]     | Metricas de Contexto    |
|    [  com legenda  ]     | - X mun. inexplorados   |
|    [ total central ]     | - Y milhoes hab sem     |
|    [  penetracao   ]     |   cobertura             |
|                          | - Z bi PIB potencial    |
+---------------------------------------------------+
```

