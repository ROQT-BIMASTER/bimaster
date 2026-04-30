# Plano: Auditoria e correção de todas as IAs de chat

Diagnóstico inicial pelo código já mostra o padrão típico desse sintoma "fica carregando e não responde": **Edge Functions chamando o AI Gateway em modelos pesados (`google/gemini-2.5-pro`, `openai/gpt-5.2` com reasoning high) que estouram o timeout** combinado com `supabase.functions.invoke()` que **não tem timeout no cliente** — o spinner roda para sempre.

Suspeitos confirmados na varredura:
- `ai-insights` → `gemini-2.5-pro` (lento)
- `contas-pagar-ai-chat` → `gemini-2.5-pro` em duas chamadas
- `api-support-ai` → `gpt-5.2` com `reasoning.effort: 'high'` (xhigh latency)
- `projeto-copilot` → híbrido com fallback, mas pode estar caindo em loop de tool use
- `huggs-agent-chat` → `gemini-2.5-flash` (provavelmente OK)
- `sofia-voice-token` → token-only, deve estar OK
- Chat principal (`/dashboard/chat`) → AIInsightsChat aponta para `ai-insights` (afetado)

Causas secundárias possíveis: créditos esgotados (402), rate limit (429) sem mensagem clara para o usuário, CORS, JWT expirado, payload sem schema.

## Escopo

6 funções de chat + 4 telas que as consomem, todas auditadas e corrigidas em ondas, com smoke test no preview ao final de cada onda.

## Onda 1 — Saúde da infraestrutura (5 min)

1. Confirmar `LOVABLE_API_KEY` ativa via `secrets--fetch_secrets`.
2. `supabase--cloud_status` para garantir que o backend não está em ressaca.
3. `supabase--analytics_query` nos `function_edge_logs` últimas 24h filtrando erros 4xx/5xx das 6 funções de chat.
4. `supabase--edge_function_logs` para cada uma — identificar se o erro é 402 (sem crédito), 429 (rate), 401 (JWT), 500 (código) ou timeout.

**Saída**: tabela "função × código de erro × frequência" para priorizar.

## Onda 2 — Padrão único de tratamento de erro (correção transversal)

Hoje cada chat tem seu próprio try/catch e quando o gateway devolve 402/429 o frontend só mostra "Erro ao chamar assistente" — ou nem mostra. Vou padronizar:

- Criar helper `supabase/functions/_shared/ai-gateway-call.ts` com:
  - Timeout de 60s (AbortController) — evita "carregando infinito"
  - Retry com backoff em 429
  - Mapeamento explícito de 402→`PAYMENT_REQUIRED`, 429→`RATE_LIMITED`, 5xx→`AI_UPSTREAM_ERROR`
  - Fallback de modelo: pro→flash→flash-lite quando 429/402

- Criar helper frontend `src/lib/ai/invokeChat.ts`:
  - Wrapper de `supabase.functions.invoke` com timeout cliente de 90s
  - Toasts diferenciados ("Sem créditos de IA — adicione no painel", "Muitas requisições, aguarde")

- Refatorar as 6 funções de chat para usar o helper.

## Onda 3 — Correções por chat

| Chat | Edge function | Ação |
|---|---|---|
| **AI Insights** (Chat principal) | `ai-insights` | Trocar default `gemini-2.5-pro` → `gemini-3-flash-preview`. Manter pro só quando usuário marcar "raciocínio profundo". Validar schema Zod do body. |
| **Sofia (financeiro/voz)** | `sofia-voice-token` + `expense-ai-assistant` | Verificar token ElevenLabs válido; se voz falhar, degradar para texto. Logar `xi-api-key` ausente como warning explícito. |
| **Copiloto de Projetos** | `projeto-copilot` | Limitar loop de tool use a 5 iterações (hoje pode loopar). Adicionar timeout total 75s. Garantir que retorna mensagem mesmo quando Claude/Gemini não decide. |
| **Contas a Pagar AI** | `contas-pagar-ai-chat` | Trocar `gemini-2.5-pro` → `gemini-2.5-flash` no chat (manter pro só na auditoria batch). |
| **Suporte AI** | `api-support-ai` | Reduzir `reasoning.effort` de `high` → `medium` no chat (high só sob demanda). |
| **Huggs Agent** | `huggs-agent-chat` | Validar variáveis Huggs e CORS; smoke test. |

## Onda 4 — Versionamento e changelog

- Bump `APP_VERSION` para `3.4.63` em `src/lib/version.ts`.
- Entrada em `src/components/erp/ApiDocumentation.tsx` listando: "Estabilidade dos chats de IA — timeout, fallback de modelo, mensagens claras de erro".
- Memória nova `mem://ai/chat-stability-policy` consolidando: timeout 60s edge / 90s client, fallback pro→flash→lite, default flash em chats interativos.

## Onda 5 — Smoke tests no preview (browser tool)

Após o deploy de cada onda, navegar e mandar a mesma mensagem-piloto em cada chat e checar:

```text
Pergunta-piloto: "Me dê um resumo rápido em 2 frases."
Critérios:
  - Resposta em < 30s
  - Sem spinner infinito
  - Tratamento gracioso se gateway 429/402
```

Telas para testar (em ordem):
1. `/dashboard/chat` (AIInsightsChat)
2. `/dashboard/projetos/{id}` → FAB Copiloto
3. `/dashboard/contas-a-pagar` → assistente de IA
4. `/dashboard/huggs` (se existir)
5. Página de auditoria com Sofia voz

Se algum chat falhar no smoke, voltar à Onda 3 só para ele e iterar.

## Onda 6 — Relatório final ao usuário

- Tabela: chat × status antes × status depois × modelo usado.
- Lista de mudanças por arquivo.
- Recomendação se algum chat exigir crédito adicional (402 reincidente).

## O que NÃO está no escopo

- Mudar provedor (não vou trocar Gemini por GPT-5 nem por Claude — isso é do plano anterior).
- Adicionar novos chats — só consertar os existentes.
- Refatorar UI dos chats — só backend e tratamento de erro frontend.
- Mexer em Sofia voz se a integração ElevenLabs já estiver funcional, exceto fallback texto.

## Pré-condição para começar

Nenhuma. Posso começar imediatamente assim que aprovar — não exige chave nova nem decisão sua.
