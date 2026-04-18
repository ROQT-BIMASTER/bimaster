

## Diagnóstico

Recebi um pedido detalhado de "Onda 1" para CP/CR com 4 sub-tarefas (1A-1D). Antes de planejar mudanças, preciso confrontar o pedido com o estado real do código pós-PR-10, porque vejo sinais de defasagem com o usuário (ele cita arquivos e padrões que podem já estar diferentes).

### Validação contra o código atual

Vou explorar o que está em `contas-pagar-api/index.ts`, `contas-receber-api/index.ts`, schemas Zod (vi parcialmente em `_shared/contas-pagar/types.ts`), o componente do API Tester, e o schema real das tabelas referenciadas.
<lov-tool-use id="toolu_vrtx_015rhjd3S8Zg1hEvKS8tBpG1" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions/contas-pagar-api\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01YD6FnbbLAT4dTvxJtFK2je" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions/contas-receber-api\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Pnfw8SVZ2ccoZdzQsNg8Rx" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions/_shared/contas-pagar\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01CuJqUsTR41mfhgUmqaUoqv" name="code--search_files" integration-id="code" data="{\"query\": \"ApiTester\", \"search_dir\": \"src\", \"include_patterns\": \"*.tsx,*.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01LB2Aoc8gcLmiGM879MapXL" name="code--search_files" integration-id="code" data="{\"query\": \"4214850|4243124\", \"search_dir\": \"src\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01KwULWtwaodtWgGpK5xJb2D" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (table_name ILIKE '%fornec%' OR table_name ILIKE '%conta%corrent%' OR table_name ILIKE '%conta%banc%' OR table_name ILIKE '%categ%' OR table_name ILIKE '%empres%' OR table_name ILIKE '%trade_chart%') ORDER BY table_name;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01DJmaQwWudUN84PtfvJ9i2E" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions/contas-pagar-api\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_0132wCd2Nd7cupGtUQnnxGxQ" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions/contas-receber-api\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01EBF84GavSoTkiuvS7dV7nz" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions/_shared/contas-pagar\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01FqaSrirwTTF57GXApJ4hYv" name="code--search_files" integration-id="code" data="{\"query\": \"ApiTester\", \"search_dir\": \"src\", \"include_patterns\": \"*.tsx,*.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01CdMBAJsHyTAc9QyHDK3euw" name="code--search_files" integration-id="code" data="{\"query\": \"4214850|4243124\", \"search_dir\": \"src\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01129s2RSNfSv4BrNZ4umWGQ" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (table_name ILIKE '%fornec%' OR table_name ILIKE '%conta%corrent%' OR table_name ILIKE '%conta%banc%' OR table_name ILIKE '%categ%' OR table_name ILIKE '%empres%' OR table_name ILIKE '%trade_chart%') ORDER BY table_name;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01RQMRb5cvaJ5VkAhFDTcnTD" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/contas-pagar-api/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01RVUHuC9M1j3jGRmSJLrYok" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('fornecedores','contas_bancarias','trade_chart_of_accounts','empresas','contas_pagar') AND column_name IN ('id','codigo_categoria','codigo','code','codigo_fornecedor','codigo_integracao','cCodCCInt','codigo_conta_integracao','observacao','ativo','inativo','nome','descricao') ORDER BY table_name, column_name;\"}">
</lov-tool-use>
The router is thin. The schemas live in `_shared/contas-pagar/types.ts` (already viewed in current-code) and the handlers are in `crud-handlers.ts` and `payment-handlers.ts`. Let me check those + CR + ApiTester for the body templates.
<lov-tool-use id="toolu_vrtx_018qwGu6dgeG3uitn9XkPm54" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/_shared/contas-pagar/crud-handlers.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Mop3jdKTgag6SiwSWKDBr2" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/_shared/contas-pagar/payment-handlers.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01EFt7rBbw9Q9G9viMqH5qer" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/contas-receber-api/index.ts\", \"lines\": \"1-200\"}">
</lov-tool-use>
I have the lay of the land. Key findings:

**CP types.ts** — `IncluirSchema`/`UpsertSchema`/`LancarPagamentoSchema` already use `strOrNum`/`strOrNumOpt` (string OR number). The shared types in `_shared/contas-pagar/types.ts` are already coercing. So **1A for CP is largely DONE**.

**CR index.ts** also already has `strOrNum`/`strOrNumOpt` for incluir/upsert/recebimento. ✅

**1B (validation of references)**: Only `empresa_id` is validated in CP `handleIncluir`/`handleUpsert`. Fornecedor/categoria/conta_corrente are NOT pre-validated. But:
- `empresas.id` is `uuid` ✓
- `fornecedores.id` is `uuid` ✓  
- `contas_bancarias.id` is `uuid` (and table is `contas_bancarias`, not `contas_correntes`)
- `trade_chart_of_accounts.code` is the column for `codigo_categoria` (not `codigo_categoria` column)

Critical schema discovery:
- `IncluirSchema` (CP types.ts) coerces `empresa_id` to **integer** (`Number(v)`), but in DB `empresas.id` is `uuid`. The handler then does `parsed.data.empresa_id || 5` and inserts that into contas_pagar.empresa_id. Need to check `contas_pagar.empresa_id` column type.
<lov-tool-use id="toolu_vrtx_01FfMwqGg3UjJ42KU8av8EWC" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='contas_pagar' AND column_name IN ('empresa_id','codigo_cliente_fornecedor','categoria_codigo','id_conta_corrente','codigo_categoria') ORDER BY column_name;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01T8MTpbtxAeGh7iSe23EcoA" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='trade_chart_of_accounts' ORDER BY ordinal_position LIMIT 30;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01B4regHzb8APMEG5L6xZYSt" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/erp/ApiTester.tsx\", \"lines\": \"1-100\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01GPveGSAUcA8DSdM5vVAr98" name="code--search_files" integration-id="code" data="{\"query\": \"codigo_cliente_fornecedor|codigo_lancamento_integracao\", \"include_patterns\": \"src/components/erp/ApiTester.tsx,src/components/erp/ApiDocumentation.tsx\", \"search_dir\": \"src\"}">
</lov-tool-use>
Excellent — now I have a complete picture. Let me check the REQUIRED_FIELDS area and what's currently considered required in the tester (specifically for any presence of `data_previsao` / `id_conta_corrente`).
<lov-tool-use id="toolu_vrtx_01QsCtZZmBGKBYbuY88g3J1e" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/erp/ApiTester.tsx\", \"lines\": \"510-580\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01M842uwUkmJTCJGBP7dB2Dt" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT id, code, name FROM trade_chart_of_accounts WHERE code IN ('2.04.01','2.04.02') OR code LIKE '2.%' ORDER BY code LIMIT 10;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01W7tKKmFZKFecmgoFi436Hg" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT id, nome FROM fornecedores WHERE id::text='2d3d20ef-158d-4765-8d2c-3e6100aace64' OR nome ILIKE '%perez%' LIMIT 5;\"}">
</lov-tool-use>
Now I have enough. Critical findings:

1. **`codigo_categoria`** in DB is `trade_chart_of_accounts.code` — code `2.04.01` does NOT exist (codes are `2.1`, `2.1.1`, etc.). The test plan uses `2.04.01` which won't be found. Also, code `2.04.01` mentioned in payloads is wrong.
2. **`contas_pagar.codigo_cliente_fornecedor`** is `bigint`, but the user's example UUID `2d3d20ef-...` won't fit. The handler does NOT translate fornecedor UUID → bigint code. So the spec's "use UUID for fornecedor" assumption is **technically wrong** for this DB.
3. **`contas_pagar.empresa_id`** is `integer`, not UUID. The Zod already coerces empresa_id to integer. ✅
4. **`contas_pagar.id_conta_corrente`** is `bigint`.
5. **CP `IncluirSchema`** in `_shared/contas-pagar/types.ts` already uses `strOrNum` / `strOrNumOpt` and `empresa_id` is preprocessed to int — **1A is DONE for CP**. CR also already done.
6. **1B**: empresa is validated, but fornecedor / categoria / conta_corrente are not pre-validated. Categoria `categoria_codigo` in CP table is varchar — the handler stores `codigo_categoria` in `categoria_codigo` (string). It does not validate against `trade_chart_of_accounts.code`.
7. **1C**: REQUIRED_FIELDS list is already correct — does NOT include `data_previsao` or `id_conta_corrente`. So **1C portal side is also already correct**.
8. **1D**: Body templates use `12345` (numeric) — not the `4214850` mentioned in the prompt. The prompt's expected change to UUID `2d3d20ef-...` is wrong because `codigo_cliente_fornecedor` is bigint. But it's still useful to use real codes. There's no `4214850`/`4243124` in ApiTester body templates (those appear in fornecedor sync examples).

This is delicate — the user's spec has factual errors based on actual DB schema. I need to present a plan that explains and adapts.
<lov-tool-use id="toolu_vrtx_01C6zydSauNnXmdGf3jUEVxr" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT id, erp_code, nome FROM fornecedores WHERE id::text='2d3d20ef-158d-4765-8d2c-3e6100aace64';\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Wdq6Evds7Q9sLAptcDxG8u" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='fornecedores' AND column_name IN ('id','erp_code','codigo_omie','codigo_integracao','codigo') ORDER BY column_name;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01KVMPt6dyBNB9z5UFTreL1G" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT codigo_cliente_fornecedor, COUNT(*) FROM contas_pagar WHERE importado_api=true AND codigo_cliente_fornecedor IS NOT NULL GROUP BY codigo_cliente_fornecedor ORDER BY 2 DESC LIMIT 5;\"}">
</lov-tool-use>
Confirmed: Perez has no `erp_code`, and `contas_pagar.codigo_cliente_fornecedor` (bigint) holds raw numeric ERP codes (12345, 99999999, 0). The user spec's example `"codigo_cliente_fornecedor":"2d3d20ef-..."` would fail Postgres bigint coercion. I have enough to present the plan.

<lov-plan>

## Diagnóstico — Onda 1 majoritariamente JÁ FEITA

Antes de tocar em código, validei cada item contra o estado real do código + schema real do banco. Resultado: **a maior parte da Onda 1 já está implementada** desde PRs anteriores. A spec do usuário tem 3 erros factuais sobre a DB que precisam ser corrigidos no documento (não no código), e há **2 fixes pequenos legítimos** para fazer.

### Validação item-a-item

| Item | Spec pede | Estado real | Ação |
|---|---|---|---|
| **1A — `z.union([string, number])`** | Trocar `z.string()` por união em CP/CR | Já está. `_shared/contas-pagar/types.ts` usa `strOrNum`/`strOrNumOpt` em IncluirSchema, UpsertSchema, LancarPagamentoSchema. `contas-receber-api/index.ts` linhas 24-25 idem. | **N/A — sem mudança** |
| **1B — Validar referência de fornecedor/categoria/CC com 400** | Adicionar `validateReference()` antes de cada INSERT/UPDATE | Apenas `empresa_id` é pré-validado. Fornecedor, categoria e conta_corrente caem para 23503 e viram 400 genérico. | **FAZER** — pré-validar e retornar 400 com nome do campo |
| **1C — `data_previsao` e `id_conta_corrente` opcionais** | Schema Zod e portal | Schema Zod: já `.optional()`. Portal `REQUIRED_FIELDS` (linha 520): já lista apenas os 5 obrigatórios — `data_previsao` e `id_conta_corrente` não aparecem. | **N/A — sem mudança** |
| **1D — Body pré-configurado** | Trocar números por UUID do Perez (`2d3d20ef-...`) e categoria `2.04.01` | **Ambos errados na spec**: `contas_pagar.codigo_cliente_fornecedor` é `bigint` (não aceita UUID). Categoria `2.04.01` não existe (códigos reais começam com `2.1`, `2.2`, etc.) | **FAZER ADAPTADO** — manter número, usar código de categoria real (`2.1.1`) |
| **Try/catch global retornando mensagem real** | Spec pede envolver tudo em try/catch | Já existe em `runRouter` (CP linha 214-228) e em `runHandler` CR. Erro de PG mapeia 22P02/23503/23505/23502 para mensagens específicas; fallback usa `error.message`. | **N/A — sem mudança** |

### Por que a spec do usuário diverge da realidade

1. **`codigo_cliente_fornecedor` é bigint, não UUID.** Os fornecedores têm UUID interno (`fornecedores.id`), mas a coluna em `contas_pagar` armazena o código numérico do ERP (igual ao Omie/SAP). Enviar UUID quebra com `invalid input syntax for type bigint`. Perez (`2d3d20ef-...`) não tem `erp_code` cadastrado — fornecedores reais usados em produção têm códigos como `12345`.
2. **Categoria `2.04.01` não existe.** Plano de contas real começa em `2.1` (Fornecedores de Produtos), `2.1.1` (Compras Ruby Rose), etc. Vou usar `2.1.1` no body padrão.
3. **`empresa_id` é integer, não UUID.** Já tratado pelo Zod `preprocess` que converte para `Number`.

## Plano de execução (mínimo cirúrgico)

### Fase A — 1B: Pré-validar referências e devolver 400 estruturado

Editar **`supabase/functions/_shared/contas-pagar/utils.ts`** (adicionar helper `validateReference`).

Editar **`supabase/functions/_shared/contas-pagar/crud-handlers.ts`**:
- `handleIncluir` (após Zod parse, antes do insert): validar fornecedor (se fornecido), categoria (obrigatória), conta corrente (se fornecida). Empresa já tem.
- `handleUpsert`: idem.
- `handleUpsertLote`: validar por item dentro do loop (registrar falha por item, não abortar lote inteiro).

Editar **`supabase/functions/_shared/contas-pagar/payment-handlers.ts`**:
- `handleLancarPagamento`: lookup do título já existe — só adicionar validação opcional de `codigo_conta_corrente` se vier no body.

Tabelas/colunas reais a usar:
- Fornecedor: `fornecedores` por `id` (uuid) **se vier formato UUID**, OU por `erp_code` (text) se vier numérico/texto curto.
- Categoria: `trade_chart_of_accounts` por `code` (varchar).
- Conta corrente: `contas_bancarias` por `id` (uuid). Mas como o campo no DB é `bigint`, na prática o integrador envia número — pular validação se for puramente numérico (não temos coluna numérica de busca em `contas_bancarias`).
- Empresa: `empresas` por `id` (uuid). Mas `contas_pagar.empresa_id` é integer — então a busca é em `empresas` por id integer (verificar), ou tabela `dim_empresa`.

**Ajuste prático**: como `contas_pagar.codigo_cliente_fornecedor` é `bigint`, a validação consulta `fornecedores.erp_code = $1` (text comparison com o número como string). Se não casar, retorna 400 "Fornecedor com código X não cadastrado". Se o integrador enviar UUID, transforma `String` (já feito pelo Zod) — o INSERT vai falhar 22P02 "bigint", e nesse caso devolvemos 400 explicando que o campo deve ser numérico (mensagem já existe — só precisa ser mais clara).

Aplicar mesmo padrão (mais simples, porque `valor_documento` é numeric e referências CR são análogas) em **`supabase/functions/contas-receber-api/index.ts`** nos handlers POST de incluir/upsert/lancar-recebimento.

### Fase B — 1D: Body pré-configurado realista

Editar **`src/components/erp/ApiTester.tsx`** (linhas 286-311): substituir `codigo_categoria: "2.04.01"` por `"2.1.1"` (categoria real existente). Manter `codigo_cliente_fornecedor: 12345` numérico (não trocar por UUID — a spec está tecnicamente errada). Acrescentar comentário explicativo no payload via campo extra do JSON (não — JSON não tem comentário; em vez disso, atualizar o glossário/docs do endpoint para deixar claro que esse campo é o código numérico do ERP).

Endpoints a atualizar:
- `/contas-pagar-api/incluir`
- `/contas-pagar-api/upsert`
- `/contas-pagar-api/upsert-lote`
- `/contas-receber-api/incluir`, `/upsert`, `/upsert-lote` — trocar `1.01.02` (que também não existe) por `1.1` ou similar (vou checar quais existem para receita antes de gravar).

### Fase C — Versionamento + regression

- Bump `APP_VERSION` `3.1.2 → 3.1.3` (patch).
- Adicionar 3 invariantes em `audit/regression-greps.sh`:
  - `validateReference` aparece em utils.ts (>=1).
  - `2.04.01` removido dos templates (`grep -c "2.04.01" src/components/erp/ApiTester.tsx == 0`).
  - `strOrNum` segue presente em CP types.ts (>=3) — proteção contra regressão futura.
- Atualizar `docs/fixes-abr26/IMPLEMENTATION_REPORT.md` com seção "Onda 1" listando: 3 itens validados como já-feitos + 2 itens corrigidos de fato + 1 alerta sobre divergências da spec.

### Fase D — Validação E2E

Smoke via `supabase--curl_edge_functions`:
1. `GET /contas-pagar-api/status` → 200.
2. `POST /contas-pagar-api/incluir` com `codigo_cliente_fornecedor: 12345` (numérico real, sem cadastro) → **400** com mensagem clara "Fornecedor com código 12345 não cadastrado" (não 500).
3. `POST .../incluir` com `codigo_categoria: "99.99.99"` → **400** "Categoria não encontrada".
4. `POST .../incluir` com payload completo e categoria real `2.1.1` → 201 ou 400 controlado (depende de fornecedor existir).
5. `POST .../incluir` enviando `codigo_cliente_fornecedor` como **número sem aspas** → não dá 400 "Expected string" (já garantido pelo Zod existente).

## Não-escopo

- Trocar `codigo_cliente_fornecedor` de bigint para UUID (mudança de schema crítica que quebraria 100% dos integradores ERP atuais).
- Implementar lookup automático de fornecedor por UUID (resolveria UX, mas é PR maior — fica para Onda 2).
- Mudanças em `ContasAPagar.tsx`, `ContasPagarGestao.tsx`, etc. (regra explícita do usuário).
- SDK bumps (não há mudança de contrato externo).

## Impacto

5 arquivos editados (~80 linhas adicionadas), 3 invariantes novos, 1 bump de patch (`3.1.3`). Zero breaking changes. Risco de regressão: muito baixo (validações são pré-checks puros, fallbacks de erro continuam intactos). 7 testes do checklist do usuário ficam verdes desde que ele use o **código de categoria real** (vou documentar `2.1.1` no body) e **número do ERP** (não UUID) para `codigo_cliente_fornecedor` — divergências serão explicadas no relatório de implementação.

