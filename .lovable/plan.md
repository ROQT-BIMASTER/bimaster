

# v2.9.0 / OpenAPI 3.5.0 — Fechar Gap para GA 9.0+

## Diagnóstico

Parecer 8.5 → meta 9.0+. Bloqueador real é **Edge Function 500 "Unknown error"** (precisa virar 400 com mensagem clara). Resto é polimento de DX e tipagem.

## Escopo

### 1. Edge Function `erp-export-payment` — erro 400 estruturado (item crítico, +0.3)

**Investigar primeiro**: ler `supabase/functions/erp-export-payment/index.ts` para ver onde o "Unknown error" 500 é gerado. Tipicamente vem de `error.message` undefined em `try/catch` genérico.

**Correção:** padronizar handler com `secureHandler` + `handleError` (já existem em `_shared/`). Substituir respostas genéricas por:
- 400 com `{ error: "validation_error", message, details }` quando payload inválido
- 401/403 via `AuthError`
- 500 só em falha real de infra, com `request_id` para rastreio
- Validar `payment_queue_id` (UUID) e `export_type` (`registration|payment`) com Zod antes de qualquer lógica

### 2. Polimento SDK (3 itens menores, +0.15 total)

**a) `crConsultar` tipado** (TS/JS): trocar `Promise<Record<string, unknown>>` por `Promise<CrConsultarResponse>` (espelhar `CpConsultarResponse`).

**b) `_validate` em `cpQuery` e `crExcluir`**: ambos pulam validação. Adicionar:
- `cpQuery`: validar que pelo menos um filtro foi passado, rejeitar chaves desconhecidas
- `crExcluir`: exigir `codigo_lancamento_integracao` ou `codigo_lancamento_huggs`

**c) Exemplo OpenAPI `POST /erp-export-payment/`**: trocar exemplo string por objeto JSON real:
```json
{ "payment_queue_id": "uuid", "export_type": "payment", "channel": "manual" }
```

### 3. Documentação DX (importante, +0.25)

**a) Guia "Primeiros 5 Minutos"** — nova seção em `ApiDocumentation.tsx` no topo:
- Passo 1: gerar API key (link para tela)
- Passo 2: instalar SDK (`pip install` / `npm i` ou copiar arquivo)
- Passo 3: primeiro request (`erp.cpConsultar({ codigo_lancamento_integracao: "TEST-001" })`)
- Passo 4: tratar erro de negócio (try/catch + `codigo_status`)
- Passo 5: produção com retry (`{ retry: true, idempotencyKey: "..." }`)

**b) Tabela "Quando usar cada método"** — nova seção:

| Cenário | Use | Não use |
|---|---|---|
| Criar título novo (primeira vez) | `cpIncluir` | `cpUpsert` (silencia conflito) |
| Sincronizar de sistema externo (idempotente) | `cpUpsert` | `cpIncluir` (falha em duplicata) |
| Baixa unitária com idempotência forte | `cpLancarPagamento` | `cpRegistrarPagamento` (legado) |
| Compatibilidade família legada | `cpRegistrarPagamento` | — |
| Lote >100 títulos | `cpUpsertLote` + `retry: true` | loop de `cpUpsert` |

Espelhar para CR.

### 4. Bump versão e changelog

- SDKs: **v2.8.0 → v2.9.0**
- OpenAPI: **3.4.0 → 3.5.0**
- Changelog: erro 400 estruturado em `erp-export-payment`, `crConsultar` tipado, `_validate` em `cpQuery`/`crExcluir`, exemplo JSON, guia 5-min, tabela de decisão.

### 5. Validação

- `tsc --noEmit` confirmar zero regressão.
- Curl em `erp-export-payment` com payload inválido para confirmar 400 (não 500).

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/erp-export-payment/index.ts` | Migrar para `secureHandler`, validar com Zod, retornar 400 estruturado, eliminar "Unknown error" |
| `src/components/erp/SdkDownloadButtons.tsx` | TS/JS: tipo retorno `crConsultar`, `_validate` em `cpQuery`/`crExcluir`; bump v2.9.0; nota inline sobre erro 400 estruturado |
| `src/components/erp/ApiDocumentation.tsx` | Exemplo JSON em `/erp-export-payment/`, seção "Primeiros 5 Minutos", tabela "Quando usar cada método", bump OpenAPI 3.5.0, changelog |
| `src/lib/version.ts` | Bump APP_VERSION para forçar refresh do portal |

## Não-escopo

Mantém fora: testes unitários do SDK (gerador em string), deprecation formal família CP, reescrita pydantic do payload Python.

## Impacto esperado

8.5 → ~9.0 se a Edge Function passar a retornar 400 estruturado em payload inválido. Para >9.0 só faltariam testes unitários e deprecation plan formal.

