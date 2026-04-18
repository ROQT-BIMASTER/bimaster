

## Diagnóstico — auditoria majoritariamente correta, com 2 ajustes

### Item 1 — `ContaCorrentePayload` BUG REAL CONFIRMADO (severidade ALTA)
Runtime (`supabase/functions/contas-correntes-api/index.ts` + `docs/API_CONTAS_CORRENTES.md`) exige:
- `cCodCCInt` (código integração — chave para upsert/consultar/excluir)
- `tipo_conta_corrente` (CC/CP/CX/CI/CM/PI)
- `codigo_banco`, `codigo_agencia`, `numero_conta_corrente`
- `descricao`, `saldo_inicial`, `valor_limite`, `pix_sn`, `bol_sn`

SDK TS (linha 418) envia `tipo`, `banco_codigo`, `agencia`, `conta` — **nomes errados**, sem `cCodCCInt`. JS JSDoc (linha 2534) idem. Python `cc_incluir` (3910) usa `Dict` cru → desenvolvedor não tem guia, manda nomes errados.

**Análogo direto ao bug `events`/`eventos`**. SDK TS está mandando payload que o runtime ignora silenciosamente (campos extras passam, campos esperados ausentes ⇒ insert sem dados ou erro `CAMPO_OBRIGATORIO`).

### Item 2 — `EmpresaInput` (severidade MÉDIA confirmada)
Runtime `empresas-api` aceita os 7 campos via Zod `.optional()` (linhas 39-48). 
- TS interface (440-465): **já tem os 7** + `endereco_numero`. ✅
- Python `EmpresaIncluirPayload` (3032-3059): **falta os 7**. ❌
- OpenAPI `EmpresaInput` (1137-1162): **falta os 7**. ❌

### Item 3 — Schemas órfãos (auditor errou em 3, acertou em 5)
**NÃO são órfãos** (verificado em `PATH_SCHEMA_MAP`):
- `ClienteListarRequest` ← `POST:/clientes-api/listar` (1326)
- `ContaPagarResponse` ← cpIncluir/cpUpsert/crIncluir (1330/1332/1336) 
- `WebhookSubscriptionResponse` ← webhookIncluir (1377)

→ **Manter os 3** intactos.

**Realmente desconectados** (precisam wiring para deixar de ser órfãos):
- `ErrorAuth`, `ErrorRateLimit`, `ErrorValidation` — `stdErrors` (linha 1471) usa `components/responses/Error*` que tem schemas **inline** (linhas 1861-1873). Trocar inline por `$ref: schemas/Error*`.
- `IdempotencyHeaders` — adicionar como `parameter` opcional em writes.
- `MetaEnvelope` — referenciar no `info.description` (não em response 200, pois cada endpoint já tem schema próprio com envelope embutido).

### Item extra (descoberta)
`ContaCorrenteResponse` foi removido do OpenAPI no PR-19 mas **TS SDK ainda exporta a interface** (linha 595) e usa como return type de `ccIncluir` (1533) e `ccUpsertLote` (1534). SDK não compilará após dev externo fazer tree-shaking. Realinhar return types para `MutationResponse` (que é o que `ccIncluir` realmente devolve, conforme runtime linha 332-336).

## Plano — PR-20 (SDK 3.2.4 / OpenAPI 4.3.3 / APP 3.1.12)

### Fase 1 — Fix `ContaCorrentePayload` nos 3 SDKs
`SdkDownloadButtons.tsx`:
1. **TS interface** (418-425): substituir por payload completo conforme runtime — `cCodCCInt?`, `descricao` (req), `tipo_conta_corrente?` (enum), `codigo_banco?`, `codigo_agencia?`, `numero_conta_corrente?`, `saldo_inicial?`, `valor_limite?`, `pix_sn?`, `bol_sn?`. Manter aliases legados (`tipo?`, `banco_codigo?`, `agencia?`, `conta?`) por **1 versão** com JSDoc `@deprecated`.
2. **TS `ContaCorrenteResponse`** (595-603): atualizar campos para refletir runtime real (`nCodCC`, `cCodCCInt`, `codigo_status`, `descricao_status`).
3. **TS `ccIncluir` retorno** (1533): trocar `ContaCorrenteResponse` → `MutationResponse & { nCodCC?, cCodCCInt? }`.
4. **TS `_validate`** em `ccIncluir`: exigir `descricao` ou `cCodCCInt` (espelha linha 309 do runtime).
5. **JS JSDoc** (2534): atualizar param doc para nomes corretos.
6. **Python**: criar `@dataclass ContaCorrentePayload` com mesmos campos + tornar `cc_incluir(body: ContaCorrentePayload)` typed (espelha pattern de `ClientePayload`).

