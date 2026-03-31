

# Aprofundamento de Segurança — 7 Findings Ativos

## Scan Atual: 4 Errors + 3 Warnings

| # | Severidade | Finding | Risco |
|---|-----------|---------|-------|
| 1 | 🔴 Error | View `configuracoes_cobranca_safe` expõe API keys | Credenciais legíveis por qualquer autenticado |
| 2 | 🔴 Error | Realtime sem RLS em `realtime.messages` | Cross-user data leakage via channels |
| 3 | 🔴 Error | Storage buckets privados sem ownership check (~9 buckets) | Qualquer autenticado lê qualquer documento |
| 4 | 🔴 Error | `leads_minerados` com RLS permissivo | Todos leem/editam/deletam leads de outros |
| 5 | 🟡 Warn | `dynamic_form_responses` policy ampla demais | PII acessível a qualquer autenticado |
| 6 | 🟡 Warn | Extensions no schema `public` | Best practice violation |
| 7 | 🟡 Warn | RLS policies com `USING(true)` em INSERT/UPDATE/DELETE | Escrita sem restrição |

## Plano de Correção

### Fase 1 — Errors (Críticos)

**1. View `configuracoes_cobranca_safe`**
- Recriar a view omitindo colunas `api_key` e `whatsapp_verify_token`
- Ou adicionar RLS policy restringindo SELECT a admins

**2. Realtime `realtime.messages`**
- Este é um schema reservado do Supabase — não podemos criar policies diretamente
- Ação: remover tabelas sensíveis da publicação Realtime (`ALTER PUBLICATION supabase_realtime DROP TABLE ...`) para as que não precisam de realtime
- Para as que precisam: a proteção vem das RLS das tabelas de origem (já ativas)

**3. Storage buckets — ownership check (9 buckets)**
- Para cada bucket, atualizar policies de SELECT para verificar ownership via path prefix (`(storage.foldername(name))[1] = auth.uid()::text`) ou join contra tabela relacionada
- Buckets afetados: `campaign-evidence`, `china-documentos`, `trade-expense-docs`, `fabrica-custo-evidencias`, `comprovantes`, `fabrica-revisao-docs`, `department-expense-docs`, `event-expense-docs`, `payment-chat-files`

**4. `leads_minerados` — restringir por owner**
- DROP policies atuais
- CREATE policy SELECT: `minerado_por = auth.uid() OR is_admin_or_supervisor(auth.uid())`
- CREATE policy INSERT: `minerado_por = auth.uid()`
- CREATE policy UPDATE/DELETE: `minerado_por = auth.uid() OR is_admin_or_supervisor(auth.uid())`

### Fase 2 — Warnings

**5. `dynamic_form_responses` — remover policy ampla**
- DROP policy "Authenticated can view responses of active forms"
- Manter apenas policies de owner e submitter (já existem)

**6. Extensions em `public`**
- Mover extensions para schema `extensions` (migration com DROP + CREATE em novo schema)

**7. RLS policies `USING(true)` em operações de escrita**
- Auditar e substituir por condições baseadas em role/ownership

### Impacto Estimado

| Antes | Depois |
|-------|--------|
| 4 errors, 3 warnings | 0 errors, 0 warnings |
| Score ~85 | Score ~98 |

## Arquivos/Recursos

| Recurso | Ação |
|---------|------|
| Migration SQL (Fase 1) | View + leads_minerados + storage policies |
| Migration SQL (Fase 2) | form responses + extensions + USING(true) audit |
| Zero alteração no frontend | Apenas banco de dados |

## Ordem de Execução

Começar pela Fase 1 (4 errors críticos) que resolve os riscos de exposição de dados. Fase 2 na sequência para limpar warnings.

