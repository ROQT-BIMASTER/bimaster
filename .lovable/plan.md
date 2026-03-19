

# Migration 7: Complementar erp_export_queue + Reforçar RLS na erp_sync_log

## Situação Atual

### erp_export_queue
- Já possui: `erp_titulo_id` (varchar 50), `erp_response_code` (varchar 20), `response` (jsonb)
- **Falta**: `titulo_numero` (varchar), `erp_sync_status` (varchar 20, default 'pending')
- A coluna `response` já serve como "resposta completa do ERP" (jsonb)

### erp_sync_log
- RLS habilitada, mas apenas com:
  - SELECT para `authenticated`
  - INSERT para `service_role`
- **Falta**: policies de UPDATE e DELETE para `service_role`, e policy de INSERT para `authenticated` (Edge Functions rodando como authenticated)

## O que será feito

### Parte 1: Adicionar colunas à erp_export_queue
```sql
ALTER TABLE public.erp_export_queue
  ADD COLUMN IF NOT EXISTS titulo_numero varchar,
  ADD COLUMN IF NOT EXISTS erp_sync_status varchar(20) DEFAULT 'pending';
```

### Parte 2: Completar RLS na erp_sync_log
Seguindo o padrão da `erp_export_queue` (que usa `can_access_payment_queue`):
```sql
-- Authenticated users can insert (for Edge Functions)
CREATE POLICY "Authenticated users can insert erp_sync_log"
  ON public.erp_sync_log FOR INSERT
  TO authenticated WITH CHECK (true);

-- Service role can update
CREATE POLICY "Service role can update erp_sync_log"
  ON public.erp_sync_log FOR UPDATE
  TO service_role USING (true);

-- Service role can delete
CREATE POLICY "Service role can delete erp_sync_log"
  ON public.erp_sync_log FOR DELETE
  TO service_role USING (true);
```

### Arquivos afetados
- Nova migration SQL
- `types.ts` será atualizado automaticamente

