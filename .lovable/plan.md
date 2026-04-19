

## Diagnóstico — auditoria majoritariamente correta, com nuances importantes

### **Verificação no banco (todas as colunas EXISTEM):**
`contas_pagar` já tem **77 colunas** incluindo: `data_vencimento`, `data_emissao`, `tipo_documento`, `numero_documento`, `empresa_nome`, `fornecedor_codigo`, `fornecedor_nome`, `categoria_codigo`, `categoria_nome`, `portador`, `portador_id`, `departamento_id`, `departamento_nome`, `codigo_projeto`, `id_conta_corrente`. **Não precisa criar nenhuma coluna nova para Fase 1 e Fase 2 (exceto Fase 3).**

### **Fase 1 — Bugs de gravação: causa raiz identificada**

Confirmado em produção (5 títulos importados via API, todos com campos null):

| Campo | Causa raiz |
|---|---|
| `data_vencimento` | `IncluirSchema` aceita ✓, handler grava ✓ — **mas em testes antigos veio sem o campo**. Verificar se está realmente quebrado ou se foram payloads incompletos. **Investigar `/sync` que provavelmente usa outro path.** |
| `data_emissao` | `IncluirSchema` **NÃO declara** o campo (linhas 18-39 do types.ts mostram só `data_vencimento`/`data_previsao`/`data_entrada`). Adicionar a `IncluirSchema`. |
| `tipo_documento` | Já no `IncluirSchema` ✓, deveria entrar via `validRest`. Verificar se `.strict()` está bloqueando. Já no `UpsertSchema` falta. |
| `numero_documento` | Mapeado como `strOrNumOpt` ✓ no Incluir. **Falta no `UpsertSchema`.** |

**Causa principal**: `UpsertSchema` (types.ts L42-66) **não declara** `numero_documento`, `tipo_documento`, `parcela`, `data_entrada`, `codigo_projeto`. Como é `.strict()`, qualquer payload com esses campos quebra ou é silently dropped. Já o `IncluirSchema` tem `data_vencimento` obrigatório mas falta `data_emissao`/`numero_documento_fiscal`/`chave_nfe`.

**Fix Fase 1**: 
1. Adicionar a `UpsertSchema`: `numero_documento`, `tipo_documento`, `data_entrada`, `parcela`, `codigo_projeto`, `numero_documento_fiscal`, `chave_nfe`, `codigo_tipo_documento`, `numero_pedido`.
2. Adicionar a `IncluirSchema`: `data_emissao`, `numero_documento_fiscal`, `chave_nfe`, `codigo_tipo_documento`, `numero_pedido`.
3. Em `handleIncluir` (L256), incluir `data_emissao: parseDate(parsed.data.data_emissao)` no insertData.
4. Backfill opcional (não escopo): rodar UPDATE para títulos com `data_vencimento IS NULL` setando a partir de `created_at` se houver lógica — **NÃO FAZER**, deixar histórico.

### **Fase 2 — JOINs de enriquecimento**

`contas_pagar` já tem **denormalized cache** (`empresa_nome`, `fornecedor_nome`, `categoria_nome`, `departamento_nome`, `plano_contas_nome`). Para os 5 já presentes, basta retornar agrupado via shape transform — **sem JOIN runtime**. Para os ausentes, JOIN explícito:

| Campo solicitado | Fonte real | Estratégia |
|---|---|---|
| `empresa.nome` | denormalized (`empresa_nome`) | shape transform |
| `fornecedor.nome` + `cnpj` | denormalized + JOIN `fornecedores` por `erp_code` para CNPJ | JOIN para enriquecer CNPJ |
| `categoria.nome` | denormalized (`categoria_nome`) | shape transform |
| `departamento.nome` | denormalized (`departamento_nome`) | shape transform |
| `portador.nome` | JOIN `portadores` via `portador_id` | JOIN PostgREST embedded |
| `projeto.nome` | JOIN `projetos` via `codigo_integracao` matching `codigo_projeto` | JOIN explícito |
| `conta_corrente.nome` (em pagamentos) | JOIN `lancamentos_conta_corrente`/`tipos_conta_corrente` via `id_conta_corrente` | JOIN |

**Implementação**: Trocar `select('*')` em `handleConsultar`/`handleQuery` por select com PostgREST embedded resources:
```ts
.select(`*, 
  empresa:empresas!empresa_id(id, nome, cnpj),
  fornecedor:fornecedores!fornecedor_codigo(erp_code, razao_social, cnpj),
  portador:portadores!portador_id(id, nome, codigo_erp),
  projeto:projetos!codigo_integracao(id, nome)
