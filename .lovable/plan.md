

# Sistema de Webhooks Outbound — Event-Driven (Opção A)

BiMaster como fonte de dados → notifica ERP externo via REST direto (sem N8N).

## 1. Migration — Tabelas de Webhooks

```sql
-- Inscrições de webhooks do ERP
CREATE TABLE public.webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  url text NOT NULL,
  secret text NOT NULL, -- HMAC-SHA256 signing secret
  eventos text[] NOT NULL DEFAULT '{}', -- ex: {'cliente.criado','conta_pagar.pago'}
  ativo boolean NOT NULL DEFAULT true,
  descricao text,
  headers_customizados jsonb DEFAULT '{}',
  max_retries integer DEFAULT 3,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Fila de eventos para dispatch
CREATE TABLE public.webhook_event_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  evento text NOT NULL, -- ex: 'conta_pagar.criado'
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, sent, failed, dead
  tentativas integer DEFAULT 0,
  max_tentativas integer DEFAULT 3,
  proxima_tentativa timestamptz DEFAULT now(),
  ultimo_erro text,
  http_status integer,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

-- Log de entregas
CREATE TABLE public.webhook_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES webhook_event_queue(id),
  subscription_id uuid REFERENCES webhook_subscriptions(id),
  http_status integer,
  response_body text,
  duration_ms integer,
  erro text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_event_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_delivery_log ENABLE ROW LEVEL SECURITY;

-- RLS: service_role full access (edge functions), authenticated read own empresa
CREATE POLICY "service_full_ws" ON webhook_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_wq" ON webhook_event_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_wl" ON webhook_delivery_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_webhook_queue_pending ON webhook_event_queue(status, proxima_tentativa) WHERE status IN ('pending','failed');
CREATE INDEX idx_webhook_queue_sub ON webhook_event_queue(subscription_id);
CREATE INDEX idx_webhook_subs_empresa ON webhook_subscriptions(empresa_id) WHERE ativo = true;

-- Função helper para enfileirar eventos
CREATE OR REPLACE FUNCTION public.enqueue_webhook_event(
  p_evento text,
  p_payload jsonb,
  p_empresa_id integer DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_count integer := 0;
BEGIN
  FOR v_sub IN
    SELECT id, max_retries FROM webhook_subscriptions
    WHERE ativo = true
      AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
      AND p_evento = ANY(eventos)
  LOOP
    INSERT INTO webhook_event_queue (subscription_id, evento, payload, max_tentativas)
    VALUES (v_sub.id, p_evento, p_payload, v_sub.max_retries);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
```

## 2. Edge Function: `webhook-dispatcher`

Processa a fila e envia eventos para o ERP via REST direto.

- Busca eventos com `status IN ('pending','failed')` e `proxima_tentativa <= now()`
- Para cada evento, faz `POST` para a URL da subscription com:
  - Header `X-Webhook-Event: conta_pagar.criado`
  - Header `X-Webhook-Signature: sha256=<HMAC do payload com secret>`
  - Header `X-Webhook-Timestamp: <unix timestamp>`
  - Content-Type: `application/json`
- Se sucesso (2xx): marca `status = 'sent'`, grava `sent_at`
- Se falha: incrementa `tentativas`, calcula `proxima_tentativa` com backoff exponencial (`2^tentativas * 30s`), grava erro
- Se `tentativas >= max_tentativas`: marca `status = 'dead'`
- Grava cada tentativa em `webhook_delivery_log`
- Rate limit: processa máx 50 eventos por execução
- Pode ser chamado via cron (pg_cron) ou manualmente

| Rota | Método | Descrição |
|---|---|---|
| `/process` | POST | Processa fila de eventos pendentes |
| `/retry-dead` | POST | Reprocessa eventos mortos |
| `/stats` | GET | Estatísticas da fila |
| `/status` | GET | Health check |

## 3. Edge Function: `webhook-subscriptions-api`

CRUD de inscrições para o ERP configurar quais eventos quer receber.

