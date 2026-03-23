

# Consistência de Dados N8N + Painel de Configuração de Fonte de Dados

## Problema

1. **Inconsistência de busca**: O calendário busca todos os registros com paginação automática, mas as tabelas (ContasPagarGestao e ContasPagarTabContent) usam `.limit(500)`, cortando registros N8N
2. **Sem configuração de fonte**: Não há forma de a gestora controlar qual fonte de dados está ativa (N8N vs ERP API) para uma transição suave

## Solução

### Parte 1 — Corrigir consistência das tabelas

**Arquivos**: `ContasPagarGestao.tsx`, `ContasPagarTabContent.tsx`

- Substituir `.limit(500)` por paginação server-side real (como já existe em `ContasAPagar.tsx` com `range()`)
- ContasPagarGestao: implementar paginação com `range(from, to)` e `count: 'exact'`, permitindo navegar todos os registros
- ContasPagarTabContent: mesma abordagem — paginação server-side com `range()` em vez de buscar 500 e paginar em memória

### Parte 2 — Tabela de configuração de fonte de dados

**Migração SQL**: Criar tabela `ap_data_source_config`

```text
ap_data_source_config
├── id (uuid, PK)
├── source_type ('n8n' | 'erp_api' | 'both')  -- fonte ativa
├── n8n_enabled (boolean, default true)        -- N8N ativo?
├── erp_api_enabled (boolean, default false)   -- ERP API ativo?
├── auto_sync_interval_minutes (int, default 60)
├── transition_date (date, nullable)           -- data planejada para migração
├── updated_by (uuid, FK profiles)
├── updated_at (timestamptz)
└── notes (text)
```

RLS: apenas usuários com role admin/financeiro podem ler/editar.

### Parte 3 — Painel de configuração na UI

**Novo componente**: `src/components/financeiro/DataSourceConfigPanel.tsx`

- Card com toggle visual: "N8N (Webhook)" ↔ "ERP API (Direto)" ↔ "Ambos"
- Indicador de status: última sync N8N, última sync ERP API
- Campo de "Data prevista de migração" para planejamento
- Notas/observações da gestora
- Badge no sidebar indicando fonte ativa

**Integração**: Adicionar como seção na página de Sync existente (`ContasPagarSyncPage.tsx`) ou como tab adicional no `ContasPagarSyncPanel.tsx`.

### Parte 4 — Hook de configuração

**Novo hook**: `src/hooks/useDataSourceConfig.ts`

- Busca a config ativa da tabela `ap_data_source_config`
- Expõe `{ n8nEnabled, erpApiEnabled, sourceType }` para que qualquer view possa verificar
- Mutation para salvar alterações

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/pages/ContasPagarGestao.tsx` | Paginação server-side (remover `.limit(500)`) |
| `src/components/financeiro/ContasPagarTabContent.tsx` | Paginação server-side (remover `.limit(500)`) |
| `src/components/financeiro/DataSourceConfigPanel.tsx` | **Novo** — painel de config de fonte de dados |
| `src/hooks/useDataSourceConfig.ts` | **Novo** — hook para ler/salvar config |
| `src/components/financeiro/ContasPagarSyncPanel.tsx` | Integrar painel de config |
| Migração SQL | Criar tabela `ap_data_source_config` com RLS |

