

# Correção das 7 Fragilidades do Scanner de Segurança

## Findings Ativos

| # | Severidade | Problema | Correção |
|---|---|---|---|
| 1 | **ERROR** | Storage `fabrica-nfe-xmls`: SELECT/INSERT aberto a qualquer autenticado | Restringir a `can_access_fabrica(auth.uid())` |
| 2 | **ERROR** | `trade_budget_documents`: CRUD aberto a qualquer autenticado | Restringir via join com `trade_budgets` + ownership |
| 3 | **ERROR** | 15+ tabelas de processo/workflow com policy `ALL` usando `auth.uid() IS NOT NULL` | Substituir por `check_user_access(auth.uid(), 'fabrica_china')` ou ownership |
| 4 | **WARN** | `usuario_permissoes_modulos`: SELECT `USING(true)` expõe permissões de todos | DROP policy permissiva, manter `usuario_id = auth.uid() OR admin` |
| 5 | **WARN** | `usuario_permissoes_telas`: SELECT `USING(true)` expõe permissões de todos | DROP policy permissiva, manter a existente |
| 6 | **WARN** | `marketing_campanhas`: 2 policies permissivas para `public` override as restritas | DROP as 2 policies broad |
| 7 | **WARN** | `stores_select_blocked`: policy PERMISSIVE com `false` não bloqueia nada | DROP (inútil) |

## Detalhes Técnicos

### Migração 1 — Storage `fabrica-nfe-xmls`
```sql
DROP POLICY "Authenticated users can read NF-e XMLs" ON storage.objects;
DROP POLICY "Authenticated users can upload NF-e XMLs" ON storage.objects;

CREATE POLICY "Fabrica users can read NF-e XMLs" ON storage.objects
FOR SELECT USING (
  bucket_id = 'fabrica-nfe-xmls' AND (
    can_access_fabrica(auth.uid()) OR is_admin_or_supervisor(auth.uid())
  )
);

CREATE POLICY "Fabrica users can upload NF-e XMLs" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'fabrica-nfe-xmls' AND (
    can_access_fabrica(auth.uid()) OR is_admin_or_supervisor(auth.uid())
  )
);
```

### Migração 2 — `trade_budget_documents`
DROP as 3 policies abertas. Criar policies com join via `trade_budgets.created_by = auth.uid()` ou `check_user_access(auth.uid(), 'trade')`.

### Migração 3 — 15+ tabelas de processo
Para cada tabela, DROP a policy `ALL` com `auth.uid() IS NOT NULL` e criar policies separadas por operação:
- **SELECT**: `check_user_access(auth.uid(), 'fabrica_china')` ou `is_admin_or_supervisor(auth.uid())`
- **INSERT/UPDATE/DELETE**: membership check ou module access

Tabelas afetadas: `product_process`, `process_despacho_documento`, `process_step_history`, `process_events`, `china_checklist_custom_categorias`, `china_checklist_custom_itens`, `china_embarque_documentos`, `process_doc_workflow_config`, `process_doc_workflow_etapas`, `process_doc_workflow_instancias`, `produto_brasil_checklist`, `produto_brasil_skus`, `produto_brasil_grade_itens`, `fluxo_aprovacao_anexos` (UPDATE/DELETE), `fluxo_aprovacao_instancias` (UPDATE), `fluxo_aprovacao_vinculos` (DELETE)

### Migração 4 — Permissões e Marketing
```sql
-- usuario_permissoes_modulos: DROP USING(true)
DROP POLICY "Acesso total permissoes_modulos - SELECT" ON usuario_permissoes_modulos;

-- usuario_permissoes_telas: DROP USING(true)
DROP POLICY "Acesso total permissoes_telas - SELECT" ON usuario_permissoes_telas;

-- marketing_campanhas: DROP 2 policies broad
DROP POLICY "Authenticated users can manage campaigns" ON marketing_campanhas;
DROP POLICY "Authenticated users can view campaigns" ON marketing_campanhas;

-- stores: DROP policy inútil
DROP POLICY "stores_select_blocked" ON stores;
```

### Atualizar Security Findings
Após aplicar as migrações, deletar os findings resolvidos no scanner.

### Documentação
Atualizar `docs/SECURITY.md` e `SEGURANCA_PRODUCAO.md` com as correções aplicadas.

## Arquivos Alterados

| Arquivo | Tipo |
|---|---|
| 2-3 migrações SQL | RLS hardening (20+ policies) |
| `docs/SECURITY.md` | Documentação |
| `SEGURANCA_PRODUCAO.md` | Documentação |

## Impacto

- Zero tabelas com policies permissivas desnecessárias
- Storage restrito por módulo (não apenas autenticação)
- Workflow tables protegidas por role/módulo
- Scanner deve retornar 0 findings ativos (exceto pg_net - limitação plataforma)

