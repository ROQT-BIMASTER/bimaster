

## Mineracao de Leads com Google Places API (GRATUITO)

### Custo: ZERO

Desde marco de 2025, o Google substituiu o credito de $200/mes por cotas gratuitas por SKU:
- **Text Search (Basic)** = categoria **Pro** = **5.000 chamadas gratuitas/mes**
- Cada busca completa de 200 resultados = ~10 chamadas (10 paginas de 20)
- **500 buscas completas de 200 resultados por mes = totalmente gratuito**
- Basta usar apenas campos Basic no fieldMask (nome, endereco, telefone, rating, website)

Campos **Basic** (gratuitos): `displayName`, `formattedAddress`, `internationalPhoneNumber`, `nationalPhoneNumber`, `websiteUri`, `rating`, `userRatingCount`, `types`, `location`, `id`

Campos **Pro/Enterprise** (pagos): `reviews`, `regularOpeningHours`, `priceLevel` -- estes NAO serao usados.

---

### O que sera criado

#### 1. Tabela `leads_minerados`

Armazena leads encontrados pelo Google Places antes de serem convertidos em prospects.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid (PK) | Identificador unico |
| google_place_id | text (unique) | ID do Google Places para evitar duplicatas |
| nome | text | Nome do estabelecimento |
| telefone | text | Telefone nacional |
| telefone_internacional | text | Telefone formato internacional |
| endereco | text | Endereco formatado completo |
| cidade | text | Cidade extraida do endereco |
| uf | text | Estado |
| cep | text | CEP |
| latitude | numeric | Coordenada |
| longitude | numeric | Coordenada |
| website | text | URL do site |
| rating | numeric | Avaliacao Google (0-5) |
| total_avaliacoes | integer | Quantidade de avaliacoes |
| tipos | text[] | Tipos de negocio (array) |
| status | text | novo, qualificado, descartado, convertido |
| busca_query | text | Texto usado na busca que encontrou |
| busca_regiao | text | Regiao/cidade da busca |
| convertido_prospect_id | uuid | FK para prospects (quando convertido) |
| cnpj | text | CNPJ (preenchido manualmente ou via enriquecimento) |
| observacoes | text | Notas do usuario |
| minerado_por | uuid (FK auth) | Usuario que realizou a mineracao |
| created_at | timestamptz | Data da mineracao |
| updated_at | timestamptz | Ultima atualizacao |

RLS: leitura e escrita para usuarios autenticados.

#### 2. Edge Function `google-places-search`

Chama o Google Places API v1 (New) usando **Text Search** com paginacao automatica para carregar ate 200 resultados.

```text
Fluxo de execucao:
+------------------+     +-------------------+     +--------------------+
| Frontend envia:  | --> | Edge Function     | --> | Google Places API  |
| - query          |     | monta POST para   |     | POST /v1/places:   |
| - cidade/UF      |     | searchText com    |     | searchText         |
| - maxResults     |     | fieldMask BASIC   |     | (ate 20 por pag)   |
+------------------+     +-------------------+     +--------------------+
                                                          |
                          +-------------------+     +--------------------+
                          | 4. Salvar leads   | <-- | 3. Paginar com     |
                          | via upsert por    |     | nextPageToken ate  |
                          | google_place_id   |     | atingir 200 ou fim |
                          +-------------------+     +--------------------+
```

**Detalhes tecnicos**:
- Endpoint: `POST https://places.googleapis.com/v1/places:searchText`
- Header: `X-Goog-Api-Key` com a API key
- Header: `X-Goog-FieldMask` apenas com campos Basic (gratuitos):
  `places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.location,places.addressComponents`
- Body: `textQuery`, `regionCode: "BR"`, `languageCode: "pt-BR"`, `maxResultCount: 20`
- Paginacao: usa `pageToken` do response para buscar proxima pagina
- Repete ate atingir o limite solicitado (max 200) ou nao ter mais pageToken
- Salva no banco via upsert usando `google_place_id` como chave unica
- Extrai cidade/UF dos `addressComponents` retornados pelo Google

#### 3. Nova pagina "Mineracao de Leads" em `/dashboard/comercial/mineracao`

**Area de busca (topo)**:
- Campo de texto para query livre (ex: "supermercados", "distribuidora de alimentos")
- Select de Estado (usando dados `ibge_estados` ja carregados)
- Select de Cidade (filtrado por estado, usando `ibge_municipios`)
- Slider ou select de quantidade maxima (20, 60, 100, 200)
- Botao "Minerar Leads" com indicador de progresso

**Cards de resumo**:
- Total minerados (todos os tempos)
- Novos (nao triados)
- Qualificados
- Convertidos em prospects

**Tabela de leads minerados**:
- Colunas: Nome, Telefone, Cidade/UF, Rating (estrelas), Avaliacoes, Website, Status, Acoes
- Filtros: por status (novo/qualificado/descartado/convertido), por cidade, por rating minimo
- Selecao multipla com checkbox
- Acoes por lead:
  - Ver detalhes (dialog completo)
  - Qualificar / Descartar
  - Converter em Prospect (cria registro na tabela `prospects` com dados mapeados)
  - Copiar telefone
- Acoes em lote:
  - Converter selecionados em Prospects
  - Qualificar selecionados
  - Descartar selecionados

**Conversao para Prospect**: ao converter, mapeia os campos assim:

| Lead minerado | Prospect |
|---------------|----------|
| nome | nome_empresa / nome_fantasia |
| telefone | telefone |
| endereco | endereco |
| cidade | municipio |
| uf | uf |
| cep | cep |
| website | url_company_page |
| cnpj | cnpj |
| tipos | segmento (primeiro tipo traduzido) |

O lead recebe status "convertido" e o `convertido_prospect_id` aponta para o novo prospect.

#### 4. Alteracoes em arquivos existentes

- **App.tsx**: Nova rota `/dashboard/comercial/mineracao` com lazy load
- **AppSidebar.tsx**: Novo item "Mineracao de Leads" no menu Comercial (icone Search ou Pickaxe)
- **ComercialModule.tsx**: Novo card de acesso rapido e link na categoria "Prospecao" nos modulos secundarios
- **supabase/config.toml**: Registro da nova edge function `google-places-search` com `verify_jwt = true`

#### 5. Pre-requisito: API Key

Sera solicitada a configuracao da secret **GOOGLE_PLACES_API_KEY** antes de prosseguir com o codigo. Para obter:
1. Acessar console.cloud.google.com
2. Ativar "Places API (New)"
3. Criar uma API Key

A cota gratuita de 5.000 chamadas/mes (Pro tier) cobre amplamente o uso previsto sem nenhum custo.

### Arquivos a criar/modificar

| Arquivo | Acao |
|---------|------|
| `supabase/functions/google-places-search/index.ts` | Criar (edge function) |
| `src/pages/LeadMining.tsx` | Criar (pagina de mineracao) |
| `src/hooks/useLeadMining.ts` | Criar (hook de dados e logica) |
| `src/App.tsx` | Editar (nova rota) |
| `src/components/dashboard/AppSidebar.tsx` | Editar (novo item menu) |
| `src/pages/modules/ComercialModule.tsx` | Editar (card de acesso) |
| `supabase/config.toml` | Editar (registrar edge function) |
| Migracao SQL | Criar tabela `leads_minerados` |

