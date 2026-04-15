

# Auditoria de Consistencia — OpenAPI, SDK, Postman, Painel (API Tester) e Documentacao

## Resultado da Analise

Apos cruzar os 5 artefatos (Endpoints em `ApiDocumentation.tsx`, Schemas OpenAPI, SDKs TS/JS/PY, BODY_TEMPLATES no `ApiTester.tsx`, e Sandbox em `api-sandbox/index.ts`), identifiquei **14 inconsistencias** divididas em 4 categorias.

---

## Categoria 1 — Campos Ausentes entre SDK e Documentacao

### 1.1 SDK TS/JS/PY: `CpIncluirPayload` tem `codigo_projeto` — Docs nao mostram

O SDK TS (linha 134) define `codigo_projeto?: string | number` e o Python (linha 1376) tambem. Porem o body de exemplo em `contasPagarIntegracao` incluir (linha 155) nao contem `codigo_projeto`. O body template do API Tester (linha 296) tambem omite.

**Correcao**: Adicionar `codigo_projeto` nos exemplos de body do incluir/upsert CP na documentacao e no API Tester, ou remover do SDK se nao for suportado pelo backend.

### 1.2 SDK TS/JS/PY: `CpIncluirPayload` tem `numero_documento`, `numero_documento_fiscal` — Body template omite

SDK TS (linhas 130-131) define estes campos opcionais. O body de exemplo da documentacao e do Tester nao os incluem.

**Correcao**: Manter como esta (campos opcionais nao precisam estar nos exemplos), mas validar que o OpenAPI schema `ContaPagarInput` (linha 1058) os lista — ja lista. OK, sem acao.

### 1.3 CR Incluir: SDK PY tem `numero_pedido`, `numero_contrato`, `numero_ordem_servico` — Body template omite

SDK PY (linhas 1417-1419) e SDK TS (linhas 182-184) definem estes campos. O body do API Tester CR incluir (linha 317) e da documentacao (linha 273) nao os mostram.

**Correcao**: Sem acao obrigatoria (campos opcionais), mas como a documentacao CR incluir os omite completamente, adicionar ao menos 1 no exemplo para visibilidade.

---

## Categoria 2 — Inconsistencias de Tipo/Formato

### 2.1 CR `cancelar-recebimento`: Docs usa `codigo_baixa: 0` (numero) — SDK PY usa `str`

Documentacao endpoint (linha 279): `"codigo_baixa": 0` (inteiro).
API Tester (linha 322): `"codigo_baixa": 0` (inteiro).
Sandbox (linha 41): `codigo_baixa: 0` (inteiro).
SDK PY `CrCancelarRecebimentoPayload` (linha 1452): `codigo_baixa: str`.
SDK TS `CrCancelarRecebimentoPayload` (linha 219): `codigo_baixa: string`.

**Inconsistencia**: Documentacao/Sandbox/Tester usam `number`, SDKs usam `string`.

**Correcao**: Alinhar para `string` (UUID) em todos os lugares — documentacao, sandbox e tester devem usar `"codigo_baixa": "uuid-da-baixa"`. O padrao CP ja usa string (linha 194, 301).

### 2.2 CR `conciliar`, `desconciliar`, `cancelar`: Docs usa `codigo_baixa: 0` e `chave_lancamento: 0`

Linhas 280-282 da documentacao e 323-324 do Tester usam inteiro `0`. Sandbox (linhas 42-44) tambem usa `0`.

**Correcao**: Substituir por strings placeholder (`"uuid-da-baixa"`, `"codigo-do-titulo"`).

### 2.3 Fornecedores Sync: SDK usa `/erp-fornecedores-sync/incluir` — Tester usa `/erp-fornecedores-sync/cadastrar`

SDK TS (linha 644): `POST /erp-fornecedores-sync/incluir`.
SDK JS (similar): `POST /erp-fornecedores-sync/incluir`.
SDK PY (linha 1848): `POST /erp-fornecedores-sync/incluir`.
API Tester (linha 266): `POST /erp-fornecedores-sync/cadastrar`.
API Tester body template (linha 408): `/erp-fornecedores-sync/cadastrar`.

