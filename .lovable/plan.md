
## Mapa Comercial de Ultima Geracno com Google Maps API

### Contexto dos Dados

O sistema possui uma base rica para visualizacao geografica:
- **27.350 clientes** com CNPJ valido, distribuidos em **2.489+ municipios** de todos os estados
- **233 prospects** em pipeline de vendas
- **27 leads minerados** (ja com coordenadas do Google Places)
- Dados de **risco de inatividade** (10.052 inativos >180 dias, representando R$43M+ em potencial)
- **Dados IBGE** cruzados: populacao, PIB, microrregioes

### Estrategia: "War Room Geografico"

O mapa nao sera apenas uma visualizacao -- sera um **centro de comando territorial** que revela oportunidades ocultas nos dados. A ideia e que um diretor comercial abra o mapa e em segundos enxergue:

1. **Onde estamos perdendo clientes** (manchas vermelhas de inatividade)
2. **Onde temos forca** (clusters azuis de clientes ativos)
3. **Onde deveríamos estar** (vazios geograficos com potencial IBGE)
4. **Pipeline em andamento** (prospects/leads sobrepondo o territorio)

### O que sera implementado

**1. Migracao Mapbox para Google Maps**

- Substituir `mapbox-gl` pela biblioteca `@vis.gl/react-google-maps` (wrapper React oficial do Google)
- Reutilizar a `GOOGLE_PLACES_API_KEY` ja configurada (mesmo secret, basta habilitar "Maps JavaScript API" e "Visualization" no Google Cloud Console)
- Criar uma Edge Function `get-google-maps-key` para servir a chave de forma segura
- Remover dependencia do Mapbox (`mapbox-gl`, `get-mapbox-token`, `geocode-address`)

**2. Geocodificacao em Lote (Persistente)**

- Adicionar colunas `latitude` e `longitude` nas tabelas `clientes` e `prospects`
- Criar Edge Function `geocode-batch` que usa a API de Geocoding do Google (incluida no plano gratuito do Places) para processar ~200 registros por execucao
- A geocodificacao acontece **uma vez** por registro (quando latitude e null) -- nao toda vez que o mapa abre
- Trigger automatico: quando um cliente novo chega via importacao diaria e a trigger de normalizacao preenche `ibge_municipio_id`, o sistema ja prepara o registro para geocodificacao

**3. Camadas do Mapa (Multi-Layer)**

| Camada | Dados | Visual | Insight |
|--------|-------|--------|---------|
| **Clientes Ativos** | Compraram nos ultimos 60 dias | Clusters azuis/verdes | Forca comercial |
| **Clientes em Risco** | 60-180 dias sem compra | Clusters amarelos/laranjas | Urgencia de reativacao |
| **Clientes Inativos** | >180 dias | Clusters vermelhos | Territorio perdido |
| **Prospects** | Pipeline de vendas | Marcadores por status (cores do funil) | Expansao em andamento |
| **Leads Minerados** | Google Places | Marcadores roxos | Oportunidades descobertas |
| **Heatmap de Densidade** | Todos os clientes | Gradiente de calor | Concentracao geografica |
| **Vazios de Mercado** | Municipios IBGE sem clientes com populacao >50k | Circulos cinza tracejados | Potencial inexplorado |

**4. Painel Lateral Dinamico (Viewport Analytics)**

Ao navegar/zoomear o mapa, um painel lateral atualiza em tempo real:
- Total de clientes visiveis na area
- Faturamento potencial (soma de `valor_ultima_compra`)
- Distribuicao por nivel de risco (barra empilhada)
- Top 5 clientes por valor na viewport
- Botao "Exportar Lista" da area visivel

**5. Filtros Avancados**

- Filial (empresa_id)
- Regiao (Norte, Nordeste, Sudeste, Sul, Centro-Oeste)
- UF especifica
- Nivel de Risco (Ativo, Atencao, Alerta, Critico, Inativo)
- Faixa de Ticket (ate R$1k, R$1k-5k, R$5k-20k, >R$20k)
- Toggles para ligar/desligar cada camada

