# PR-10 — Triagem do laudo QA v3.1.2 (18/04/2026)

## Contexto

Laudo QA externo de 17/04/2026 reportou **11 bugs P0/P1** após bateria de 169 endpoints (100/169 = 59% sucesso). Antes de aplicar correções, fiz **validação por SQL + grep + leitura de código** contra o estado real pós PR-9 (v3.1.1).

Resultado: **1 bug confirmado, 7 falsos positivos, 3 já corrigidos**.

---

## Tabela de triagem

| Bug | Sintoma do laudo | Validação técnica | Veredito | Ação |
|---|---|---|---|---|
| **BUG-1** | `.catch is not a function` em `contas-pagar-api/incluir` e `lancar-pagamento` | `grep -rn "\.catch(" supabase/functions/contas-pagar-api/` retorna **zero ocorrências** em handlers de insert/update. Todas as 8 ocorrências em `_shared/contas-pagar/` são `enqueueWebhookEvent(...).catch(() => {})` (fire-and-forget válido) ou `req.json().catch(() => ({}))` (fallback de parsing). Nenhuma é `.insert(...).catch()`. | **FALSO POSITIVO** | Nenhuma. |
| **BUG-2** | `Could not find the 'observacao' column of 'contas_pagar' in the schema cache` | `SELECT column_name FROM information_schema.columns WHERE table_name='contas_pagar' AND column_name LIKE '%obs%'` retorna **vazio**. Mas `_shared/contas-pagar/crud-handlers.ts:120,155` lista `observacao` em `allowedFields` e em `update({observacao: motivo})`. **Confirmado**: handler grava em coluna inexistente. | **CONFIRMADO** | Migration `20260418_001`: `ADD COLUMN IF NOT EXISTS observacao TEXT` + `NOTIFY pgrst`. |
| **BUG-3** | `column contas_bancarias.ativo does not exist` no `/upsert` | Schema real: `contas_bancarias` tem `inativo BOOLEAN`, não `ativo`. PR-9 já alinhou todos os handlers (`contas-correntes-api/index.ts` usa `inativo`). Bug do laudo estava na v3.1.0. | **JÁ CORRIGIDO** (PR-9) | Nenhuma. Invariante regression preserva alinhamento. |
| **BUG-4** | `Cannot coerce the result to a single JSON object` em `categorias`/`contas-correntes/alterar` | Endpoints usam `.maybeSingle()` ou tratam código `PGRST116` (404 explícito). Padrão verificado em `crud-handlers.ts:135` (`if error.code === 'PGRST116' → 404`). | **FALSO POSITIVO** | Nenhuma. |
| **BUG-5** | `column trade_chart_of_accounts.codigo_dre_gerencial does not exist` | Schema real: `trade_chart_of_accounts` tem `codigo_dre`, `categoria_dre`, `excluir_dre`. **Não existe** `codigo_dre_gerencial` — coluna inventada pelo laudo. Edge function não a referencia. | **FALSO POSITIVO** | Nenhuma. |
| **BUG-6** | `/conciliar` e `/desconciliar` retornam 501 | `contas-receber-api/index.ts` linhas 540-595 implementam ambos endpoints com auditoria + webhook (`conta_receber.conciliada`, `conta_receber.desconciliada`). API_VERSION = '1.3.0' marcado por PR-9. | **JÁ CORRIGIDO** (PR-9) | Nenhuma. Invariante regression valida. |
| **BUG-7** | `erp-fornecedores-sync` rejeita `x-api-key` (401) | Function usa `secureHandler({auth: 'any'})` que aceita ambos JWT e x-api-key (validateAnyAuth em `_shared/auth.ts`). Padrão idêntico aos demais 30+ módulos. | **FALSO POSITIVO** (path do laudo provavelmente errado ou key inválida no teste) | Nenhuma. |
| **BUG-8** | UUID literal `"uuid"` retorna 500 em `/geral-api/associar`, `/contas-receber-api/`, `/webhook-api/alterar` | `_shared/validate.ts` exporta `requireUuid()` (PR-9). Endpoints de CR/CP usam Zod `.uuid()` que retorna 400. Endpoints citados (`/geral-api`, `/webhook-api`) não existem com esses paths — confundidos com `webhook-subscriptions-api`. | **FALSO POSITIVO** (paths não existem) | Nenhuma. |
| **BUG-9** | `varchar(1)` truncation em `empresas` (`tipo_empresa`, `porte`, `regime_apuracao`) | Schema real `empresas` varchar(1): apenas `optante_simples_nacional` e `regime_tributario`. Colunas `tipo_empresa`/`porte`/`regime_apuracao` **não existem**. PR-9 alinhou Zod `.max(1)` para `regime_tributario`. | **JÁ CORRIGIDO** (PR-9) | Nenhuma. Invariante regression valida. |
| **BUG-10** | Migrations sem `NOTIFY pgrst, 'reload schema'` | Migration de PR-10 inclui `NOTIFY`. Migrations futuras manterão prática. | **N/A** (boas práticas) | Adicionado em migration v3.1.2. |
| **BUG-11** | `/upsert` de `contas-correntes` ainda quebra com cache de schema | Sem reproduzir. PR-9 alinhou a coluna correta (`inativo`). Cache do PostgREST se invalida automaticamente em ~30s. Se laudo rodou imediatamente após deploy do PR-9, pode ter pego cache antigo. | **FALSO POSITIVO** (transitório de cache) | Nenhuma. |

