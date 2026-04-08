

# Persistir Pesquisa de Reputação para Histórico Comparativo

## Problema

A pesquisa de reputação (`research-influencer-reputation`) retorna dados apenas em memória — não salva no banco. Ao fechar e reabrir o perfil, os dados somem. Impossível comparar evolução ao longo do tempo.

## Solução

### 1. Edge Function — Salvar resultado no banco

Modificar `research-influencer-reputation/index.ts` para:
- Receber `influencer_id` do frontend
- Após gerar o resultado da IA, inserir em `influencer_analyses` com `analysis_type: "reputation"` usando service role client
- Retornar o resultado normalmente

### 2. Frontend — Carregar histórico e exibir comparativo

Modificar `InfluencerProfile360.tsx`:
- Na aba Reputação, carregar todas as análises `analysis_type = "reputation"` do influenciador, ordenadas por data
- Exibir a mais recente como atual
- Adicionar seção **"Histórico de Reputação"** com:
  - Lista de pesquisas anteriores com data e brand_safety_score
  - Mini gráfico de evolução do score ao longo do tempo (sparkline)
  - Indicador de tendência (subiu/desceu vs pesquisa anterior)
  - Botão para expandir e ver detalhes de cada pesquisa passada

### 3. Frontend — Enviar `influencer_id`

Atualizar a chamada `handleResearchReputation` para enviar `influencer_id` no body.

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/research-influencer-reputation/index.ts` | Modificar — salvar resultado em `influencer_analyses` |
| `src/components/marketing/influencers/InfluencerProfile360.tsx` | Modificar — enviar `influencer_id`, carregar histórico, UI comparativa |