**Inconsistencia**: SDK usa `incluir`, Tester usa `cadastrar`.

**Correcao**: Verificar no edge function qual rota existe e alinhar. Se ambas existem, documentar alias. Se so uma, corrigir o outro.

### 2.4 Fornecedores Sync: SDK `fornecedoresAlterar` usa `POST` — Docs nao lista endpoint `alterar`

SDK TS (linha 647): `POST /erp-fornecedores-sync/alterar`.
SDK PY (linha 1850): `POST /erp-fornecedores-sync/alterar`.
Documentacao `fornecedoresSyncCrud` nao tem endpoint `alterar` explicitamente documentado.
Tester nao tem preset para `Fornecedores Sync — Alterar`.

**Correcao**: Verificar se o edge function suporta `/alterar`. Se sim, adicionar ao tester e documentacao.

---

## Categoria 3 — Endpoints Ausentes no Tester vs Documentacao

### 3.1 API Tester falta presets para APIs menores documentadas

O Tester tem presets extensivos, mas falta `CR — Status` (o CR nao tem preset de status no tester, apesar de documentado na linha 284).

**Correcao**: Adicionar `{ label: "CR Integração — Status", method: "GET", path: "/contas-receber-api/status" }`.

### 3.2 Fornecedores Sync — Listar e Upsert ausentes no Tester

SDK tem `fornecedoresListar` e `fornecedoresUpsert`, mas o Tester nao tem presets para eles.

**Correcao**: Adicionar presets para `Fornecedores Sync — Incluir`, `Fornecedores Sync — Alterar`, `Fornecedores Sync — Upsert`, `Fornecedores Sync — Listar`.

---

## Categoria 4 — Sandbox vs Documentacao

### 4.1 Sandbox CP `consultar`: campo `valor_original` — Docs usa `valor_original` tambem. OK.

### 4.2 Sandbox CR `lancar-recebimento`: falta campo `codigo_baixa`

Documentacao (linha 278): resposta inclui `codigo_baixa` (implicitamente, via padrao pagamento).
Sandbox (linha 40): resposta nao tem `codigo_baixa`.

**Correcao**: Adicionar `codigo_baixa: "sandbox-baixa-cr-001"` ao mock.

### 4.3 Fornecedores Sync: Sandbox nao tem mock

Nenhum mock para `/erp-fornecedores-sync/*` no sandbox.

**Correcao**: Adicionar mock basico para fornecedores sync (incluir, alterar, listar, upsert).

---

## Resumo de Alteracoes

| # | Arquivo | Alteracao |
|---|---|---|
| 1 | `ApiDocumentation.tsx` | CR endpoints: `codigo_baixa` e `chave_lancamento` de `0` para string |
| 2 | `ApiTester.tsx` | CR body templates: `codigo_baixa` de `0` para `"uuid-da-baixa"` |
| 3 | `ApiTester.tsx` | Adicionar preset `CR — Status` |
| 4 | `ApiTester.tsx` | Adicionar presets Fornecedores Sync (incluir, alterar, upsert, listar) |
| 5 | `ApiTester.tsx` | Alinhar `/erp-fornecedores-sync/cadastrar` para `/erp-fornecedores-sync/incluir` (ou vice-versa, conforme backend) |
| 6 | `ApiTester.tsx` | Adicionar body templates para Fornecedores Sync incluir/alterar/upsert/listar |
| 7 | `api-sandbox/index.ts` | CR `lancar-recebimento`: adicionar `codigo_baixa` |
| 8 | `api-sandbox/index.ts` | Adicionar mock para fornecedores sync |
| 9 | `ApiDocumentation.tsx` | Verificar e documentar endpoint `/erp-fornecedores-sync/alterar` |

Total: ~9 correcoes pontuais em 3 arquivos + deploy do sandbox.

