

# Auditoria de Segurança das APIs AP + Portal ERP + Chat de Suporte com IA

## 1. Análise das APIs e Portal — Diagnóstico

### APIs de Contas a Pagar (contas-pagar-api — 2295 linhas)

**Pontos Fortes:**
- Autenticação dual (JWT + API Key) com timing-safe comparison
- Rate limiting por concorrência (slots) e por IP/usuário
- CORS lockdown, Security Headers
- Retry com backoff exponencial e jitter
- Validação de UUID em parâmetros sensíveis
- Allowlist de campos no PUT /update (proteção Mass Assignment)
- Hash SHA-256 para API Keys

**Fragilidades Identificadas:**
1. **Falta de validação Zod nos endpoints Huggs-style** — Os endpoints `/incluir`, `/upsert`, `/upsert-lote`, `/lancar-pagamento`, `/alterar` aceitam `req.json()` sem schema Zod, permitindo campos arbitrários via spread operator (`...rest` na linha 1821). Isso é um vetor de Mass Assignment nos endpoints que usam `...body` ou `...rest`.
2. **Endpoint `/last-sync` usa comparação direta** (linha 1061: `apiKey !== expectedKey`) em vez de `timingSafeEqual` — vulnerável a timing attack.
3. **Endpoint `/debug-payload` expõe dados internos** (hashes, registros do banco) a qualquer portador de API Key — deveria ser restrito a admin.
4. **`/sync-chunk` faz redirect interno com `fetch(newReq)`** (linha 820) que pode falhar silenciosamente e perder headers de autenticação.
5. **Sem audit logging** nas operações de escrita via API (incluir, alterar, excluir, lancar-pagamento, cancelar-pagamento) — sem rastro de quem fez o quê via API Key.
6. **Endpoint `/incluir` aceita `...rest`** sem sanitização — campos arbitrários são inseridos direto no banco.

### Export API (contas-pagar-export-api — 823 linhas)
- Usa `validateAnyAuth` corretamente
- Rate limit com 60 req/min
- **OK** — sem fragilidades críticas

### Sandbox (api-sandbox — 382 linhas)
- Usa `validateJWT` — OK
- Logs no `sandbox_requests` — OK
- **OK** — sandbox é safe by design (dados mock)

### Portal ERP (IntegracaoERP.tsx — 450 linhas)
- Geração de chave client-side com SHA-256 — OK
- **Fragilidade**: chaves expiradas/inativas podem ser ativadas por qualquer usuário com acesso ao portal (sem verificação de role admin no toggle).
- **Fragilidade**: `fetchKeys` busca TODAS as chaves sem filtro de empresa — um usuário terceiro vê chaves de outras empresas se tiver acesso à tela.
- **Fragilidade**: delete de chaves sem verificação de ownership.

### Chat de Suporte (EndpointSupportChat.tsx)
- Já existe um chat inline por endpoint
- Insere com `is_admin_reply: false` — hardcoded no client
- **Falta**: tela admin para responder com IA

---

## 2. Nota das APIs e Portal

| Critério | Nota (0-10) |
|---|---|
| Segurança (autenticação, autorização) | 8.5 |
| Documentação no portal | 9.0 |
| Sandbox interativo | 9.5 |
| Facilidade de integração sem suporte | 7.5 |
| Validação de input | 6.5 |
| Audit trail | 6.0 |
| **Nota Global** | **7.8/10** |

**Probabilidade de integrar sem suporte**: ~75%. O portal tem documentação rica, sandbox funcional e tester. O que falta é um assistente IA para responder dúvidas técnicas em tempo real.

---

## 3. Plano de Implementação

### Fase 1 — Blindagem de Segurança das APIs

**Arquivo: `supabase/functions/contas-pagar-api/index.ts`**

| Correção | Detalhe |
|---|---|
| Zod nos endpoints Huggs | Adicionar schemas Zod para `/incluir`, `/alterar`, `/upsert`, `/upsert-lote`, `/lancar-pagamento`, `/cancelar-pagamento` — rejeitar campos não permitidos |
| Remover `...rest` no /incluir | Listar campos permitidos explicitamente (como já faz no /update) |
| TimingSafe no /last-sync | Trocar `apiKey !== expectedKey` por `timingSafeEqual` |
| Restringir /debug-payload | Exigir JWT admin (não apenas API Key) |
| Audit log em escritas via API | Inserir em `security_audit_log` para incluir/alterar/excluir/pagamento via API Key |
| Remover redirect interno no /sync-chunk | Processar diretamente em vez de `fetch(newReq)` |

### Fase 2 — Blindagem do Portal ERP

**Arquivo: `src/pages/IntegracaoERP.tsx`**

| Correção | Detalhe |
|---|---|
| Filtro de empresa | Se não admin, filtrar `erp_api_keys` por empresa do usuário |
| Toggle/delete restrito | Verificar `isAdmin` antes de permitir toggle/delete de chaves |
| Limitar visibilidade | Não-admins veem apenas suas próprias chaves |

### Fase 3 — Tela Admin de Suporte com IA

**Novos arquivos:**

1. **`src/pages/AdminApiSupport.tsx`** — Tela admin com:
   - Lista de todas as mensagens de suporte agrupadas por endpoint
   - Status (open/answered) com filtros
   - Para cada thread: botão "Responder com IA" que usa Lovable AI (modelo `openai/gpt-5.2`) conectado ao contexto das APIs e dados do sistema
   - Campo de resposta manual + resposta gerada por IA
   - Marcar como respondido

2. **`supabase/functions/api-support-ai/index.ts`** — Edge function que:
   - Recebe a mensagem do usuário + contexto do endpoint
   - Consulta a documentação das APIs (hardcoded como system prompt)
   - Consulta dados relevantes do banco (schema, exemplos)
   - Usa Lovable AI Gateway para gerar resposta técnica
   - Retorna sugestão de resposta para o admin revisar antes de enviar

3. **Migração** — Adicionar coluna `ai_suggested_reply` à tabela `api_support_messages` e route no sidebar para admin.

### Fase 4 — Melhorias no Chat Inline do Portal

**Arquivo: `src/components/erp/EndpointSupportChat.tsx`**

- Adicionar seletor de endpoint ao iniciar conversa (para marcar o endpoint exato)
- Mostrar badge de "Respondido" com destaque visual
- Permitir anexar screenshots/logs do tester

---

## Resumo de Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/contas-pagar-api/index.ts` | Corrigir 6 vulnerabilidades |
| `src/pages/IntegracaoERP.tsx` | Blindar acesso por empresa/role |
| `src/pages/AdminApiSupport.tsx` | Criar tela admin com IA |
| `supabase/functions/api-support-ai/index.ts` | Criar edge function IA |
| Migração SQL | Coluna `ai_suggested_reply` + rota sidebar |
| `src/components/erp/EndpointSupportChat.tsx` | Melhorias UX |