**6. Popup Rico (Customer 360 no Mapa)**

Ao clicar num ponto/cluster:
- Nome, CNPJ, codigo ERP
- Telefone/WhatsApp/Email clicaveis
- Dias sem compra + Badge de risco
- Valor ultima compra + Valor maior compra
- Momentum de gasto (barra visual)
- Comprador responsavel
- Botao "Ver Detalhes" que abre o ClienteDetailSheet existente

**7. Normalizacao Automatica (Trigger)**

- Trigger `BEFORE INSERT OR UPDATE` na tabela `clientes` para normalizar automaticamente `ibge_municipio_id` e `cidade_normalizada` em cada registro novo ou alterado
- Isso garante que a carga diaria do n8n ja chega normalizada sem intervencao manual

### Detalhes Tecnicos

**Migracao SQL:**

```sql
-- Colunas de coordenadas
ALTER TABLE clientes 
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

CREATE INDEX idx_clientes_coords 
  ON clientes(latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX idx_prospects_coords 
  ON prospects(latitude, longitude) WHERE latitude IS NOT NULL;

-- Trigger de normalizacao automatica
CREATE OR REPLACE FUNCTION fn_normalizar_cliente_individual()
RETURNS trigger AS $$ ... $$;

CREATE TRIGGER tr_normalizar_municipio_cliente
  BEFORE INSERT OR UPDATE ON clientes
  FOR EACH ROW
  EXECUTE FUNCTION fn_normalizar_cliente_individual();
```

**Edge Functions novas:**
- `get-google-maps-key/index.ts` -- serve a chave do Google Maps (reutiliza `GOOGLE_PLACES_API_KEY`)
- `geocode-batch/index.ts` -- geocodifica em lote clientes/prospects sem coordenadas via Google Geocoding API

**Componentes React novos:**

| Componente | Funcao |
|------------|--------|
| `src/components/comercial/mapa/CommercialMap.tsx` | Componente principal do mapa com Google Maps |
| `src/components/comercial/mapa/MapFilters.tsx` | Barra de filtros e toggles de camada |
| `src/components/comercial/mapa/MapSidebar.tsx` | Painel lateral com KPIs da viewport |
| `src/components/comercial/mapa/MapLegend.tsx` | Legenda interativa das camadas |
| `src/components/comercial/mapa/MapMarkerPopup.tsx` | Popup rico com dados do cliente |
| `src/hooks/useCommercialMapData.ts` | Hook para carregar dados geolocalizados |
| `src/pages/ComercialMapa.tsx` | Nova pagina do mapa no modulo comercial |

**Rota nova:**
- `/dashboard/comercial/mapa` -- Mapa Comercial (dentro do modulo comercial, nao no modulo de prospects)

**Dependencia nova:**
- `@vis.gl/react-google-maps` -- Wrapper React oficial do Google Maps

**Requisito no Google Cloud Console (acao do usuario):**
A `GOOGLE_PLACES_API_KEY` ja esta configurada. O usuario precisa habilitar dois servicos adicionais no Google Cloud Console:
- "Maps JavaScript API"
- "Geocoding API"

### Sequencia de Implementacao

1. Migracao SQL (colunas lat/lng + trigger de normalizacao)
2. Edge Function `get-google-maps-key`
3. Edge Function `geocode-batch`
4. Hook `useCommercialMapData` para buscar dados
5. Componentes do mapa (CommercialMap, MapFilters, MapSidebar, MapLegend, MapMarkerPopup)
6. Pagina `ComercialMapa` + rota no App.tsx + link no ComercialModule
7. Testar geocodificacao batch e visualizacao

### Resultado Esperado

O diretor comercial abre o mapa e ve imediatamente:
- Um mapa do Brasil com **clusters coloridos** indicando saude da carteira
- **Manchas de calor** mostrando concentracao de negocios
- **Circulos vazios** em cidades grandes onde nao ha presenca
- Ao clicar numa regiao, o painel lateral mostra os numeros daquela area
- Filtrar por "Critico" e ver apenas clientes que precisam de atencao urgente, com WhatsApp a um clique
