

# Análise de Posicionamento de Marca vs Concorrentes via IA

## Objetivo

Criar um painel de "Análise de Posicionamento" onde o agente de IA pesquisa informações públicas sobre a marca da empresa (`our_brands`) e seus concorrentes cadastrados (`competitors`), gerando uma análise comparativa de posicionamento de mercado.

## Dados Existentes

- **`our_brands`**: marcas próprias com `brand_name`, `description`, `logo_url`
- **`competitors`**: concorrentes com `name`, `brand`, `category`, `threat_level`, `market_share`
- **`competitor_intelligence`**: dados de campo (preços, shelf share, promoções)

## Abordagem

### 1. Tabela `brand_positioning_analyses` (migração)

Persiste os resultados das análises para consulta futura:
- `id`, `user_id`, `our_brand_id` (ref `our_brands`), `competitor_ids` (UUID[])
- `analysis_result` (JSONB) — posicionamento, pontos fortes/fracos, comparativo
- `sources_searched` (TEXT[]) — canais pesquisados
- `created_at`
- RLS por `user_id`

### 2. Edge Function `analyze-brand-positioning`

- Recebe `brand_id` (nossa marca) e opcionalmente `competitor_ids`
- Busca dados da marca e concorrentes no banco
- Usa Lovable AI (Gemini 2.5 Pro) com pesquisa web via prompt detalhado para:
  - Pesquisar presença digital (site, redes sociais, marketplaces, imprensa)
  - Analisar posicionamento de preço, público-alvo, proposta de valor
  - Comparar com cada concorrente nos mesmos eixos
  - Gerar scores de posicionamento e recomendações estratégicas
- Retorna análise estruturada via tool calling
- Persiste resultado na tabela `brand_positioning_analyses`

### 3. Componente `BrandPositioningPanel.tsx`

Painel visual com:
- Seletor de marca própria + concorrentes a comparar
- Botão "Analisar Posicionamento"
- Radar chart comparativo (Preço, Qualidade, Presença Digital, Inovação, Brand Awareness)
- Cards lado a lado: Nossa Marca vs Concorrente com pontos fortes/fracos
- Timeline de análises anteriores
- Fontes pesquisadas listadas

### 4. Integração

- Adicionar o painel na página de Concorrentes (`TradeCompetitors.tsx`) como uma nova seção ou aba
- Acessível via botão "Análise de Posicionamento" no topo

## Arquivos

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar tabela `brand_positioning_analyses` |
| `supabase/functions/analyze-brand-positioning/index.ts` | Criar — pesquisa IA + persistência |
| `src/components/trade/BrandPositioningPanel.tsx` | Criar — painel visual com radar chart e comparativo |
| `src/pages/TradeCompetitors.tsx` | Modificar — integrar o painel |

