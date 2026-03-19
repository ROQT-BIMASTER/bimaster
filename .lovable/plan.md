

# Migrations de Banco de Dados para Integração ERP

Cinco migrations apenas de schema — zero alterações em frontend, hooks ou Edge Functions.

---

## Migration 1: Colunas ERP em `fabrica_fornecedores`

Adicionar 11 colunas para mapeamento ERP e endereço estruturado:

- `erp_code` (varchar 50, unique) — código no ERP
- `erp_synced_at` (timestamptz) — última sincronização
- `erp_sync_status` (varchar 20, default 'pending')
- `inscricao_estadual` (varchar 20)
- `inscricao_municipal` (varchar 20)
- `cep` (varchar 10)
- `cidade` (varchar 100)
- `uf` (varchar 2)
- `bairro` (varchar 100)
- `numero` (varchar 20)
- `complemento` (varchar 100)

## Migration 2: Colunas ERP em `trade_chart_of_accounts`

- `erp_code` (varchar 50, unique) — código DE-PARA no ERP
- `erp_synced_at` (timestamptz)
- `erp_sync_status` (varchar 20, default 'pending')

## Migration 3: Colunas ERP em `erp_export_queue`

- `erp_titulo_id` (varchar 50) — ID do título retornado pelo ERP
- `erp_response_code` (varchar 20)

## Migration 4: Tabela `erp_sync_log`

Auditoria de cada chamada enviada/recebida do ERP.

Colunas: `id` (uuid PK), `entity_type` (varchar 50, NOT NULL), `entity_id` (uuid, NOT NULL), `action` (varchar 30, NOT NULL), `direction` (varchar 10, default 'outbound' — outbound/inbound), `request_payload` (jsonb), `response_payload` (jsonb), `response_status` (int), `success` (boolean, default false), `error_message` (text), `duration_ms` (int), `created_at` (timestamptz, default now()), `created_by` (uuid, nullable).

Índices conforme solicitado:
- `idx_erp_sync_log_entity` em (entity_type, entity_id)
- `idx_erp_sync_log_created` em (created_at DESC)
- `idx_erp_sync_log_direction` em (direction, created_at DESC)

RLS: leitura para authenticated, inserção via service_role.

## Migration 5: Tabela `erp_config`

Configurações da integração (URL, auth, etc).

Colunas: `id` (uuid PK), `config_key` (varchar 100, unique, NOT NULL), `config_value` (text), `description` (text), `is_secret` (boolean, default false), `updated_at` (timestamptz, default now()), `updated_by` (uuid).

RLS: leitura para authenticated, escrita restrita a admins.

---

## Resumo

- 5 migrations de schema
- 0 alterações em código existente
- 2 tabelas novas: `erp_sync_log`, `erp_config`
- 16 colunas novas em 3 tabelas existentes

