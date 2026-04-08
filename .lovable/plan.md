

# Correção: Parâmetro `reasoning` não suportado pelo AI Gateway

## Diagnóstico

Os logs mostram que **todas as chamadas de IA estão falhando** com erro 400:

```
Unknown parameter: 'reasoning'
```

O parâmetro `reasoning: { effort: "high" }` não é suportado pelo Lovable AI Gateway. Isso significa que nenhuma atualização de dados está funcionando — discovery, audiência, refresh e ranking estão todos retornando erro.

## Solução

Remover o parâmetro `reasoning` de todas as chamadas em 2 arquivos:

### 1. `supabase/functions/discover-influencers/index.ts`
- Linha 94: remover `reasoning: { effort: "high" }`

### 2. `supabase/functions/influencer-autopilot/index.ts`
- Linha 244: remover `reasoning: { effort: "high" }` (discover)
- Linha 374: remover `reasoning: { effort: "high" }` (audience)
- Linha 470: remover `reasoning: { effort: "high" }` (refresh_all_data)
- Linha 670: remover `reasoning: { effort: "medium" }` (ranking)

Manter `tools: [{ googleSearch: {} }]` onde já existe — esse parâmetro é o que garante dados atualizados da web.

## Impacto

Após a correção, todas as chamadas de IA voltarão a funcionar e os dados de seguidores serão atualizados com valores reais da web via Google Search grounding.

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/discover-influencers/index.ts` | Remover `reasoning` |
| `supabase/functions/influencer-autopilot/index.ts` | Remover `reasoning` (4 ocorrências) |