### Fase 2 — Empresas alinhamento
1. **OpenAPI `EmpresaInput`** (1137-1162): adicionar `responsavel_nome`, `responsavel_cpf`, `capital_social` (number), `data_abertura` (string format date), `regime_tributario` (string max 1 com description dos códigos), `codigo_ibge_municipio` (integer), `natureza_juridica`. Atualizar `description` PR-20.
2. **Python `EmpresaIncluirPayload`** (3032-3059): adicionar os 7 campos como `Optional[...]`.

### Fase 3 — Wiring de schemas órfãos
1. **Substituir inline por `$ref`** em `components.responses` (1859-1874):
   - `ErrorBadRequest.content.schema` → `{ $ref: "#/components/schemas/ErrorValidation" }`
   - `ErrorUnauthorized.content.schema` → `{ $ref: "#/components/schemas/ErrorAuth" }`
   - `ErrorRateLimited.content.schema` → `{ $ref: "#/components/schemas/ErrorRateLimit" }`
2. **`IdempotencyHeaders`** como parameters em writes: criar `components.parameters.IdempotencyKey` e `RequestId` referenciando os campos do schema; adicionar nos endpoints onde `isWriteOp(method, path)` é true (loop existente em 1483).
3. **`MetaEnvelope`**: adicionar nota em `info.description` apontando para `#/components/schemas/MetaEnvelope` ("Toda response 2xx inclui campo `meta` conforme schema MetaEnvelope").

### Fase 4 — Versionamento + changelog
- `SDK_VERSION = "3.2.4"`.
- `version: "4.3.3"` no OpenAPI.
- `APP_VERSION = '3.1.12'` em `src/lib/version.ts` com nota PR-20.
- Inline changelog v4.3.3 em `ApiDocumentation.tsx` (mandatório por `release-changelog-discipline`).
- Header changelog dos SDKs atualizado.

### Fase 5 — Regression (`audit/regression-greps.sh`)
6 invariantes novos:
- `tipo_conta_corrente` no SDK ≥3 (TS interface + JS JSDoc + Python dataclass).
- `cCodCCInt` no SDK ≥3 (idem).
- `responsavel_nome` no Python SDK ≥1 (era 0).
- `responsavel_nome` no `EmpresaInput` do OpenAPI ≥1.
- `$ref.*ErrorAuth`, `$ref.*ErrorRateLimit`, `$ref.*ErrorValidation` em `ApiDocumentation.tsx` ≥1 cada.
- `version: "4.3.3"` ≥1; `SDK_VERSION = "3.2.4"` ≥1.
- Negative: `tipo:.*string.*$` na interface `ContaCorrentePayload` removido (verificar via context grep).

### Fase 6 — Smoke E2E
1. `POST /contas-correntes-api/incluir` com payload novo (`cCodCCInt`+`descricao`+`tipo_conta_corrente`+`codigo_banco`) → 201 com `{cCodCCInt, codigo_status:"0"}`.
2. `POST /empresas-api/incluir` com `responsavel_nome`+`capital_social` → 201 (campos persistidos).
3. `bash audit/regression-greps.sh` → todos verdes.

## Não-escopo
- Auditor sugeriu remover `ClienteListarRequest`/`ContaPagarResponse`/`WebhookSubscriptionResponse` — **não remover** (estão referenciados em `PATH_SCHEMA_MAP`).
- Não tocar Edge Functions (runtime já correto em ambos os módulos).

## Impacto
**4 arquivos**: `SdkDownloadButtons.tsx` (~50 linhas — payload CC nos 3 SDKs + EmpresaIncluirPayload Python), `ApiDocumentation.tsx` (~30 linhas — EmpresaInput +7 campos, $ref nos 3 ErrorResponses, IdempotencyKey parameter, changelog, version), `version.ts` (1 linha + nota), `audit/regression-greps.sh` (+6 invariantes).

**Risco: baixo-médio** — fix do CC corrige bug real em produção; aliases legados dão grace period; mudanças em schemas/$ref são documentais.

