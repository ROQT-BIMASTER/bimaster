

## Diagnóstico — auditoria confere, com 1 ajuste

Validei runtime e código:

### Item 1 — Duplicação `cpAnexos` CONFIRMADA
`toOperationId()` (linha 1501) gera nome **só** a partir de path+prefixo, ignorando method. GET `/anexos` e POST `/anexos` colidem em `cpAnexos`. Quebra geradores OpenAPI.

**Fix**: tornar generator method-aware com sufixo semântico **apenas quando há colisão**. Estratégia limpa: pós-processar o array de endpoints e detectar (path,prefix) duplicados → para esses, anexar `Listar` (GET) / `Incluir` (POST) / `Alterar` (PUT) / `Excluir` (DELETE). Mantém todos os 154 IDs atuais intactos.

### Item 2 — `events` vs `eventos` CONFIRMADO — SDK quebrado
Edge function (linhas 109, 111, 117, 128, 133) **só aceita `eventos`**. Os 3 SDKs enviam `events` → runtime retorna 400 "Campos obrigatórios: ...eventos". O OpenAPI já está correto.

**Fix nos 3 SDKs** (`SdkDownloadButtons.tsx`):
- TS interface `WebhookSubscribePayload` (linha 489): renomear `events` → `eventos`. Idem `WebhookSubscriptionResponse` linha 858.
- TS `webhookIncluir` (linhas 1601-1605): trocar `body.events` → `body.eventos` + mensagem.
- JS `webhookIncluir` (linhas 2697-2701) + JSDoc.
- Python `WebhookSubscribePayload` (linha 2999) + `webhook_incluir` (linhas 3989-3995).
- Adicionar campo opcional `headers_customizados?: Record<string,string>` nos 3 SDKs (runtime aceita, linha 130).
- Manter `secret`, `descricao`, `max_retries`, `empresa_id` que o runtime já espera.

### Item 3 — 30 operationIds em snake+camel CONFIRMADO
Causa raiz no `toOperationId` (linhas 1501-1518): quando o módulo **não está em `moduleMap`** (`erp_plano_contas`, `erp_portadores`, `erp_fornecedores`, `contas_pagar_export`, `resumo_financeiro`, `pesquisar_lancamentos`, `movimentos_financeiros`, `tabela_de_titulos`, etc.), o `apiName` snake_case vira prefixo cru.

**Fix**: 
1. Estender `moduleMap` com aliases curtos para os 30 casos (ex: `contas_pagar_export → cpExport`, `resumo_financeiro → resumoFinanceiro`, `erp_plano_contas → planoContas`, `erp_portadores → portadores`, `pesquisar_lancamentos → pesquisarLanc`, `movimentos_financeiros → movFin`, `tabela_de_titulos → tabelaTitulos`).
2. Adicionar fallback: se `apiName` ainda contém `_`, converter o próprio prefixo para camelCase (`apiName.replace(/_([a-z])/g, ...)`). Garante zero underscores em qualquer operationId futuro.
3. Tratar `action === "root"` (raízes de módulo) → usar verbo (`Listar` para GET, `Criar` para POST) em vez de literal `Root`.

### Item 4 — Drift `ClienteInput`/`EmpresaInput`
Não vou abrir 11 endpoints com curl (risco/ruído). Decisão pragmática:
- **ClienteInput**: alinhar OpenAPI ao SDK (remover do schema OpenAPI: `endereco_numero`, `bairro`, `celular`, `observacao`, `pessoa_fisica`, `contribuinte` — não estão no SDK e auditoria os marca como inatingíveis).
- **EmpresaInput**: alinhar OpenAPI ao SDK (adicionar ao schema OpenAPI: `codigo_erp`, `complemento`, `bairro`, `telefone1_ddd`, `telefone1_numero` e demais que TS tem). SDK é a fonte da verdade porque já valida em produção.

### Item 5 — Schemas órfãos
- **Manter e referenciar**: `ErrorAuth` em 401, `ErrorValidation` em 400, `ErrorRateLimit` em 429, `IdempotencyHeaders` como parameters em writes financeiros, `MetaEnvelope` no envelope padrão.
- **Remover do `schemas`**: `ContaPagarResponse` (já é `ContaPagarOut` no PATH_SCHEMA_MAP), `ContaCorrenteResponse`, `BancoResponse`, `CidadeResponse`, `PaisResponse`, `FornecedorQuery`, `ClienteResumido`, `ClienteListarRequest`, `WebhookSubscriptionResponse` (se não referenciados após dedup), `ExportConfirmInput`, `ExportPendingResponse`. Auditar `$ref` antes de cortar — qualquer um citado em `PATH_SCHEMA_MAP` fica.

