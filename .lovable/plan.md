

## Plan: Add `api_key` and `ativo` columns to `erp_config` + insert test data

### Context

The `erp_config` table currently uses a key-value pattern (`config_key` / `config_value`). Three Edge Functions (portadores, plano-contas, fornecedores-query) authenticate using this pattern and work fine. However, `erp-webhook-inbound` queries `api_key` and `ativo` as direct columns, which don't exist yet.

### Step 1 — Database migration (additive, safe)

Add two nullable columns to `erp_config`:

```sql
ALTER TABLE erp_config
  ADD COLUMN IF NOT EXISTS api_key TEXT,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;
```

### Step 2 — Insert test record

Insert a test row for empresa_id = 1 with a generated API key, populating both the new columns and the existing key-value pattern so all Edge Functions work:

```sql
INSERT INTO erp_config (empresa_id, config_key, config_value, api_key, ativo, description)
VALUES (1, 'api_key', 'test-erp-key-2026', 'test-erp-key-2026', true, 'Chave de teste para integração ERP');
```

This ensures:
- **erp-webhook-inbound** can query `.eq("api_key", apiKey).eq("ativo", true)` ✅
- **erp-portadores-api, erp-plano-contas-api, erp-fornecedores-query** can query `.eq("config_key", "api_key").eq("config_value", apiKey)` ✅

### Result

After this, you can test any ERP Edge Function with:
```
curl -H "x-api-key: test-erp-key-2026" \
  https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/erp-portadores-api/
```