| Rota | Método | Descrição |
|---|---|---|
| `/listar` | GET | Listar inscrições |
| `/consultar` | GET | Consultar por ID |
| `/incluir` | POST | Criar inscrição |
| `/alterar` | PUT | Alterar inscrição |
| `/excluir` | DELETE | Remover inscrição |
| `/eventos` | GET | Listar eventos disponíveis |
| `/testar` | POST | Enviar evento de teste |
| `/status` | GET | Health check |

**Eventos disponíveis:**

| Evento | Descrição |
|---|---|
| `cliente.criado` | Novo cliente/fornecedor |
| `cliente.alterado` | Cliente atualizado |
| `cliente.excluido` | Cliente removido |
| `conta_pagar.criado` | Novo título a pagar |
| `conta_pagar.alterado` | Título atualizado |
| `conta_pagar.pago` | Pagamento registrado |
| `conta_pagar.cancelado` | Título cancelado |
| `conta_receber.criado` | Novo título a receber |
| `conta_receber.recebido` | Recebimento registrado |
| `departamento.criado` | Novo departamento |
| `departamento.alterado` | Departamento atualizado |
| `categoria.criado` | Nova categoria |
| `categoria.alterado` | Categoria atualizada |
| `projeto.criado` | Novo projeto |
| `projeto.alterado` | Projeto atualizado |
| `conta_corrente.criado` | Nova conta corrente |
| `conta_corrente.alterado` | Conta corrente atualizada |
| `lancamento_cc.criado` | Novo lançamento CC |
| `tarefa.criado` | Nova tarefa |
| `tarefa.alterado` | Tarefa atualizada |
| `tarefa.concluido` | Tarefa concluída |

## 4. Integrar enfileiramento nas APIs existentes

Após cada operação CRUD bem-sucedida nas 20+ edge functions, chamar o RPC `enqueue_webhook_event` com o evento e payload. Exemplo no `clientes-api`:

```typescript
// Após insert bem-sucedido
await supabase.rpc("enqueue_webhook_event", {
  p_evento: "cliente.criado",
  p_payload: { id: inserted.id, codigo: inserted.codigo, ... },
  p_empresa_id: auth.empresaId ? parseInt(auth.empresaId) : null
});
```

**Funções a atualizar (adicionar enfileiramento):**
- `clientes-api` → `cliente.criado/alterado/excluido`
- `contas-pagar-api` → `conta_pagar.criado/alterado/pago/cancelado`
- `contas-receber-api` → `conta_receber.criado/recebido`
- `departamentos-api` → `departamento.criado/alterado`
- `categorias-api` → `categoria.criado/alterado`
- `projetos-api` → `projeto.criado/alterado`
- `contas-correntes-api` → `conta_corrente.criado/alterado`
- `lancamentos-cc-api` → `lancamento_cc.criado`
- `tarefas-api` → `tarefa.criado/alterado/concluido`

## 5. Implementar outbound no `integration-router`

Substituir o `TODO` atual (linha 469) pela lógica real:
- Busca config outbound, consulta dados da `entidade_destino`
- Transforma com field mappings invertidos
- Envia via REST direto para `endpoint_url` da config
- Loga resultado em `integration_logs`

## 6. Documentação no Portal

Adicionar módulo **"Webhooks Outbound"** no `ApiDocumentation.tsx` com:
- Lista de eventos disponíveis
- Exemplo de payload recebido pelo ERP
- Exemplo de validação HMAC no lado do ERP
- Endpoints de gestão de inscrições

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar 3 tabelas + função `enqueue_webhook_event` |
| `supabase/functions/webhook-dispatcher/index.ts` | Criar |
| `supabase/functions/webhook-subscriptions-api/index.ts` | Criar |
| `supabase/functions/integration-router/index.ts` | Implementar outbound |
| 9 Edge Functions existentes | Adicionar `enqueue_webhook_event` após CRUD |
| `src/components/erp/ApiDocumentation.tsx` | Adicionar módulo Webhooks |

