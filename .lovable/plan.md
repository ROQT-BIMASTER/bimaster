

# Correção de Dados de Seguidores — Usar IA com Pesquisa Web

## Problema

Os dados de seguidores dos influenciadores estão desatualizados porque são gerados por estimativa da IA (Gemini Flash), cujo conhecimento tem um corte temporal. Exemplo: Camila Loures tem 18M de seguidores, mas o sistema carregou 14M.

Isso afeta:
- `discover-influencers` (descoberta)
- `influencer-autopilot` (sugestões e discovery)
- `AddInfluencerDialog` (cadastro manual sem validação)

## Solução

Trocar o modelo usado nas funções de descoberta de influenciadores para **`google/gemini-2.5-pro`** com **grounding via pesquisa web**, que tem acesso a dados mais recentes. Além disso, reforçar no prompt que os dados devem ser os mais atuais possíveis.

O Gemini 2.5 Pro com o parâmetro `tools: [{ googleSearch: {} }]` permite que a IA consulte a web em tempo real para obter contagens de seguidores atualizadas.

## Mudanças

### 1. Atualizar `discover-influencers/index.ts`

- Trocar modelo de `google/gemini-2.5-flash` para `google/gemini-2.5-pro`
- Adicionar `tools: [{ googleSearch: {} }]` no request body para habilitar pesquisa web
- Reforçar no prompt: "Consulte dados ATUAIS da web. Não use estimativas de memória. Verifique contagens de seguidores reais e atualizadas."

### 2. Atualizar `influencer-autopilot/index.ts` — actions `discover` e `suggest`

- Trocar `AI_MODEL` para `google/gemini-2.5-pro` nas chamadas de descoberta/sugestão
- Adicionar `tools: [{ googleSearch: {} }]`
- Reforçar prompt com instrução para buscar dados atuais da web
- Manter `google/gemini-2.5-flash` para actions que não precisam de dados em tempo real (ranking, análise de audiência)

### 3. Melhorar prompts de descoberta

Adicionar instrução explícita nos prompts:
```
DADOS OBRIGATORIAMENTE ATUALIZADOS:
- Use pesquisa na web para obter a contagem ATUAL de seguidores
- NÃO estime com base em conhecimento prévio — consulte fontes recentes
- Inclua a data aproximada da última verificação
```

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/discover-influencers/index.ts` | Modificar — modelo Pro + Google Search grounding + prompt atualizado |
| `supabase/functions/influencer-autopilot/index.ts` | Modificar — modelo Pro + Google Search para actions discover/suggest |