### Item 6 — Política `required` em responses
Apenas adicionar nota na descrição do OpenAPI (linha 1750ish): "Response fields are documented as optional for forward-compatibility. SDKs type them as required based on current runtime guarantees."

## Plano — PR-19 (SDK 3.2.3 / OpenAPI 4.3.2 / APP 3.1.11)

### Fase 1 — SDK fix `events → eventos` + `headers_customizados`
`SdkDownloadButtons.tsx`:
- TS: renomear campo nas interfaces + método + validação (3 locais).
- JS: renomear no método + JSDoc.
- Python: renomear no dataclass + método.
- Bumpar `SDK_VERSION` para `3.2.3`.
- Atualizar header changelog.

### Fase 2 — OpenAPI generator hardening (`ApiDocumentation.tsx`)
1. **Estender `moduleMap`** (~linha 1506) com 7-10 aliases para os módulos não mapeados.
2. **Sanitizar prefixo**: após `moduleMap[apiName] || apiName`, aplicar `.replace(/_([a-z])/g, (_,c)=>c.toUpperCase())` no prefixo bruto.
3. **Method-aware suffix on collision**: após gerar todos os operationIds, agrupar por nome → para grupos com >1 entrada, anexar `Listar/Incluir/Alterar/Excluir` baseado no method.
4. **Action `root`**: substituir por verbo derivado de method (GET→Listar, POST→Criar, etc.) em vez de literal "Root".
5. Bump `version: "4.3.1"` → `"4.3.2"` (linha ~1754).

### Fase 3 — Schemas alignment
1. `ClienteInput`: remover 6 campos extras (endereco_numero, bairro, celular, observacao, pessoa_fisica, contribuinte).
2. `EmpresaInput`: adicionar campos do SDK TS (codigo_erp, complemento, bairro, telefone1_ddd, telefone1_numero).
3. `WebhookSubscribeInput`: adicionar `descricao`, `max_retries`, `empresa_id` se faltarem (já `headers_customizados` está presente).
4. **Auditar e remover schemas órfãos**: rodar busca `$ref.*<NomeSchema>` para cada um dos 11 candidatos; remover só os com 0 refs.

### Fase 4 — Versionamento + changelog
- `APP_VERSION = '3.1.11'` em `src/lib/version.ts` com nota PR-19.
- Inline changelog v4.3.2 em `ApiDocumentation.tsx` (mandatório por `release-changelog-discipline`).
- Adicionar nota no header sobre política de `required` em responses.

### Fase 5 — Regression
`audit/regression-greps.sh` — adicionar 6 invariantes:
- `events:` no SDK ≤0 (apenas `eventos:` aceito).
- `eventos:` no SDK ≥3 (TS+JS+Python).
- `headers_customizados` no SDK ≥3.
- `version: "4.3.2"` ≥1.
- Operação `cpAnexosListar` E `cpAnexosIncluir` no `toOperationId` test (grep no source ou inline test).
- Zero underscores em operationId: invariante do gerador.

### Fase 6 — Smoke E2E
1. `POST /webhook-subscriptions-api/incluir` com `eventos:["conta_pagar.criado"]` → 201 (após deploy do SDK).
2. `bash audit/regression-greps.sh` → todos verdes.

## Não-escopo
- Não tocar `webhook-subscriptions-api` (runtime já correto).
- Não rodar curl em todos os 41 schemas (Cliente/Empresa drift resolvido por code-alignment com SDK como source of truth).

## Impacto
**4 arquivos**: `SdkDownloadButtons.tsx` (renomear campo + headers_customizados, ~12 linhas), `ApiDocumentation.tsx` (generator hardening + schemas + changelog, ~40 linhas), `version.ts` (1 linha), `audit/regression-greps.sh` (+6 invariantes). **Risco: baixo** — fix do `events→eventos` corrige bug real em produção; mudanças no generator só afetam IDs gerados (sem consumidor no runtime).

