

# Correções v2.6.0 → v2.7.0: Promover Retry Idempotente à API Pública

## Diagnóstico

Parecer subiu 7.5 → 8.0. Blockers anteriores foram resolvidos. Restam **2 ajustes acionáveis** + **1 documentação** sem reescrever testes (fora de escopo).

## Escopo

### 1. Promover retry à API pública dos endpoints financeiros (item #1 e #2 do parecer)

**Problema:** `_request_with_retry` existe mas é privado (underscore). Métodos públicos como `cpLancarPagamento`, `cpRegistrarPagamento`, `cpEstornar`, `cpIncluir`, `cpUpsert` chamam `_request` direto, sem retry idempotente. Usuário precisa descer ao privado para ter proteção contra timeout/5xx.

**Correção (TS/JS/Python SDKs):**
- Adicionar parâmetro opcional `options?: { retry?: boolean; idempotencyKey?: string }` (TS/JS) e `*, retry: bool = False, idempotency_key: Optional[str] = None` (Python) nos métodos financeiros críticos:
  - `cpIncluir`, `cpAlterar`, `cpUpsert`
  - `cpLancarPagamento`, `cpRegistrarPagamento`
  - `cpCancelarPagamento`, `cpEstornar`
  - `cpExcluir`
- Internamente: se `retry=true`, chamar `_requestWithRetry`; senão, `_request` (mantém comportamento default).
- `idempotencyKey` é propagada para garantir chave determinística cross-session.

### 2. TypedDict para respostas Python (item #6 — paridade de tipagem)

**Problema:** Python retorna `Dict[str, Any]` enquanto TS tem `CpConsultarResponse`, `CpQueryResponse`, `CpParcelasResponse`, `CpPagamentosResponse` com campos tipados.

**Correção:** Adicionar `TypedDict` (stdlib, sem dependência) para as 4 respostas principais:
- `CpConsultarResponse`, `CpQueryResponse`, `CpParcelasResponse`, `CpPagamentosResponse`
- Atualizar assinaturas: `def cp_consultar(...) -> CpConsultarResponse`, etc.
- Runtime continua retornando `dict` — só ganho de IDE/mypy.

### 3. Documentar promoção no comentário inline e changelog (item #5 — debt consciente)

- Atualizar guia inline do CP no header do SDK explicando o novo padrão `retry=True` para endpoints financeiros.
- Adicionar nota sobre `idempotency_key` derivada de `codigo_lancamento_integracao` para idempotência cross-session.

### 4. Bump versão e changelog

- SDKs: **v2.6.0 → v2.7.0**
- OpenAPI: mantém **3.3.0** (nenhuma mudança de contrato).
- Changelog em `ApiDocumentation.tsx` registrando: retry público nos endpoints financeiros, TypedDict Python, exemplos canônicos.

## Não-escopo (debt consciente, fora desta rodada)

- **Testes unitários** (item #3): trabalho separado, requer infra de mocks HTTP no SDK gerado (não trivial num gerador de string).
- **Deprecation formal família CP** (item #5): exige timeline acordado com clientes externos.
- **`CpUpsertPayload` empresa_id="" default** (item #4): validação runtime já pega, reescrever exigiria pydantic.
- **Supabase URL no dev server** (item #7): baixa gravidade, infra do Lovable.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/erp/SdkDownloadButtons.tsx` | TS/JS/Python: parâmetro `retry`/`idempotencyKey` nos métodos CP financeiros, TypedDict Python para respostas, guia inline atualizado, bump v2.7.0 |
| `src/components/erp/ApiDocumentation.tsx` | Changelog v3.3.0 registrando promoção pública do retry |

## Impacto esperado

Parecer subir de 8.0 → ~8.5. Para GA (9.0) faltariam apenas testes unitários e deprecation plan formal — itens fora desta rodada.

