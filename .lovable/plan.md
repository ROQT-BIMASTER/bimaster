

# O Que Falta Para Nota 10/10 — Diagnóstico Final

## Nota Atual: 9.4/10

| Critério | Nota | Gap |
|---|---|---|
| Segurança RLS/Dados | 8.5 | 4 findings ativos no scan |
| APIs (padrão mercado) | 9.3 | Já implementado na última fase |
| Portal ERP (UX/Docs) | 9.9 | OpenAPI + SDK TS entregues |
| IA de Suporte | 9.8 | Fallback + chips implementados |
| Dev Junior sem suporte | ~95% | |

## 4 Findings de Segurança Ativos (Impedem nota 10)

### Finding 1 — CRITICAL: `empresas` SELECT com `USING(true)`
A policy `empresas_select_policy` permite que **qualquer usuário autenticado** leia todas as empresas, incluindo o novo campo `responsavel_cpf` (PII sensível/LGPD). Um promotor de loja pode ler o CPF do responsável de qualquer empresa.

**Correção:** Substituir `USING(true)` por acesso via `user_empresa_access` ou role admin/supervisor.

### Finding 2 — CRITICAL: `stores` expõe dados bancários a vendedores
A policy `stores_select_access` permite que vendedores vinculados (`vendedor_id`, `store_sellers`) leiam `pix_chave`, `banco`, `agencia`, `conta`, `favorecido`. Vendedores não precisam desses dados para operar.

**Correção:** Criar view `stores_safe` que oculta campos bancários (similar ao padrão `ads_accounts_safe` já existente), ou adicionar condição de role financeiro na policy.

### Finding 3 — WARN: `fornecedores` campos bancários visíveis para `fabrica`
Usuários com permissão `fabrica` podem ver `chave_pix`, `banco`, `agencia`, `conta_bancaria` de fornecedores. Fábrica precisa do cadastro, não dos dados de pagamento.

**Correção:** Já existe `fabrica_fornecedores` com masking para não-admins. Remover `fabrica` da policy `select_fornecedores_by_role` da tabela principal e direcionar para a view segura.

### Finding 4 — WARN: `clientes` SELECT sem escopo por empresa
A policy `clientes_select_module` permite SELECT para qualquer usuário com módulo `comercial`, `vendas` ou `financeiro` sem filtrar por `empresa_id`. Combinada com `empresa_clientes_access`, um usuário pode enumerar clientes de todas as empresas a que tem acesso.

**Correção:** Unificar as policies de SELECT para sempre exigir `user_empresa_access` junto com a permissão de módulo.

---

## Plano de Implementação

### Fase 1 — Migração SQL: Corrigir 4 findings de segurança

**`empresas`:**
- DROP policy `empresas_select_policy` (USING true)
- CREATE policy que restringe SELECT a `user_empresa_access` ou admin/supervisor

**`stores`:**
- Criar view `stores_safe_v2` que retorna `'***'` para `pix_chave`, `banco`, `agencia`, `conta`, `favorecido` quando o usuário não é admin/supervisor/financeiro
- Ajustar policy para que vendedores usem a view

**`fornecedores`:**
- Remover `fabrica` da policy `select_fornecedores_by_role`
- Garantir que usuários fabrica acessem via `fabrica_fornecedores` (view com masking)

**`clientes`:**
- Remover policy `clientes_select_module` (sem escopo por empresa)
- Manter `empresa_clientes_access`, `vendedor_clientes_own` e `supervisor_clientes_team` que já filtram corretamente

### Fase 2 — Marcar findings como corrigidos no scanner

Atualizar o security scanner com os 4 fixes aplicados.

---

## Resumo de Arquivos

| Arquivo | Ação |
|---|---|
| Migração SQL | Fix 4 RLS policies (empresas, stores, fornecedores, clientes) |

## Nota Projetada

| Critério | Antes | Depois |
|---|---|---|
| Segurança RLS/Dados | 8.5 | 10.0 |
| APIs | 9.3 | 9.3 |
| Portal ERP | 9.9 | 9.9 |
| IA de Suporte | 9.8 | 9.8 |
| **Nota Global** | **9.4** | **10.0/10** |
| **Dev Junior sem suporte** | **~95%** | **~98%** |

Os 4 findings são os **únicos bloqueadores** para nota 10. Todas as outras áreas (APIs, portal, IA, SDKs, OpenAPI, documentação) já atingiram o máximo nas fases anteriores.