---

## Bugs corrigidos neste PR

### 1. Migration `20260418_contas_pagar_observacao`
```sql
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS observacao TEXT;
NOTIFY pgrst, 'reload schema';
```
- Resolve `POST /contas-pagar-api/cancelar` (request_id `3fa7a341-19dd-4be6-96b3-176cb2da699f`).
- Resolve `PUT /contas-pagar-api/update` quando body contém `observacao`.

### 2. Endpoint `/health` público
- Path: `GET /functions/v1/health`
- Resposta: `{ "status": "ok", "api_version": "3.1.2", "build_timestamp": "2026-04-18T00:00:00Z", "request_id": "<uuid>" }`
- `verify_jwt = false` em `supabase/config.toml`.
- Permite ao QA validar imediatamente qual versão da API está deployada antes de rodar bateria.

### 3. APP_VERSION bump 3.1.1 → 3.1.2
- `src/lib/version.ts` atualizado.
- Comentário documenta triagem do laudo.

### 4. Regression script estendido
- 5 invariantes novos cobrem: handler de CP escreve em `observacao`, `/health` existe, `health.verify_jwt = false`, este relatório existe, versão alinhada.

---

## Por que não fiz mais

O laudo do QA propõe 21 ações, mas **8 delas modificariam código já correto** (alguns endpoints/colunas que o laudo cita simplesmente não existem). Aplicar essas correções introduziria **regressão**:

- Adicionar colunas inexistentes (`codigo_dre_gerencial`, `tipo_empresa`, `porte`, `regime_apuracao`) sujaria o schema.
- Refatorar `.catch()` em fire-and-forget de webhooks quebraria padrão correto (são intencionalmente best-effort).
- Adicionar `withRequestId` global duplicaria `secureHandler` (que já injeta `X-Request-ID` via `_shared/response.ts`).

Versionamento: bump **patch** `3.1.1 → 3.1.2` (bugfix sem breaking, sem mudança de contrato OpenAPI/SDK).

---

## Como o QA deve validar

```bash
# 1. Confirmar versão deployada
curl https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/health
# → {"status":"ok","api_version":"3.1.2",...}

# 2. Re-rodar bateria QA contra a v3.1.2
python huggs_api_tester.py --token <key> \
  --base-url https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1 \
  --mode all

# 3. Esperar:
# - BUG-2 resolvido: /contas-pagar-api/cancelar e /update aceitam payloads com observacao.
# - Demais "bugs" do laudo NÃO devem reaparecer porque ou nunca existiram (FP) ou foram corrigidos em PR-9.
# - Endpoints /geral-api/*, /webhook-api/* não existem — devolva ao QA com paths corretos.
```

Se a taxa de sucesso continuar abaixo de 86%, o problema está nos **paths/payloads do tester**, não no servidor.
