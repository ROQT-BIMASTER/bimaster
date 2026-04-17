

## Diagnóstico

Auditoria solicitada: comparar OpenAPI spec + SDKs (Python/TS/JS) contra implementação real (Edge Functions + código React), endpoint por endpoint, produzindo matriz com uma linha por path.

Antes de prometer execução, preciso responder as **perguntas de calibração** do próprio prompt — sem essas respostas, a auditoria fica especulativa.

## Inventário inicial (read-only, antes do plano executável)

Para dimensionar o escopo, preciso ler:

1. `src/components/erp/ApiDocumentation.tsx` — onde a OpenAPI vive (inline no React, não como arquivo .json separado neste projeto).
2. `src/components/erp/SdkDownloadButtons.tsx` — onde os 3 SDKs (Python/TS/JS) são gerados inline.
3. `supabase/functions/` — listar todas as Edge Functions deployadas para mapear handlers.
4. Cross-reference: cada `path` declarado na OpenAPI inline → arquivo `supabase/functions/<nome>/index.ts`.

Estimativa preliminar baseada em memórias (`mem://process/release-changelog-discipline`, `mem://finance/contas-pagar-governance-and-audit-standard`): ~30-50 endpoints reais, distribuídos entre `contas-pagar-api`, `contas-receber-api`, `lancamentos-cc-api`, `parcelas-api`, `erp-export-payment`, `clientes-api`, `fornecedores-api`, `categorias-api`, etc. Não 185 — esse número parece vir do contexto de outra plataforma.

## Calibração obrigatória antes de executar

O próprio prompt manda **parar e perguntar** se houver ambiguidade. Tenho 4 perguntas críticas que definem se a auditoria é viável e útil:

1. **Escopo de runtime**: análise estática (leitura de código) ou também smoke tests ao vivo via `supabase--curl_edge_functions`? Sem runtime, idempotência e rate-limit só são verificáveis por inspeção de código.
2. **Modo de entrega**: matriz completa em 1 resposta única ou paginada (a OpenAPI inline pode ter 30-50 paths — cabe em 1; se passar de 80, paginar a cada 25-30).
3. **Cobertura**: auditar **todos** os paths ou priorizar apenas os financeiros (CP/CR/CC/erp-export) que são onde o risco real está?
4. **Profundidade dos 3 SDKs**: validar paridade SDK↔OpenAPI nos 3 (Python/TS/JS) em todos os endpoints, ou apenas confirmar que cada endpoint OpenAPI tem um método correspondente em pelo menos 1 SDK?

## Plano de execução (após calibração)

### Fase 1 — Inventário (5-10 min, read-only)
- Ler `ApiDocumentation.tsx` e extrair todos os `paths` declarados na OpenAPI inline.
- Listar `supabase/functions/` para mapear handlers reais.
- Construir tabela de mapeamento `path → arquivo → linha do handler`.
- Reportar contagem real de endpoints (substitui o "185" especulativo do prompt).

### Fase 2 — Auditoria item-por-item (1 linha por endpoint)
Aplicar os 7 passos do prompt em cada endpoint:
1. Localizar handler (arquivo:linha).
2. Validar método + path + query params required.
3. Validar request body (campos, tipos, formatos).
4. Validar response shape (incluindo `codigo_status`, ISO 8601, `request_id`).
5. Validar error responses (400/401/404/409/429 + Retry-After + X-Request-ID).
6. Validar transversais (idempotência, rate limit, HMAC webhook, deprecation).
7. Registrar na matriz com status (OK/FAIL/MISSING/DEPRECATED/EXTRA).

### Fase 3 — Saídas obrigatórias
- **Matriz Markdown** com 1 linha por endpoint, ordenada FAIL→DEPRECATED→OK.
- **Resumo quantitativo** (totais por status).
- **Top findings por severidade** (ALTA/MÉDIA/BAIXA), com evidência `arquivo:linha`.
- **Endpoints EXTRA** (handlers que existem mas não estão na OpenAPI).

### Fase 4 (opcional, depende de calibração #1)
Smoke tests runtime via `supabase--curl_edge_functions` em endpoints críticos:
- `POST /erp-export-payment` com `payment_queue_id` inexistente → confirma 404 estruturado.
- `POST /contas-pagar-api/upsert` sem `x-api-key` → confirma 401 estruturado.
- `POST /contas-pagar-api/upsert-lote` com idempotency key duplicada → confirma cache de 24h.

## Não-escopo

- Correções (auditoria é somente-leitura, conforme regra do prompt).
- Reescrita de handlers ou OpenAPI.
- Validação de SDK interno (suíte Vitest privada — fora do escopo público).

## Próximo passo

Preciso das respostas às 4 perguntas de calibração antes de prosseguir. Sem elas, posso entregar uma matriz cobrindo o que for inferível, mas com várias linhas marcadas `UNVERIFIED: <razão>` — o que reduz o valor da auditoria.

