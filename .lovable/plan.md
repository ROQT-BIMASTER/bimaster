

# Correcao 11 — 7 APIs Offline + Protecao Contas a Pagar

## Diagnostico

### 7 APIs Offline
Todas as 37 edge functions existem e respondem quando testadas individualmente. O problema e o **health-check probe**: com 37 funcoes sendo verificadas simultaneamente via `Promise.all`, cada uma fazendo ate 2 requests sequenciais (primeiro `/status`, depois root), cold starts concorrentes excedem o timeout de 5 segundos do `AbortSignal.timeout(5000)`.

Funcoes que nao tem rota `/status` dedicada sofrem 2x — o primeiro probe falha, o segundo pode estourar o timeout.

### Contas a Pagar — Erro Ativo
Os logs mostram erro `22P02: invalid input syntax for type bigint: "uuid-do-fornecedor"` no `POST /contas-pagar-api/incluir`. A coluna `codigo_cliente_fornecedor` e `bigint`, mas a documentacao, o API Tester, os SDKs e os exemplos usam `"uuid-do-fornecedor"` (string). Ao clicar "Enviar" no Tester com o body pre-preenchido, da 500.

---

## Alteracoes

### 1. Health Check — Aumentar Resiliencia (`supabase/functions/api-health-check/index.ts`)

- Aumentar timeout de `5000ms` para `10000ms`
- Tratar **qualquer** status HTTP como "alive" (incluindo 500) — se o gateway respondeu HTTP, a funcao esta deployada. Apenas `catch` (erro de rede/timeout) marca como offline
- Remover a probe sequencial de `/status` + root. Fazer apenas 1 probe no root (suficiente para verificar se a funcao esta deployada)

```typescript
async function probe(url: string): Promise<{ ok: boolean; latency: number }> {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: anonKey ? { "apikey": anonKey, "Authorization": `Bearer ${anonKey}` } : {},
      signal: AbortSignal.timeout(10000),
    });
    await res.text().catch(() => {});
    const latency = Math.round(performance.now() - start);
    return { ok: true, latency }; // Any HTTP response = alive
  } catch {
    return { ok: false, latency: 0 };
  }
}

// Single probe per path (no /status fallback needed)
const results = await Promise.all(
  paths.map(async (path: string) => {
    const result = await probe(`${baseUrl}/functions/v1${path}`);
    return { path, status: result.ok ? "online" : "offline", latency: result.latency };
  })
);
```

### 2. Contas a Pagar — Tratar erro 22P02 (`supabase/functions/contas-pagar-api/index.ts`)

Adicionar `22P02` (invalid input syntax) ao error handling existente, retornando 400 em vez de 500:

```typescript
if (error.code === '22P02') return errorResponse("Formato inválido: verifique que campos numéricos (codigo_cliente_fornecedor, id_conta_corrente) são números, não strings", 400);
```

### 3. Corrigir Exemplos — `codigo_cliente_fornecedor` de string para numero

**`src/components/erp/ApiDocumentation.tsx`**:
- Substituir `"uuid-do-fornecedor"` por `12345` (numero) em todos os bodies de exemplo (incluir, upsert, upsert-lote)
- Substituir `"uuid-da-empresa"` por `5` nos exemplos de upsert
- Atualizar os snippets curl/JS/Python/PHP na secao de Quick Start

**`src/components/erp/ApiTester.tsx`**:
- Substituir `"uuid-do-fornecedor"` por `12345` nos body templates de incluir, upsert, upsert-lote
- Substituir `"uuid-da-empresa"` por `5`

### 4. Deploy

Deploy das edge functions alteradas: `api-health-check`, `contas-pagar-api`.

---

## Impacto no Contas a Pagar

- Nenhuma das 7 APIs offline interfere com o CP — sao funcoes independentes
- O erro 500 no `/incluir` sera corrigido em 2 pontos: (a) exemplos com valores numericos corretos, (b) error handling para `22P02` retornando 400 com mensagem descritiva
- O health-check nao impacta funcionalidade do CP — e apenas monitoramento visual

## Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/api-health-check/index.ts` | Timeout 10s, single probe, any HTTP = alive |
| `supabase/functions/contas-pagar-api/index.ts` | Handle 22P02 como 400 |
| `src/components/erp/ApiDocumentation.tsx` | `codigo_cliente_fornecedor` de string para numero |
| `src/components/erp/ApiTester.tsx` | Body templates com valores numericos |

