
# Análise Arquitetural — Melhorias Implementadas

## Implementado nesta iteração

### 1. ✅ Tabela `process_decisions` — Decisão Internacional Formal
- Tabela criada com versionamento automático (trigger `fn_process_decision_auto_version`)
- Suporta loop bidirecional China↔Brasil com `parent_decision_id`
- Campos: `items_affected` (JSONB), `prazo_retorno`, `version`
- RLS: SELECT para authenticated, INSERT restrito a `decided_by = auth.uid()`
- Hook: `src/hooks/useProcessDecisions.ts`

### 2. ✅ Tabela `process_field_permissions` — Permissões por Etapa+Campo
- Tabela criada com constraint UNIQUE por `(process_step, module, field, origin_role)`
- Permite controlar `can_view`, `can_edit`, `can_approve` por origem (china/brasil)
- RLS: SELECT para authenticated, gestão restrita a admins
- Hook: `src/hooks/useProcessFieldPermissions.ts`

### 3. ✅ Inbox de Decisões na China
- Componente: `src/components/china/ChinaInboxDecisoes.tsx`
- Exibe decisões do Brasil com: tipo, versão, prazo, itens pendentes
- Indicador de SLA (atrasado / dias restantes)
- Botão "Reenviar Correções" para decisões do tipo `needs_revision`

### 4. ✅ Padronização de Hooks
- `useProductProcess`: auto-create separado em `createProcess` mutation explícita (era side-effect no queryFn)
- Os `as any` casts permanecem por enquanto (tabelas custom não estão nos types gerados), mas o padrão é consistente

## Pendente (próximas iterações)

| Item | Status |
|------|--------|
| Checklist de retorno inteligente (auto-lock de aprovados) | Planejado |
| Auditar `fetchAllRows` em DRE, Financeiro, Comercial | Planejado |
| Seed de `process_field_permissions` com regras padrão | Planejado |
| Integrar `ChinaInboxDecisoes` na tela de submissão China | Planejado |
