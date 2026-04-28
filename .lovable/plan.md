## Diagnóstico — quais dados são confiáveis hoje

Mapeei o que cada fonte realmente entrega no módulo:

| Bloco do Profile 360 | Fonte atual | Confiabilidade | Observação |
|---|---|---|---|
| Dados de perfil (followers, ER, avatar, bio, verificado, categoria) | Apify (`apify-influencer-search` enrich) | **Alta** | Já normalizado e cacheado em `discovered_profiles`. |
| Últimos posts (12) com likes/comentários/thumbnail | Apify enrich (IG/TikTok) | **Alta** | Vêm no mesmo run do enrich, mas hoje **só são gravados em `influencer_posts` quando o usuário clica em "Sync Fonte Oficial"**. |
| Conteúdo recente extra (até 20 posts) | `fetch-influencer-content` → Phyllo, com **fallback para IA** | **Baixa** | O fallback IA gera posts fictícios com `picsum.photos`. É a principal fonte de dados não confiáveis. |
| Comentários | Phyllo (se conectado) ou IA | **Baixa** | Mesma função, mesmo fallback IA. |
| Sentimento dos comentários | `analyze-comments-sentiment` (Gemini sobre `influencer_comments`) | **Média** | A análise é boa, mas só vale se os comentários forem reais (Phyllo). Sobre comentários inventados, vira ruído. |
| Reputação / Brand Safety | `research-influencer-reputation` (Gemini grounded) | **Média‑alta** | Independe de Apify/Phyllo. |
| Audiência (demografia, países) | Phyllo (`phyllo-proxy`) | **Alta quando Phyllo responde** | Nunca veio de IA, então OK. |

### Conclusão

- **Confiável para puxar do Apify hoje:** perfil + últimos 12 posts (com likes, comentários, thumbnail, data, tipo, caption, URL). No TikTok também temos `shares`.
- **Não conseguimos puxar do Apify com o setup atual:** comentários por post (precisa de outro actor), demografia de audiência (não existe — fica em Phyllo), reputação fora das redes (fica em Gemini grounded).
- **Falha principal:** o enrich do Apify já traz os 12 posts, mas o pipeline atual descarta isso ao adicionar o influencer e depois chama `fetch-influencer-content`, que cai no fallback de IA e popula o banco com posts fake.

---

## Plano de correção — "ao monitorar, carrega tudo de verdade"

### 1. Persistir posts do Apify já no momento de adicionar/monitorar
Atualizar `apify-sync-influencer` para ser o **único caminho** de ingestão de posts. Quando um influencer é criado via `AddInfluencerDialog`, disparar `apify-sync-influencer` automaticamente em vez de marcar como pendente. Isso já popula `influencers` + `influencer_posts` com dados reais (Apify) em uma única chamada.

### 2. Adicionar coleta de comentários reais via Apify
Criar um novo actor wrapper em `apify-sync-influencer` para Instagram:
- `apify/instagram-comment-scraper` — recebe os `post_url` dos 5 posts mais recentes e devolve até 30 comentários por post.
- Para TikTok: `clockworks/tiktok-comments-scraper`.
- Persistir em `influencer_comments` com `source = "apify"` (campo já existe).
- Rodar em background depois do enrich (não bloqueia a UI), com budget de 60s e log em `apify_run_log`.

### 3. Disparar análise de sentimento automaticamente
Após gravar os comentários reais, encadear `analyze-comments-sentiment` (já existe e funciona bem) dentro do mesmo fluxo, para que o card de Sentimento já apareça populado quando o usuário abrir o 360.

### 4. Marcar e esconder dados sintéticos antigos
- Adicionar coluna `data_source` em `influencer_posts` e `influencer_comments` (se ainda não existir do lado certo) — valores: `apify`, `phyllo`, `ai_fallback`.
- Em `fetch-influencer-content`, **remover o fallback de IA** que gera posts com `picsum.photos`. Se Phyllo não responder e o Apify não tiver dados, retornar vazio com mensagem "sem conteúdo coletado ainda" em vez de inventar.
- Na UI (`InfluencerProfile360` aba Conteúdo), filtrar qualquer registro com `data_source = 'ai_fallback'` legado e mostrar badge "Apify" / "Phyllo" no canto do card de post.

### 5. Botão "Coletar Conteúdo" passa a ser um refresh real
Renomear para "Atualizar do Apify" e fazer dele um atalho para `apify-sync-influencer` + recoleta de comentários, com indicador de última sincronização (`last_synced_at` já existe).

### 6. Telemetria mínima
Aproveitar `apify_run_log` para mostrar no header do 360 a data/hora da última coleta de **perfil**, **posts** e **comentários** separadamente, para o usuário saber o que está fresco.

---

## Arquivos afetados

**Edge Functions**
- `supabase/functions/apify-sync-influencer/index.ts` — adicionar etapa de comentários e encadear análise de sentimento.
- `supabase/functions/fetch-influencer-content/index.ts` — remover fallback IA; manter só o caminho Phyllo.
- `supabase/functions/analyze-comments-sentiment/index.ts` — nenhuma mudança, só passa a ser chamada em cadeia.

**Frontend**
- `src/components/marketing/influencers/AddInfluencerDialog.tsx` — disparar sync Apify automático ao criar.
- `src/components/marketing/influencers/InfluencerProfile360.tsx` — renomear ação, mostrar badges de fonte, esconder posts `ai_fallback` legados, exibir timestamps de coleta.

**Banco (migration)**
- Adicionar `data_source text` em `influencer_posts` e `influencer_comments` (com default e backfill).
- Garantir índice em `influencer_comments(post_id, sentiment)` para a análise iterar rápido.

---

## Pontos para você decidir antes de eu implementar

1. **Comentários do Apify custam ~1 actor‑run extra por post**. Posso limitar aos **5 posts mais recentes** (≈150 comentários) por sync, ou prefere algo maior/menor?
2. **Remover totalmente o fallback de IA** em `fetch-influencer-content` é o caminho mais limpo, mas vai deixar perfis sem Phyllo nem Apify temporariamente vazios. Confirma que tudo bem?
3. Quer que o sync automático no `AddInfluencerDialog` seja **bloqueante** (usuário espera ~10s e já vê o perfil completo) ou **assíncrono** (cria o influencer na hora e popula em background)?