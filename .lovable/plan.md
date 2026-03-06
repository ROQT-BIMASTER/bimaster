

## Diagnóstico Real

Os logs mostram que a análise **completa sem erro**, mas gera exatamente os **mínimos** definidos no prompt (10 insights, 8 tasks, 5 risks, 10 highlights). O Gemini está tratando os mínimos como **metas**, não como pisos. A ata com 5.931 caracteres para uma reunião de 11 minutos também é rasa.

O problema NÃO é timeout — as duas fases completam em ~100s total. O problema é que o modelo **para de gerar** quando atinge os números mínimos.

## Solução: Prompt Engineering + Modelo mais agressivo

### Alterações em `supabase/functions/meeting-analyze/index.ts`

**1. Mudar a estratégia de prompt — remover mínimos fixos, usar proporção**

Em vez de "MÍNIMO 10 insights", usar:
- "Extraia 1 insight para cada 2-3 minutos de reunião"  
- "Uma reunião de 11 minutos deve gerar 15-25 insights, 10-15 tarefas, 5-10 riscos"
- "Gere insights até esgotar todo o conteúdo da transcrição"

**2. Adicionar instrução anti-lazy ao prompt**

Instruir explicitamente:
- "NÃO pare nos primeiros 10 itens. Continue extraindo até que não haja mais nada relevante."
- "Releia cada parágrafo da transcrição e verifique se extraiu tudo."
- "Prefira MAIS itens com granularidade fina do que MENOS itens genéricos."

**3. Usar `google/gemini-2.5-flash` para Phase 2**

O Gemini 2.5 Pro é mais "conservador" e tende a parar cedo. O Flash é mais barato e mais rápido, permitindo:
- Aumentar o `max_tokens` implícito (gasta menos por token)
- Potencialmente gerar mais conteúdo no mesmo tempo

**4. Adicionar `temperature: 0.3` para mais variação**

Atualmente não há temperature definido, o que usa o default (provavelmente 1.0 ou 0.7). Baixar para 0.3 faz o modelo ser mais determinístico e completo.

**5. Fase 1: Exigir ata proporcional**

Para a ata, adicionar:
- "A ata deve ter no MÍNIMO 500 palavras por cada 5 minutos de reunião"
- "Cada tema discutido deve ter 3-5 parágrafos de detalhamento"

### Resumo das alterações

| O que | De | Para |
|---|---|---|
| Prompt Fase 2 | "MÍNIMO 10 insights" | "1 insight por cada 1-2 min, extraia ATÉ ESGOTAR" |
| Modelo Fase 2 | `gemini-2.5-pro` | `gemini-2.5-flash` (mais rápido, gera mais) |
| Temperature | default | `0.3` |
| Prompt Fase 1 | "ata LONGA e DETALHADA" | "mínimo 500 palavras/5min, 3-5 parágrafos por tema" |
| Anti-lazy | ausente | "NÃO pare nos primeiros itens, continue até esgotar" |

### Arquivo alterado
- `supabase/functions/meeting-analyze/index.ts`

