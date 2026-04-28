## Objetivo

1. Tornar o botão "Sync Fonte Oficial" mais inteligente: antes de consumir crédito Apify, validar se o handle vinculado bate com o perfil da empresa (nicho/segmento) e confirmar com o usuário caso haja divergência.
2. Permitir enriquecer em lote (avatar, bio, métricas) todos os influenciadores monitorados via Apify, a partir do Dashboard.

---

## Mudanças

### 1. Botão "Sync Fonte Oficial" com confirmação dupla

**Arquivo**: `src/components/marketing/influencers/InfluencerProfile360.tsx`

Trocar o `handleApifySync` direto por um fluxo em 2 passos:

**Passo A — Pré-check local (sem custo Apify)**
- Carregar o `influencer_company_profile` ativo (segment, target_audience, products_services, brand_values).
- Carregar o influencer atual (username, display_name, notes/bio, categoria se houver).
- Chamar uma nova edge function leve `validate-influencer-fit` que envia esses dois objetos ao Lovable AI (`google/gemini-3-flash-preview`, tool calling) e retorna:
  ```json
  { "fit_score": 0-100, "fit_label": "compatível|parcial|divergente", "reasons": ["..."], "handle_mismatch": false }
  ```
  (handle_mismatch já calculado no client comparando o username atual com qualquer alteração manual feita no card).

**Passo B — Modal de confirmação**
- Se `fit_label === "compatível"` e sem mismatch → segue direto para o sync.
- Caso contrário → abrir `AlertDialog` mostrando:
  - Handle atual vs. esperado (se diferente)
  - Score de compatibilidade + motivos retornados pela IA
  - Botões: "Cancelar" / "Sincronizar mesmo assim"
- Apenas após confirmação, dispara `apify-sync-influencer` (lógica atual preservada).

### 2. Enriquecimento em lote no Dashboard

**Arquivo**: `src/components/marketing/influencers/InfluencerDashboard.tsx`

Adicionar botão "Enriquecer todos via Apify" próximo às ações do header.

- Ao clicar, abre confirmação informando quantos perfis serão sincronizados e estimativa de runs Apify.
- Lista todos os influencers `status='active'` da equipe.
- Dispara nova edge function `apify-bulk-enrich` que processa em background:
  - Filtra influencers e itera com concorrência limitada (3 paralelos).
  - Para cada um, reaproveita a lógica de `apify-sync-influencer` (perfil + 12 posts + comentários dos 5 mais recentes).
  - Atualiza `avatar_url`, `display_name`, `followers_count`, `engagement_rate`, `bio`, `category`, `last_synced_at`.
- Frontend mostra `Progress` com X/Y processados via polling em `apify_run_log` (ou Realtime) filtrando por `batch_id` retornado.

### 3. Backend / Schema

**Edge functions novas:**
- `supabase/functions/validate-influencer-fit/index.ts` — Lovable AI, tool-calling, retorna fit + razões. Sem custo Apify.
- `supabase/functions/apify-bulk-enrich/index.ts` — recebe `{ influencer_ids?: string[], only_missing?: boolean }`, gera `batch_id`, chama internamente `apify-sync-influencer` por item respeitando concorrência e gravando progresso em `apify_run_log` com `batch_id`.

**Migração:**
- Adicionar coluna `batch_id uuid` (nullable) em `apify_run_log` + índice `(batch_id, created_at)` para o polling de progresso.

### 4. UX

- Toast "Validando compatibilidade..." durante o pré-check.
- AlertDialog com badge colorido (verde/amarelo/vermelho) conforme `fit_label`.
- Botão de bulk com ícone `Sparkles` e contador de processados em tempo real.
- Ambas as ações respeitam erros 402/429 do Lovable AI/Apify e exibem toasts claros.

---

## Não faz parte deste plano
- Não altera a lógica interna de scraping (já estável).
- Não mexe no Autopilot nem no fluxo de descoberta.
- Não cria cron — execução do bulk é manual sob demanda.