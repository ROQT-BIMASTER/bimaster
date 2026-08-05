---
name: Modelos válidos no canal de chat do AI Gateway
description: Modelos *-pro (gpt-5.5-pro, gpt-5.4-pro) NÃO existem em /v1/chat/completions; copilotos devem usar gpt-5.5 ou Gemini; fallback trata 400 de modelo inválido
type: constraint
---

O wrapper `supabase/functions/_shared/ai-gateway-call.ts` chama
`https://ai.gateway.lovable.dev/v1/chat/completions`. Nesse canal:

- **Proibido**: `openai/gpt-5.5-pro`, `openai/gpt-5.4-pro` e qualquer variante `*-pro`
  (só existem na Responses API `/v1/responses`). Retornam
  `400 "model is not a chat model"` e derrubam o copiloto.
- **Permitidos e testados**: `openai/gpt-5.5`, `openai/gpt-5.2`, `openai/gpt-5-mini`,
  `openai/gpt-5-nano`, família `google/gemini-*`.
- `reasoning` só pode ser enviado para modelos `google/*`.

`callAIGateway` faz fallback automático em 429/402, em timeout e em 400 cujo corpo
contenha "is not a chat model" / "model_not_found". Copilotos afetados historicamente:
`projeto-copilot`, `central-copilot`, `pedidos-copilot` (função `escolherModelo`).

**Why:** incidente 2026-08-05 — copiloto de projeto falhava em toda pergunta de
análise/planejamento porque `escolherModelo` roteava para `openai/gpt-5.5-pro`.
