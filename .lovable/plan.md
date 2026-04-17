

## Diagnóstico

Parecer 9.0/10 com observação cirúrgica: o último gap para 9.8+ é comportamental — a Edge Function `erp-export-payment` retorna **500 (Internal Server Error)** quando recebe `payment_queue_id` inexistente, em vez do esperado **400/404 com mensagem clara de "referência não encontrada"**.

Isso afeta DX direto: integrador que envia UUID errado vê stack trace genérico em vez de erro acionável.

## Verificação prévia (read-only)

Preciso ler `supabase/functions/erp-export-payment/index.ts` para localizar:
1. Onde busca `payment_queue` por id
2. O que faz quando retorna `null`/vazio
3. Se há `try/catch` que está engolindo o `not found` em 500

## Escopo v2.16.1 / OpenAPI 3.8.3

### 1. Fix comportamental: 404 com mensagem clara

Em `supabase/functions/erp-export-payment/index.ts`, após query de `payment_queue` por `payment_queue_id`:

```ts
if (!paymentQueue) {
  return new Response(JSON.stringify({
    error: "payment_queue_not_found",
    message: `Nenhum registro encontrado em payment_queue para id=${payment_queue_id}`,
    payment_queue_id,
    request_id: requestId,
  }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
```

Aplicar o mesmo padrão para `payment_id` ausente em outras branches. Garantir que erros de validação Zod retornem **400** (não 500) — provavelmente já é o caso via `secureHandler`, confirmar.

### 2. Verificação ao vivo após deploy

Usar `supabase--curl_edge_functions` para chamar a função com `payment_queue_id="00000000-0000-0000-0000-000000000000"` e confirmar:
- Status: 404 (não 500)
- Body: JSON com `error`, `message`, `request_id`
- Header: `x-request-id` presente

### 3. Documentar no OpenAPI

Em `ApiDocumentation.tsx`, no endpoint `/erp-export-payment`, adicionar resposta `404`:
```ts
{ status: 404, description: "payment_queue_id não encontrado", example: { error: "payment_queue_not_found", message: "...", request_id: "..." } }
```

### 4. Smoke test mínimo Python — adicionar caso 404

Estender o bloco de smoke test embutido no SDK Python para incluir 1 case que mocka resposta 404 e confirma que `HuggsAPIError` é levantada com `status=404` e `request_id` populado.

### 5. Changelog v2.16.1 (disciplinado)

Listar com grep verificável:
- `grep -c "payment_queue_not_found" supabase/functions/erp-export-payment/index.ts` ≥ 1
- `grep -c "status: 404" supabase/functions/erp-export-payment/index.ts` ≥ 1
- Resultado live: `curl ... payment_queue_id=00000000-... → 404`

### 6. Bump versão

- Edge function: comportamento corrigido (sem mudança de SDK)
- OpenAPI: **3.8.2 → 3.8.3** (apenas docs do 404)
- SDK: **2.16.0 → 2.16.1** (smoke test estendido)
- `APP_VERSION`: **2.31.0 → 2.31.1**

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/erp-export-payment/index.ts` | 404 explícito quando `payment_queue_id` não existe; idem para `payment_id` |
| `src/components/erp/ApiDocumentation.tsx` | Resposta 404 documentada em `/erp-export-payment`; bump 3.8.3; changelog v2.16.1 |
| `src/components/erp/SdkDownloadButtons.tsx` | Smoke test Python +1 case 404; bump SDK 2.16.1 |
| `src/lib/version.ts` | APP_VERSION 2.31.1 |

## Validação ao vivo (via tools, não shell)

Após deploy, executar `supabase--curl_edge_functions`:
1. POST `/erp-export-payment` com payload válido mas `payment_queue_id` inexistente → esperar **404**
2. POST com payload inválido (sem `payment_queue_id`) → esperar **400**
3. OPTIONS → esperar **200** com CORS

## Não-escopo

Refatoração ampla do `secureHandler`; novos endpoints; mudanças no SDK além do smoke test.

## Impacto esperado

9.0 → 9.5+ (parcial, depende do deploy ao vivo confirmar). Fecha o último gap comportamental apontado pelo revisor: "erro 500 vs 400 com mensagem clara para referência inexistente".

