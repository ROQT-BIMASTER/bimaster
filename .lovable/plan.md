

# Elevar Segurança — 19 Findings (11 Errors + 6 Warnings + 2 Platform)

## Scan Atual

### 🔴 11 Errors

| # | Finding | Correção |
|---|---------|----------|
| 1 | `audit_logs_archive` — todos approved users leem IPs e histórico | Restringir SELECT a admin only |
| 2 | `china_pasta_digital` — CRUD aberto a qualquer autenticado | Restringir por módulo `fabrica_china` ou `created_by` |
| 3 | `vendedor_territorios` — INSERT/UPDATE/DELETE sem ownership | Restringir escrita a admin/supervisor |
| 4 | `produto_peticionamento` — ALL com apenas `auth.uid() IS NOT NULL` | Restringir por módulo regulatório ou ownership |
| 5 | `china_submissao_tarefa_vinculos` — ALL aberto | Restringir por membership no projeto/módulo china |
| 6 | `erp_config` — API keys em plaintext | Remover colunas `api_key` e `api_key_anterior`, manter apenas `api_key_hash` |
| 7 | `configuracoes_cobranca` — API key e WhatsApp token em plaintext | Migrar para Vault ou hash; remover plaintext |
| 8 | `produto_composicao` — ALL aberto | Restringir por módulo fábrica |
| 9 | `produto_gate_criacao` — ALL aberto | Restringir a approver roles |
| 10 | `processo_documento_recebimentos` — SELECT `true` | Restringir por participante do processo |
| 11 | `trade-photos` — INSERT sem path ownership | Adicionar `(storage.foldername(name))[1] = auth.uid()::text` |

### 🟡 6 Warnings

| # | Finding | Correção |
|---|---------|----------|
| 12 | `erp_portal_access_modules` — sem SELECT para non-admin | Adicionar SELECT por profile assignment |
| 13 | `fabrica_formula_itens` — DELETE sem módulo | Restringir DELETE ao módulo `fabrica` |
| 14 | `ai_training_examples` — SELECT `true` | Restringir a módulo financeiro/admin |
| 15 | `fabrica-produto-fotos` — storage sem path ownership | Adicionar path check ou módulo |
| 16 | `cofre_share_tokens` — sem filtro de expirado/revogado em RLS | Adicionar `is_revoked = false AND expires_at > now()` |
| 17-18 | Extensions in public + RLS always true | Platform limitation (ignorar) |

## Estratégia de Execução

### Fase 1 — RLS Hardening (1 migration)

Corrigir os 8 findings de tabelas com policies permissivas:
- `china_pasta_digital`, `vendedor_territorios`, `produto_peticionamento`, `china_submissao_tarefa_vinculos`, `produto_composicao`, `produto_gate_criacao`, `processo_documento_recebimentos`, `audit_logs_archive`

Padrão: DROP policy permissiva → CREATE com `check_user_access(auth.uid(), 'modulo')` ou ownership check.

### Fase 2 — Storage Path Ownership (1 migration)

- `trade-photos` INSERT: adicionar path ownership
- `fabrica-produto-fotos` INSERT/UPDATE/DELETE: adicionar path ownership

### Fase 3 — Credentials Hardening (1 migration)

- `erp_config`: verificar se edge functions usam `api_key` plaintext. Se apenas `api_key_hash` é necessário, remover colunas plaintext
- `configuracoes_cobranca`: mesma análise — migrar secrets para edge function env vars ou Vault

### Fase 4 — Warnings Cleanup (1 migration)

- `erp_portal_access_modules`: SELECT por profile
- `fabrica_formula_itens`: DELETE com módulo `fabrica`
- `ai_training_examples`: SELECT restrito
- `cofre_share_tokens`: filtro de expiração em RLS

### Fase 5 — Platform Findings

Marcar `extensions_in_public` e `rls_always_true` como limitações aceitas.

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| 11 errors, 6 warnings | 0 errors, 0 warnings (2 aceitos) |
| 19 findings | 2 findings (platform) |

## Recursos

| Recurso | Ação |
|---------|------|
| 4 migrations SQL | Fases 1-4 |
| Verificação de edge functions | Antes de remover plaintext keys |
| 0 alterações frontend | Apenas banco de dados |

