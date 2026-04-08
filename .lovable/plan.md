

# Atualização em Massa dos Dados de Influenciadores via IA

## Problema

Os 30 influenciadores monitorados possuem dados desatualizados (seguidores, engajamento, região). Não existe uma action para atualizar todos de uma vez com dados reais da web.

## Solução

Criar uma action `refresh_all_data` no `influencer-autopilot` que itera por todos os influenciadores ativos do usuário, consulta a IA (GPT-5.2 + Google Search) para obter dados atualizados da web, e atualiza o banco de dados. Adicionar um botão no dashboard para disparar essa atualização.

## Mudanças

### 1. Edge Function — nova action `refresh_all_data`

Arquivo: `supabase/functions/influencer-autopilot/index.ts`

- Nova action que carrega todos influenciadores ativos do usuário
- Agrupa em lotes de 10 para enviar à IA (evitar prompt muito longo)
- Para cada lote, envia username + platform e pede à IA para buscar na web: `followers_count`, `engagement_rate`, `regiao`, `uf`
- Atualiza cada influenciador no banco com os dados retornados
- Retorna resumo de quantos foram atualizados e quais mudaram

Prompt da IA (por lote):
```
Para cada influenciador abaixo, busque na web os dados ATUAIS:
1. @username (platform)
2. @username2 (platform)
...

Retorne JSON array com:
- username, platform, followers_count (atual), engagement_rate (%), regiao, uf
```

### 2. Botão no Dashboard

Arquivo: `src/components/marketing/influencers/InfluencerDashboard.tsx`

- Adicionar botão "Atualizar Dados (IA)" na barra de ações
- Ao clicar, chama `influencer-autopilot` com action `refresh_all_data`
- Mostra loading e toast com resultado (ex: "25 influenciadores atualizados")
- Recarrega a lista após conclusão

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/influencer-autopilot/index.ts` | Adicionar action `refresh_all_data` |
| `src/components/marketing/influencers/InfluencerDashboard.tsx` | Adicionar botão de atualização em massa |

