

# Auditoria Completa + IA Avançada no Suporte + Correção de Falhas de Segurança

## Diagnóstico Atual

### O que já está implementado e funcionando
- **contas-pagar-api**: Zod schemas `.strict()`, timingSafeEqual no `/last-sync`, `/debug-payload` restrito a admin JWT, audit log em todas as escritas, WAF, rate limiting
- **contas-receber-api**: Zod schemas, WAF, rate limiting, validação Zod
- **Portal ERP**: Chatbot IA inline, onboarding wizard, validação de payload no tester, SDKs JS/Python, dashboard de uso
- **api-support-ai**: Funcional com `google/gemini-3-flash-preview` e documentação hardcoded

### Falhas Encontradas

**1. contas-receber-api SEM audit log** — Nenhuma operação de escrita (incluir, alterar, excluir, recebimento, cancelar) registra em `security_audit_log`. Isso é uma lacuna grave comparado ao CP que já tem.

**2. contas-receber-api schemas SEM `.strict()`** — `IncluirSchema` e `UpsertSchema` não usam `.strict()`, permitindo campos arbitrários passarem pela validação Zod (vetor de Mass Assignment).

**3. Modelo de IA fraco no suporte** — O `api-support-ai` usa `google/gemini-3-flash-preview` (modelo leve). Para um assistente técnico de API que deve ser "a melhor IA do mercado", deveria usar `openai/gpt-5.2` (o mais avançado disponível).

**4. Documentação da IA incompleta** — O `API_DOCS_CONTEXT` no `api-support-ai` não inclui informações sobre:
- Schemas Zod (campos obrigatórios exatos por endpoint)
- Códigos de erro detalhados com exemplos de resposta
- Webhook event types
- Exemplos completos de request/response para cada endpoint
- Fluxo de autenticação passo a passo
- Limites de rate limiting

**5. RLS warnings do scan de segurança** — 6 findings ativos:
- `store_stock_movements`: SELECT com `USING(true)` 
- `kpis_tracking`: SELECT com `USING(true)`
- `market_coverage_snapshot`: ALL com `auth.uid() IS NOT NULL`
- `conciliacao_uploads`: ALL sem filtro de empresa/user
- 35+ tabelas de produto/processo com INSERT/UPDATE usando apenas `auth.uid() IS NOT NULL`

**6. Chat do admin sem histórico de conversa** — O `api-support-ai` recebe apenas `user_message` (1 mensagem), sem enviar o histórico da thread. A IA não tem contexto das mensagens anteriores.

---

## Plano de Implementação

### Fase 1 — Upgrade da IA para o modelo mais avançado + contexto rico

**Arquivo: `supabase/functions/api-support-ai/index.ts`**

| Correção | Detalhe |
|---|---|
| Modelo `openai/gpt-5.2` | Substituir `google/gemini-3-flash-preview` pelo modelo mais avançado |
| Documentação expandida | Adicionar schemas Zod completos, exemplos de request/response, webhook events, fluxo de autenticação, rate limits |
| Histórico de conversa | Receber array `conversation_history` do frontend e enviar ao modelo para contexto completo |
| Reasoning mode | Ativar `reasoning: { effort: "high" }` para respostas mais precisas |

**Arquivos frontend:**
- `EndpointSupportChat.tsx` — Enviar histórico de mensagens da thread ao chamar a IA
- `AdminApiSupport.tsx` — Enviar histórico da thread ao gerar sugestão com IA

### Fase 2 — Audit log na contas-receber-api

**Arquivo: `supabase/functions/contas-receber-api/index.ts`**

| Correção | Detalhe |
|---|---|
| Adicionar `logAuditEvent` | Mesma função helper do CP, inserindo em `security_audit_log` |
| Cobrir todas as escritas | `/incluir`, `/alterar`, `/excluir`, `/lancar-recebimento`, `/cancelar-recebimento`, `/upsert`, `/upsert-lote` |
| `.strict()` nos schemas | Adicionar `.strict()` em `IncluirSchema`, `UpsertSchema`, `LoteItemSchema` |

### Fase 3 — RLS Hardening (tabelas do scan)

**Migração SQL** para corrigir as 4 tabelas mais críticas:

| Tabela | Correção |
|---|---|
| `store_stock_movements` | SELECT restrito a admin/supervisor ou vendedor da loja |
| `kpis_tracking` | SELECT restrito a admin/supervisor ou vendedor da loja |
| `conciliacao_uploads` | Filtrar por `user_id = auth.uid()` ou admin |
| `market_coverage_snapshot` | INSERT/UPDATE/DELETE restritos a admin/supervisor |

As 35+ tabelas de produto/processo são um escopo maior e devem ser tratadas em uma fase separada para não quebrar funcionalidades existentes.

---

## Resumo de Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/api-support-ai/index.ts` | Upgrade modelo GPT-5.2, docs expandidas, histórico, reasoning |
| `supabase/functions/contas-receber-api/index.ts` | Audit log + `.strict()` nos schemas |
| `src/components/erp/EndpointSupportChat.tsx` | Enviar histórico ao chamar IA |
| `src/pages/AdminApiSupport.tsx` | Enviar histórico ao gerar sugestão |
| Migração SQL | RLS hardening em 4 tabelas |

