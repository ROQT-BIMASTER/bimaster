

# Ambiente Sandbox — Adicional ao Portal de Integração

## Resumo

Adicionar um toggle **Produção / Sandbox** no ApiTester que, quando ativado, roteia chamadas para uma edge function `api-sandbox` que simula respostas realistas sem gravar dados no banco. Nenhuma funcionalidade existente será removida ou alterada.

## Arquitetura

```text
ApiTester.tsx
  ├─ [Produção] → fetch(BASE_URL + path)      ← como funciona hoje (inalterado)
  └─ [Sandbox]  → fetch(BASE_URL + /api-sandbox) body: { path, method, payload }
                    └─ Edge Function api-sandbox
                         ├─ Valida schema (mesma lógica)
                         ├─ NÃO grava no banco
                         ├─ Retorna resposta simulada realista
                         └─ Loga na tabela sandbox_requests
```

## Implementação

### 1. Edge Function `api-sandbox` (novo)

**Arquivo: `supabase/functions/api-sandbox/index.ts`**

- Recebe `{ path, method, headers, body }` via POST
- Valida auth (JWT do usuário logado — sem x-api-key necessário)
- Mapeia o `path` para respostas simuladas (mock data) baseadas nos mesmos schemas das APIs reais
- Marca toda resposta com `"sandbox": true, "dry_run": true`
- Registra a chamada na tabela `sandbox_requests`
- Endpoints de status (`/status`) retornam health check real (passthrough)
- Para endpoints de escrita (`incluir`, `upsert`, `alterar`, `excluir`), retorna sucesso simulado com dados fictícios
- Para endpoints de leitura (`listar`, `consultar`), retorna dados de exemplo pré-definidos

### 2. Migração SQL — Tabela `sandbox_requests`

```sql
CREATE TABLE sandbox_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  method text NOT NULL,
  request_body jsonb,
  response_body jsonb,
  response_status int DEFAULT 200,
  duration_ms int,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sandbox_requests ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas seus requests
CREATE POLICY "Users see own sandbox requests"
  ON sandbox_requests FOR ALL
  TO authenticated
  USING (user_id = auth.uid());
```

### 3. Toggle no ApiTester

**Arquivo: `src/components/erp/ApiTester.tsx`** (adição, sem remover nada)

- Novo state `sandboxMode` (boolean, default false)
- Switch toggle no header do tester com label "Sandbox" e badge laranja
- Quando `sandboxMode = true`:
  - Em vez de `fetch(finalUrl, options)`, faz `supabase.functions.invoke("api-sandbox", { body: { path, method, headers, body } })`
  - Badge "SANDBOX" aparece ao lado do botão Send
  - Respostas exibidas com borda laranja e indicador visual "Dry Run"
- Quando `sandboxMode = false`: comportamento 100% inalterado (fetch direto)

### 4. Indicador visual na Documentação

**Arquivo: `src/components/erp/ApiDocumentation.tsx`** (adição mínima)

- Nota informativa no topo: "Use o modo Sandbox no API Tester para testar sem afetar dados reais"
- Nenhuma alteração nos exemplos de código ou cURL existentes

## Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `supabase/functions/api-sandbox/index.ts` | **Novo** — Proxy sandbox com respostas simuladas |
| `src/components/erp/ApiTester.tsx` | **Adição** — Toggle sandbox + lógica condicional de envio |
| `src/components/erp/ApiDocumentation.tsx` | **Adição mínima** — Nota informativa sobre sandbox |
| Migração SQL | **Nova** — Tabela `sandbox_requests` com RLS |

## O que NÃO muda

- Todo o fluxo de produção do ApiTester permanece idêntico
- ApiDocumentation, exemplos, cURL generator, Postman export — tudo inalterado
- ApiStatusBadge, ApiGlobalStatus — inalterados
- Nenhum endpoint de produção é modificado

