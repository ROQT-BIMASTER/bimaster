---
title: IA & Copilots
audience: ai-coding-agent
last_updated: 2026-05-02
---

# 06 — IA & Copilots

## Princípios

1. **Toda chamada IA passa pelo Lovable AI Gateway** (`https://ai.gateway.lovable.dev/v1/chat/completions`).
2. **Nunca chame o gateway direto do front.** Sempre via Edge Function +
   `callAIGateway` (server) e `invokeChat` (client).
3. **`LOVABLE_API_KEY`** é auto-provisionado. Nunca peça ao usuário.

## Modelos disponíveis

```text
google/gemini-3-flash-preview        ← DEFAULT para chats
google/gemini-2.5-pro                ← multimodal + reasoning grande
google/gemini-3.1-pro-preview
google/gemini-2.5-flash
google/gemini-2.5-flash-lite         ← classification / cheap
google/gemini-2.5-flash-image        ← geração de imagem (Nano Banana)
google/gemini-3-pro-image-preview
google/gemini-3.1-flash-image-preview
openai/gpt-5
openai/gpt-5.2                       ← reasoning pesado
openai/gpt-5-mini
openai/gpt-5-nano
```

Equivalências (substituições aceitáveis):
- `openai/gpt-5` ↔ `google/gemini-2.5-pro`
- `openai/gpt-5-mini` ↔ `google/gemini-2.5-flash`
- `openai/gpt-5-nano` ↔ `google/gemini-2.5-flash-lite`

## Reasoning

Apenas modelos **Gemini** aceitam o parâmetro `reasoning`:

```ts
{ reasoning: { effort: "minimal" | "low" | "medium" | "high" | "xhigh" } }
```

> **Nunca envie `reasoning` para `openai/*`** — gateway rejeita com 400. O
> `callAIGateway` já filtra isso por segurança.

## `callAIGateway` (server)

Arquivo: `supabase/functions/_shared/ai-gateway-call.ts`.

```ts
const r = await callAIGateway({
  model: "google/gemini-3-flash-preview",
  messages: [
    { role: "system", content: "Você é um assistente útil." },
    { role: "user", content: userMessage },
  ],
  // tools, tool_choice, reasoning, timeoutMs, allowFallback opcionais
});

if (r.kind !== "ok") return aiGatewayErrorResponse(r, corsHeaders);

const reply = r.data.choices[0].message.content;
```

Comportamento automático:
- **Timeout**: 60s default (configurável via `timeoutMs`).
- **Fallback** em 429/402: `pro → flash → flash-lite`,
  `gpt-5/5.2 → mini → nano`.
- **3 tentativas** máx.
- Retorna `{ kind, ... }` para tradução em `aiGatewayErrorResponse`.

## `invokeChat` (front)

Arquivo: `src/lib/ai/invokeChat.ts`.

```ts
const { data, error } = await invokeChat<{ reply: string }>(
  "ai-insights",
  { message: input },
  { timeoutMs: 60_000 },     // default 90s
);
if (error) { toast.error(error.userMessage); return; }
```

`error.userMessage` já vem em PT-BR e traduz:
- `402` → "Créditos de IA esgotados…"
- `429` → "Muitas requisições…"
- timeout → "Assistente demorou demais…"
- `401`/`403` → "Sessão expirada…"

## Streaming (token-by-token)

Padrão de referência: `src/hooks/useQAAgent.ts`.

```ts
const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/<func>`;
const headers = await getAuthHeaders();
const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify({...}) });
const reader = resp.body!.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  // parse linha-a-linha; ignore ":"; trate "[DONE]"; re-buffer JSON parcial
}
```

## Structured output

Use **tool calling**, não "responda em JSON":

```ts
body.tools = [{
  type: "function",
  function: {
    name: "extract_entities",
    description: "...",
    parameters: { type: "object", properties: { ... }, required: [...], additionalProperties: false },
  },
}];
body.tool_choice = { type: "function", function: { name: "extract_entities" } };
```

## Geração de imagem

Edge Function chama `google/gemini-2.5-flash-image` (Nano Banana) ou
`google/gemini-3.1-flash-image-preview` (Nano Banana 2). Para casos premium
(marketing, cover), `google/gemini-3-pro-image-preview`.

Ver `supabase/functions/ai-creative-studio/`. Política de mídia em
`mem://features/marketing/ai-creative-studio-infrastructure`.

## Copilots

### Sofia (financeiro)

- Markdown + Recharts + voz ElevenLabs.
- Edge: `sofia-*` (vários endpoints).
- Regras: `mem://ai/sofia-agente-financeiro-avancado`.

### Copilot do Projeto

- Acesso: dentro de um Projeto (Cmd/Ctrl+J).
- Threads e relatórios expiram em **30d se `salvo=false`**.
- Perfil aprendido por `(user, projeto)`.
- Ações destrutivas exigem **reauth por senha** (`projeto-copilot-aplicar`).
- Vínculo de relatório a tarefa via cópia para `projeto-anexos`.
- Cleanup diário via cron (`projeto-copilot-cleanup`).

### Copilot Central

- Acesso: Central de Trabalho (Cmd/Ctrl+J).
- Cross-projeto, tools próprias.
- Compartilha cleanup com `projeto-copilot-cleanup`.

### Document Auditor

- Extração de dados de documentos com consentimento explícito da UI.
- Regras: `mem://ai/finance-document-auditor-logic-v2`.

### Ingredient Extraction (INCI)

- Liability + auditoria. Regras:
  `mem://ai/ingredient-extraction-ia-governance-standard`.

### Support Assistant

- Multi-turn com contexto + conhecimento dos endpoints REST.
- Regras: `mem://ai/support-assistant-governance`.

## Erros que você precisa tratar

| Status | Causa | Mensagem ao usuário |
|---|---|---|
| 402 | créditos esgotados | "Créditos de IA esgotados. Adicione créditos no workspace." |
| 429 | rate-limit gateway | "Muitas requisições. Aguarde alguns segundos." |
| 504 (timeout) | gateway lento | "O assistente demorou demais. Tente uma pergunta mais simples." |
| 502/500 | upstream | "Erro no provedor de IA." |
| 401/403 | sessão expirou | "Sessão expirada. Faça login novamente." |

`invokeChat` e `aiGatewayErrorResponse` já cobrem todos. Apenas chame `toast.error(error.userMessage)`.
