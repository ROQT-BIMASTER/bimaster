

# Corrigir Conteúdo de Influenciadores — Carregar Dados do Ano Atual

## Problema

O sistema de coleta de conteúdo (`fetch-influencer-content`) usa IA como fallback para gerar posts, mas o prompt não especifica o ano atual. A IA pode gerar posts com datas antigas. Além disso, posts antigos já salvos no banco são exibidos sem distinção.

## Solução

### 1. Edge Function — Forçar ano atual no prompt da IA

Modificar `supabase/functions/fetch-influencer-content/index.ts`:
- Adicionar data atual no prompt do sistema: `"A data de hoje é 2026-04-08. Gere posts RECENTES, dos últimos 30-60 dias."`
- Instruir a IA a usar datas entre janeiro e abril de 2026

### 2. Edge Function — Limpar posts antigos antes de coletar novos

Antes de inserir novos posts, deletar os posts anteriores do mesmo influenciador para evitar acúmulo de dados desatualizados. Isso garante que a aba Conteúdo sempre mostra o snapshot mais recente.

### 3. Frontend — Exibir indicador de atualidade

No `InfluencerProfile360.tsx`, na aba Conteúdo:
- Mostrar badge "Última coleta: DD/MM/AAAA" baseado no `created_at` mais recente dos posts
- Ordenar posts por `posted_at` descending (já feito no `loadPosts`)

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/fetch-influencer-content/index.ts` | Modificar — data atual no prompt, limpar posts antigos antes de inserir |
| `src/components/marketing/influencers/InfluencerProfile360.tsx` | Modificar — badge de última coleta na aba Conteúdo |