`)
```
+ shape final no response: agrupar `categoria`, `departamento` a partir dos campos denormalizados (sem JOIN extra para evitar N+1).

### **Fase 3 — Avaliar (BAIXA — vou propor APROVAR)**

| Campo | Onde | Status atual |
|---|---|---|
| `forma_pagamento` (enum) | `pagamentos` | Coluna existe ✓. Hoje o RPC `process_payment_atomic` provavelmente grava string livre. Adicionar enum check. |
| `codigo_pix` | `pagamentos` | Coluna **não existe**. Criar via migration. |
| `baixado_por` | `pagamentos` | Coluna **não existe**. Criar `created_by uuid references auth.users`. |

### **Item extra descoberto**

`handleGetPagamentos` retorna `select('*')` sem JOIN com `contas_bancarias`. A coluna na tabela é `conta_bancaria_id`, mas o ERP fala em "conta corrente" (id_conta_corrente). Há **drift de nomenclatura** entre `pagamentos.conta_bancaria_id` e `contas_pagar.id_conta_corrente`. Validar com o usuário antes de "unificar".

## Plano — PR-23 (SDK 3.3.0 / OpenAPI 4.4.0 / APP 3.2.0)

### **Fase 1 — Schemas Zod e gravação (`types.ts` + `crud-handlers.ts`)**

1. **`types.ts` — `IncluirSchema`** (L18): adicionar `data_emissao` (string optional), `numero_documento_fiscal`, `chave_nfe`, `codigo_tipo_documento`, `numero_pedido`.
2. **`types.ts` — `UpsertSchema`** (L42): adicionar `numero_documento`, `tipo_documento`, `data_entrada`, `parcela`, `codigo_projeto`, `numero_documento_fiscal`, `chave_nfe`, `codigo_tipo_documento`, `numero_pedido`.
3. **`crud-handlers.ts` — `handleIncluir` (L256-266)**: garantir `data_emissao: parseDate(parsed.data.data_emissao)` no insertData. Spread `validRest` já cobre tipo_documento/numero_documento, mas adicionar **explicit fallback** para evitar regressões.
4. **Allowlist `handleUpdate` (L117-121)**: adicionar `data_emissao`, `numero_documento_fiscal`, `chave_nfe`, `codigo_tipo_documento`, `data_entrada`.

### **Fase 2 — JOINs enriquecidos (`crud-handlers.ts` + `payment-handlers.ts`)**

5. **`handleConsultar` (L26)**: trocar `select('*')` por select com embedded resources (empresa, fornecedor, portador, projeto). Pós-shape: criar campo `meta_relacionados` com `{empresa: {id, nome, cnpj}, fornecedor: {codigo, nome, cnpj}, categoria: {codigo, nome}, departamento: {id, nome}, portador: {id, nome}, projeto: {id, nome}}` derivado dos JOINs + denormalized.
6. **`handleQuery` (L65)**: mesmo select enriquecido (com cuidado: paginação preservada, count: 'exact' mantém).
7. **`handleGetPagamentos` (L223)**: select com JOIN para `contas_bancarias` se `conta_bancaria_id` matchar; também buscar `created_by` (após Fase 3c) → `usuario_nome` via `profiles`.

### **Fase 3 — Campos novos (migration + handlers)**

8. **Migration**: 
   - `ALTER TABLE pagamentos ADD COLUMN codigo_pix varchar(255)`.
   - `ALTER TABLE pagamentos ADD COLUMN created_by uuid REFERENCES auth.users(id)`.
   - `ALTER TABLE pagamentos ADD CONSTRAINT pagamentos_forma_pagamento_chk CHECK (forma_pagamento IS NULL OR forma_pagamento IN ('dinheiro','cheque','pix','boleto','cartao','transferencia','API'))` (mantém 'API' como legacy).
9. **`LancarPagamentoSchema`** (types.ts): adicionar `forma_pagamento` (enum), `codigo_pix` (string optional).
10. **`processPayment`**: passar `forma_pagamento` e `codigo_pix` para o RPC. **Atenção**: `process_payment_atomic` precisa ser atualizado via migration para receber esses params.

### **Fase 4 — OpenAPI (`ApiDocumentation.tsx`)**

