

## Análise e Plano: sync_control para Contas a Receber + Validação Edge Function

### Situação Atual

A tabela `sync_control` **já existe** (criada na migration `20251201053218`), mas com schema diferente do solicitado. Ela usa `entidade` + `empresa_id` como identificador (log de cada sync), não como cursor incremental com `workflow_name` + `offset_cursor`.

A edge function `contas-receber-api` **já faz UPSERT** corretamente na tabela `contas_receber` usando `onConflict: 'erp_id'` (chave composta: empresa_id + tipo + nota + seq + codigo). Aceita arrays de 1 a N registros sem limite mínimo.

### Respostas às Perguntas

1. **Aceita arrays menores?** Sim — `extractRecords()` aceita de 1 a qualquer quantidade de registros
2. **Faz UPSERT?** Sim — usa `.upsert(batch, { onConflict: 'erp_id', ignoreDuplicates: false })`
3. **Tabela destino:** `contas_receber`
4. **Credenciais Supabase:** A URL é `https://aokkyrgaqjarhlywhjju.supabase.co`. A Service Role Key é um segredo que não posso expor no chat — você pode obtê-la no painel do backend

### Plano de Implementação

#### 1. Migration: Adicionar colunas de cursor à `sync_control`

Como a tabela já existe com schema de log, vou adicionar as colunas necessárias para o cursor incremental do n8n:

```sql
ALTER TABLE public.sync_control 
  ADD COLUMN IF NOT EXISTS workflow_name text,
  ADD COLUMN IF NOT EXISTS offset_cursor bigint DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_control_workflow 
  ON public.sync_control (workflow_name) WHERE workflow_name IS NOT NULL;

INSERT INTO public.sync_control (workflow_name, offset_cursor, entidade)
VALUES ('contas_receber', 0, 'contas_receber')
ON CONFLICT DO NOTHING;
```

A RLS já está configurada na tabela (service_role access via policies existentes).

#### 2. Credenciais para n8n

Informarei a URL do projeto e orientarei sobre como obter a Service Role Key pelo painel do backend.

### Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Adicionar `workflow_name` e `offset_cursor` à `sync_control` existente |

