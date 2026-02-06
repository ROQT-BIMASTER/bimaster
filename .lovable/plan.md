

## Integração com API do IBGE - Dados Geográficos e Demográficos

### Objetivo
Criar uma integração completa com a API do IBGE para carregar e armazenar dados de estados, municipios, microrregioes, populacao e PIB (para calcular renda per capita). Os dados ficarão disponiveis no Modulo Comercial para cruzamento futuro com dados de vendas e análise de share de posicionamento.

### APIs do IBGE a serem consumidas
1. **Localidades** (`servicodados.ibge.gov.br/api/v1/localidades`)
   - `/estados` - 27 estados com nome, sigla e regiao (Norte, Nordeste, Sudeste, Sul, Centro-Oeste)
   - `/municipios?view=nivelado` - ~5.570 municipios com hierarquia completa (microrregiao, mesorregiao, UF, regiao)
   - `/microrregioes` - ~558 microrregioes com mesorregiao e UF

2. **Agregados/SIDRA** (`servicodados.ibge.gov.br/api/v3/agregados`)
   - Tabela **6579**, variável **9324** - Populacao estimada (dados até 2025)
   - Tabela **5938**, variável **37** - PIB municipal em Mil Reais (dados até 2021)

### O que será criado

#### 1. Tabelas no banco de dados

**ibge_estados** - 27 registros
| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | integer (PK) | Codigo IBGE do estado |
| sigla | text | Sigla (SP, RJ, etc.) |
| nome | text | Nome completo |
| regiao_id | integer | Codigo da regiao |
| regiao_sigla | text | Sigla (N, NE, SE, S, CO) |
| regiao_nome | text | Norte, Nordeste, Sudeste, Sul, Centro-Oeste |
| populacao | bigint | Populacao estimada |
| pib_mil_reais | numeric | PIB em Mil Reais |

**ibge_microrregioes** - ~558 registros
| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | integer (PK) | Codigo IBGE |
| nome | text | Nome da microrregiao |
| mesorregiao_id | integer | Codigo da mesorregiao |
| mesorregiao_nome | text | Nome da mesorregiao |
| uf_id | integer (FK) | Codigo do estado |
| regiao_nome | text | Norte, Nordeste, etc. |

**ibge_municipios** - ~5.570 registros
| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | integer (PK) | Codigo IBGE do municipio |
| nome | text | Nome do municipio |
| uf_id | integer (FK) | Codigo do estado |
| uf_sigla | text | Sigla do estado |
| microrregiao_id | integer (FK) | Codigo da microrregiao |
| microrregiao_nome | text | Nome da microrregiao |
| mesorregiao_id | integer | Codigo da mesorregiao |
| mesorregiao_nome | text | Nome da mesorregiao |
| regiao_nome | text | Norte, Nordeste, etc. |
| populacao_estimada | bigint | Populacao estimada |
| pib_mil_reais | numeric | PIB em Mil Reais |
| pib_per_capita | numeric | PIB / Populacao (calculado) |
| ano_populacao | integer | Ano da estimativa populacional |
| ano_pib | integer | Ano do dado de PIB |
| updated_at | timestamptz | Data da ultima atualizacao |

Todas as tabelas terão RLS habilitado com politica de leitura para usuarios autenticados.

#### 2. Edge Function `ibge-sync`

Uma funcao backend que realiza a sincronizacao em etapas:

```text
Fluxo de execucao:
+------------------+     +-------------------+     +--------------------+
| 1. Buscar        | --> | 2. Buscar         | --> | 3. Buscar          |
| Estados (27)     |     | Microrregioes     |     | Municipios (~5570) |
|                  |     | (~558)            |     |                    |
+------------------+     +-------------------+     +--------------------+
                                                          |
                          +-------------------+           |
                          | 5. Buscar PIB     | <---------+
                          | (Tabela 5938)     |           |
                          +-------------------+     +--------------------+
                                |                   | 4. Buscar          |
                                v                   | Populacao          |
                          +-------------------+     | (Tabela 6579)      |
                          | 6. Calcular       |     +--------------------+
                          | PIB per capita    |
                          | e salvar tudo     |
                          +-------------------+
```

- Utiliza a API SIDRA com `N6[all]` para buscar dados de todos os municipios de uma vez
- Salva em lotes (upsert) para evitar timeouts
- Calcula o PIB per capita automaticamente

#### 3. Nova página "Dados IBGE" no Módulo Comercial

Página acessível em `/dashboard/comercial/ibge` com:

- **Cards resumo**: Total de estados, municipios, populacao total do Brasil, distribuicao por regiao
- **Filtros**: Por regiao (Norte, Nordeste, etc.), estado, microrregiao, busca por nome
- **Tabela de municipios**: Nome, UF, Regiao, Microrregiao, Populacao, PIB, PIB per capita
- **Botão "Sincronizar IBGE"**: Dispara a Edge Function para carregar/atualizar os dados
- **Indicador de progresso**: Mostra o andamento da sincronizacao

#### 4. Alterações em arquivos existentes

- **App.tsx**: Nova rota `/dashboard/comercial/ibge`
- **AppSidebar.tsx**: Novo item "Dados IBGE" no menu do modulo Comercial (com icone MapPin)
- **ComercialModule.tsx**: Novo card com metricas de municipios e link para a pagina

### Detalhes técnicos

- A API do IBGE é **publica** e **gratuita**, não requer API key
- Os dados de populacao são estimativas anuais (disponivel até 2025)
- Os dados de PIB municipal são publicados com atraso de ~2 anos (disponivel até 2021)
- O PIB per capita será calculado dividindo PIB (em mil reais) pela populacao e multiplicando por 1000
- A sincronizacao completa pode levar 30-60 segundos devido ao volume de dados
- Os dados serão salvos via upsert, permitindo re-sincronizacoes sem duplicacao