11. **`ContaPagarInput`/`ContaPagarUpsertInput`**: adicionar `data_emissao`, `numero_documento_fiscal`, `chave_nfe`, `codigo_tipo_documento`, `data_entrada`, `parcela`, `codigo_projeto`, `numero_pedido`.
12. **`ContaPagarOut` (response)**: adicionar bloco `meta_relacionados` com sub-objetos `empresa`, `fornecedor`, `categoria`, `departamento`, `portador`, `projeto`.
13. **`PagamentoInput`**: adicionar `forma_pagamento` (enum), `codigo_pix`.
14. **`PagamentoOut`**: adicionar `forma_pagamento`, `codigo_pix`, `usuario_id`, `usuario_nome`, `conta_corrente` (objeto).

### **Fase 5 — SDKs (`SdkDownloadButtons.tsx`)**

15. **TS interfaces**: `ContaPagarPayload` += campos novos; criar `ContaPagarRelacionados`; `ContaPagarOut` ganha `meta_relacionados?: ContaPagarRelacionados`. `PagamentoPayload` += `forma_pagamento`/`codigo_pix`.
16. **JS JSDoc** + **Python @dataclass**: paridade.
17. **`_validate` `cpIncluir`**: alertar se `data_vencimento` AND `data_emissao` ambos ausentes (warning, não erro).

### **Fase 6 — Versionamento + Changelog**

18. SDK 3.3.0, OpenAPI 4.4.0, APP 3.2.0 (`version.ts`).
19. Changelog inline v4.4.0 em `ApiDocumentation.tsx` (mandatório por `release-changelog-discipline`).

### **Fase 7 — Regression (`audit/regression-greps.sh`)**

20. **+12 invariantes** (paridade 5 camadas):
    - `data_emissao` em IncluirSchema + UpsertSchema (≥2 em types.ts)
    - `numero_documento` em UpsertSchema (≥1)
    - `tipo_documento` em UpsertSchema (≥1)
    - `meta_relacionados` em SdkDownloadButtons.tsx (≥3 — TS + JS + PY)
    - `meta_relacionados` em ApiDocumentation.tsx (≥1)
    - `forma_pagamento` enum em ApiDocumentation.tsx (≥1)
    - `codigo_pix` em SDKs (≥3) + ApiDoc (≥1) + migration (≥1)
    - `process_payment_atomic` migration alterando assinatura (≥1)
    - `version: "4.4.0"` (≥1); `SDK_VERSION = "3.3.0"` (≥1).

### **Fase 8 — Smoke E2E**

21. POST `/cp/upsert` com payload completo (data_vencimento+data_emissao+tipo_documento+numero_documento) → consultar e verificar **todos preenchidos**.
22. POST `/cp/lancar-pagamento` com `forma_pagamento:"pix"`+`codigo_pix:"abc"` → consultar `/pagamentos` e verificar campos.
23. GET `/cp/consultar?id=...` → response deve ter `meta_relacionados.empresa.nome`, `.fornecedor.cnpj`, `.portador.nome`.
24. `bash audit/regression-greps.sh` → todos verdes.

## Confirmações antes de implementar

**Decisões Fase 3 (impacto: 1 migration adicional, ~30 linhas no RPC, ~20 linhas SDK):** vou propor **aprovar Fase 3 completa** (forma_pagamento+codigo_pix+baixado_por) — auditoria considerou prioridade baixa mas o esforço marginal é pequeno e fecha o gap das telas do ERP de uma vez. Se preferir splittar em PR-24, é só dizer.

## Não-escopo
- **Não tocar** os 6 arquivos React proibidos (`ContasAPagar.tsx`, `ContasPagarGestao.tsx`, etc).
- **Não fazer backfill** dos 5 títulos null em produção (preservar histórico).
- **Não unificar** `pagamentos.conta_bancaria_id` vs `contas_pagar.id_conta_corrente` — apenas expor via JOIN.

## Impacto

**6 arquivos**: `types.ts` (+15 linhas — schemas), `crud-handlers.ts` (~25 linhas — selects enriquecidos + insertData fix), `payment-handlers.ts` (~15 linhas — JOIN + forma_pagamento), `ApiDocumentation.tsx` (~50 linhas — schemas in/out + changelog), `SdkDownloadButtons.tsx` (~60 linhas — 3 SDKs), `version.ts` (1 linha + nota), `audit/regression-greps.sh` (+12 invariantes). **+ 1 migration** (3 ALTER + RPC update).

**Risco: médio** — mudança de schema Zod pode impactar clientes existentes (mas é aditiva, sem remoção). RPC `process_payment_atomic` precisa retro-compatibilidade (defaults nos novos params).

