

## Diagnóstico

Pedido: executar **PR-7 aggressive** (remoção dos 9 endpoints — 7 deprecated + 2 v1-legacy) já que estamos pre-production. Antes de planejar a remoção, preciso confirmar **fato crítico**: zero consumidores internos. Se algum `src/` chamar qualquer dos 9 paths, o plano muda (migrar primeiro, depois remover).

Vou fazer a varredura agora, em paralelo, para que o plano apresentado já reflita a realidade do código.
<lov-tool-use id="toolu_vrtx_01Fopf3cYjpxxrwuXoKZPTYQ" name="code--search_files" integration-id="code" data="{\"query\": \"contas-pagar-api/(alterar|listar|registrar-pagamento|cancelar-pagamento)\", \"include_patterns\": \"*.ts,*.tsx,*.js,*.jsx,*.py\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01JZMM4bSY9ZuUUVyS4eKByq" name="code--search_files" integration-id="code" data="{\"query\": \"contas-receber-api/(alterar|listar|cancelar-recebimento)\", \"include_patterns\": \"*.ts,*.tsx,*.js,*.jsx,*.py\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Q6q5ASfUJPtiKtZQdzVCad" name="code--search_files" integration-id="code" data="{\"query\": \"v1-legacy\", \"include_patterns\": \"*.ts,*.tsx,*.js,*.jsx,*.py\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_0189jWu7NmqctuQN6DhaW1Ly" name="code--search_files" integration-id="code" data="{\"query\": \"cpAlterar|cpListar|cpRegistrarPagamento|cpCancelarPagamento|crAlterar|crListar|crCancelarRecebimento\", \"include_patterns\": \"*.ts,*.tsx,*.js,*.jsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01PgWd7atcRZPnJc8YhdS7Gv" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01JnfsF1C917Pp2EkeqYe9xx" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"*.ts,*.tsx,*.js,*.jsx,*.py\", \"query\": \"contas-pagar-api/(alterar|listar|registrar-pagamento|cancelar-pagamento)\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_019LZ5pnWkRiQuBFnyWVHLad" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"*.ts,*.tsx,*.js,*.jsx,*.py\", \"query\": \"contas-receber-api/(alterar|listar|cancelar-recebimento)\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01V996PY315hYu7YY4dogC92" name="code--search_files" integration-id="code" data="{\"query\": \"v1-legacy\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01J6Sdjmkm3TsWrWeJwPFVdV" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"*.ts,*.tsx,*.js,*.jsx\", \"query\": \"cpAlterar|cpListar|cpRegistrarPagamento|cpCancelarPagamento|crAlterar|crListar|crCancelarRecebimento\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Fq4iTh2HuRiooiSNx4sTXH" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions\"}">
</lov-tool-use>
Achados-chave para o plano:

1. **Consumidores internos detectados** dos paths "deprecated":
   - `src/components/erp/ApiTester.tsx` — UI de teste (interno, sem impacto produção, mas precisa ajustar para não quebrar tela).
   - `src/pages/RelatorioAPModule.tsx` — referencia `contas-pagar-api/listar` em catálogo de telas (string descritiva, não fetch real).
   - `supabase/functions/api-support-ai/index.ts` — exemplos em prompt de IA (texto, fácil reescrever).
   - `src/components/erp/ApiDocumentation.tsx` — mapa OpenAPI generator + changelog histórico.
   - `src/components/erp/SdkDownloadButtons.tsx` — implementações dos métodos (alvo principal de remoção).

2. **`v1-legacy`**: zero referência em `src/` ou `supabase/functions/`. Aparece só em `audit/baseline-v3.8.4.md` (doc) e changelog em `ApiDocumentation.tsx`. **Confirma: zero consumer.**

3. **Não encontrei handler de `/v1-legacy`** no scan rápido — preciso confirmar se está nos arquivos `index.ts` dos edge functions CP/CR antes de planejar a remoção do backend.
<lov-tool-use id="toolu_vrtx_01KoyWWu265dQuYud3CTstAB" name="code--search_files" integration-id="code" data="{\"search_dir\": \"supabase/functions/contas-pagar-api\", \"query\": \"v1-legacy|/alterar|/listar|/registrar-pagamento|/cancelar-pagamento\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01DXfcpRPnHUN9ZDnAMYyPGb" name="code--search_files" integration-id="code" data="{\"search_dir\": \"supabase/functions/contas-receber-api\", \"query\": \"v1-legacy|/alterar|/listar|/cancelar-recebimento\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01V4LLprpTUNeaGY6fey3jkV" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions/contas-pagar-api\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_016KR2mHR3G5ec1VnD2te171" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions/contas-receber-api\"}">
</lov-tool-use>
Confirmado:
- **Sem path `/v1-legacy` real** nos handlers — era apenas terminologia de auditoria para "endpoints legados a remover" (os 7 marcados deprecated). O usuário está chamando isso de "v1-legacy" como apelido conceitual.
- Edge functions têm os paths reais: CR `/alterar`, `/listar`, `/cancelar-recebimento` (este último já é stub 501); CP `/alterar`, `/listar`, `/registrar-pagamento`, `/cancelar-pagamento`.
- `cpListar` aparece comentado em SDK como recomendado para "UI/telas" — confirmar se há consumer real no app antes de deletar.
<lov-tool-use id="toolu_vrtx_01SX9rvzaWFXNnrbHVW5u37k" name="code--search_files" integration-id="code" data="{\"query\": \"contas-pagar-api/listar|contas-pagar-api/alterar|contas-pagar-api/registrar-pagamento|contas-pagar-api/cancelar-pagamento|contas-receber-api/listar|contas-receber-api/alterar|contas-receber-api/cancelar-recebimento\", \"search_dir\": \"src\", \"exclude_patterns\": \"ApiDocumentation.tsx,SdkDownloadButtons.tsx,ApiTester.tsx,RelatorioAPModule.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Sdo5xjBx22FduCYkEEm8FM" name="code--search_files" integration-id="code" data="{\"query\": \"cpAlterar\\\\(|cpListar\\\\(|cpRegistrarPagamento\\\\(|cpCancelarPagamento\\\\(|crAlterar\\\\(|crListar\\\\(|crCancelarRecebimento\\\\(\", \"search_dir\": \"src\", \"exclude_patterns\": \"SdkDownloadButtons.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_018Y7qkZ1XZY7CzxcVp2ngHC" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/contas-pagar-api/index.ts\", \"lines\": \"1-80\"}">
</lov-tool-use>
Confirmado: **zero consumidor real** (fetch/invoke) dos paths deprecated em `src/` fora de:
- `ApiTester.tsx` (UI interna de teste — entradas devem sair do menu)
- `RelatorioAPModule.tsx` (string descritiva em catálogo de telas — não chamada real)
- `api-support-ai/index.ts` (texto de prompt — atualizar exemplos)
- `ApiDocumentation.tsx` + `SdkDownloadButtons.tsx` (gerador OpenAPI + SDK — alvos da remoção)

Backend tem handlers reais para todos. Janela limpa para Scope B.

Agora vou ver `ApiDocumentation.tsx` para mapear o gerador de paths (precisarei alterar) e o `version.ts`:
<lov-tool-use id="toolu_vrtx_01NxHbw6NpEstzePyuJ1mNwB" name="code--view" integration-id="code" data="{\"file_path\": \"src/lib/version.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01NnRS8T2L7u3rmHXYZEgcRQ" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/erp/ApiDocumentation.tsx\", \"lines\": \"1410-1480\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_0112yhtyrUEY6uGaDQaUfwEa" name="code--exec" integration-id="code" data="{\"command\": \"grep -n \\\"deprecated\\\\|x-sunset\\\\|x-deprecation\\\" src/components/erp/ApiDocumentation.tsx | head -60\", \"user_facing_description\": \"Mapeando entradas deprecated no gerador OpenAPI\"}">
</lov-tool-use>
Tenho mapa completo. Agora preparo o plano.

<lov-plan>

## Diagnóstico

Verificação inicial — gates do plano do usuário:

**Consumidor interno?** Zero chamadas reais (`fetch`, `invoke`, métodos `cpAlterar()`, etc.) em `src/`. Aparições em `src/`:
- `ApiTester.tsx` — UI de teste manual (3 entradas CR + 4 entradas CP). Remover entradas do menu, não a tela.
- `RelatorioAPModule.tsx` — string em catálogo de telas (`"contas-pagar-api/listar"`). Trocar para `"contas-pagar-api/query"`.
- `api-support-ai/index.ts` — exemplos curl/JS/Python no prompt do assistente. Reescrever com `query`.
- `ApiDocumentation.tsx` + `SdkDownloadButtons.tsx` — alvos primários da remoção.

**`/v1-legacy` real?** Zero. Só aparece em doc (`audit/baseline-v3.8.4.md`) + changelog histórico. Era apelido conceitual — não há handler com esse path. Remoção do conjunto = os **7 endpoints `deprecated: true`** + limpeza textual de "v1-legacy".

**Nota:** `/contas-receber-api/cancelar-recebimento` já é stub 501. Remoção limpa um not-implemented.

Conclusão: **gate verde para Scope B (aggressive)**. Aprovado executar PR-7.

## Escopo PR-7 (aggressive — 7 endpoints + cleanup)

### 1. Backend (Edge Functions)

**`supabase/functions/contas-pagar-api/index.ts`** (router thin) — sem alterar; remoção real fica nos handlers.

**`supabase/functions/_shared/contas-pagar/crud-handlers.ts`**: deletar `handleAlterar`, `handleListar`. Remover do export e do roteamento `index.ts` (linhas 18, condicionais `path.endsWith('/alterar')` / `'/listar'`).

**`supabase/functions/_shared/contas-pagar/payment-handlers.ts`**: deletar `handleRegistrarPagamento`, `handleCancelarPagamento`. Remover de import + roteamento. Atualizar `CP_IDEMPOTENT_ROUTES` (linhas 25-32): remover `"registrar-pagamento:POST"` e `"cancelar-pagamento:POST"`.

**`supabase/functions/contas-receber-api/index.ts`**: deletar 3 blocos condicionais (`/alterar` PUT, `/cancelar-recebimento` POST, `/listar` GET) e atualizar lista `available_routes` (linhas 824-831). Remover import `AlterarSchema` se ficar órfão.

**Comment cleanup**: remover menções a "PR-4: paths legados" nos cabeçalhos dos `index.ts` CP/CR — a referência fica obsoleta.

### 2. OpenAPI (`ApiDocumentation.tsx` v3.9.1 → v4.0.0)

**Arrays de endpoints** (linhas ~149, 176, 209, 212, 288, 293, 297): deletar fisicamente as 7 entries com `deprecated: true`. Não basta remover a flag — apaga o objeto inteiro do array de definição.

**`PATH_SCHEMA_MAP`** (linhas 1417-1479): deletar 6 entries:
- `"PUT:/contas-pagar-api/alterar"`, `"POST:/contas-pagar-api/cancelar-pagamento"`
- `"PUT:/contas-receber-api/alterar"`, `"POST:/contas-receber-api/cancelar-recebimento"`
- (`/listar` não está no map; é gerado por outro caminho)

**Generator de paths** (linhas 1694, 1731-1736): blocos `if ((ep as any).deprecated)` ficam dead code após remoção. Manter por defesa (custo zero, valida intent) OU limpar (-9 linhas). **Decisão: manter** — futuro endpoint pode marcar deprecated novamente; remover apenas se ficar fácil verificar via grep.

**`components.headers`**: manter `Deprecation` e `Sunset` definidos (custo zero, futuro deprecation pode reusar). Greps invertidos abaixo cobrem isso.

**Bump**: `info.version: "3.9.1"` → `"4.0.0"`. Description: append "v4.0.0 [BREAKING]: 7 endpoints legados removidos. Use `/upsert`, `/query`, `/lancar-pagamento`, `/estornar`."

### 3. SDKs TS/JS/Python (`SdkDownloadButtons.tsx` v2.18.1 → v3.0.0)

**Métodos a deletar (todos os 3 SDKs):**
- `cpAlterar`, `cpListar`, `cpRegistrarPagamento`, `cpCancelarPagamento`
- `crAlterar`, `crListar`, `crCancelarRecebimento`

**Interfaces órfãs a deletar:**
- `CpAlterarPayload`, `CpRegistrarPagamentoPayload`, `CpCancelarPagamentoPayload`
- `CrAlterarPayload`, `CrCancelarRecebimentoPayload`

**Verificar reuso antes de deletar**: grep cada interface antes do delete; se qualquer outro método (ex: `cpUpsert`) usar como sub-tipo, manter ou refatorar.

**Comentários inline**: atualizar bloco "GUIA DE USO" (linhas ~1119-1128) e seção "cpListar vs cpQuery" (linha ~1529) — virou só `cpQuery`.

**Python**: remover 9 ocorrências de `warnings.warn(DeprecationWarning)` (caem com os métodos).

**Smoke tests**: ajustar qualquer case que invoque método removido. Confirmar 8/8 TS+JS, 10/10 Python continuam verdes (smoke#8 normalization usa `consultar`, não `listar` — provavelmente OK).

**Bump**: `SDK_VERSION = '3.0.0'` em cada string.

### 4. `audit/regression-greps.sh` (16 → ~25 invariantes)

**Novo helper para asserções de igualdade exata** (== 0):
```bash
checkExact() { local label="$1" actual="$2" expected="$3"
  if [ "$actual" -ne "$expected" ]; then echo "FAIL $label: $actual != $expected"; fail=1
  else echo "OK   $label: $actual == $expected"; fi; }
```

**Invariantes a inverter** (de `>= N` para `== 0`):
```bash
checkExact "Sem @deprecated em SDKs"           "$(grep -c '@deprecated' $SDK)" 0
checkExact "Sem warnings.warn no Python"       "$(grep -c 'warnings.warn' $SDK)" 0
checkExact "Sem deprecated:true no spec"       "$(grep -c 'deprecated: true\|"deprecated":true' $SPEC)" 0
checkExact "Sem x-sunset no spec"              "$(grep -c 'x-sunset\|xSunset' $SPEC)" 0
```

**Invariantes positivos novos (canônicos sobreviventes — devem aparecer):**
```bash
check "CP /upsert documentado"                 "$(grep -c '/contas-pagar-api/upsert\|path: \"/upsert\"' $SPEC)" 2
check "CP /query documentado"                  "$(grep -c 'contas-pagar-api/query\|path: \"/query\"' $SPEC)" 1
check "CP /lancar-pagamento documentado"       "$(grep -c '/lancar-pagamento' $SPEC)" 2
check "CP /estornar documentado"               "$(grep -c '/estornar' $SPEC)" 2
check "CR /upsert documentado"                 "$(grep -c '/contas-receber-api/upsert' $SPEC)" 1
check "CR /lancar-recebimento documentado"     "$(grep -c '/lancar-recebimento' $SPEC)" 2
```

**Invariantes negativos novos (paths removidos NÃO podem voltar):**
```bash
checkExact "CP /alterar removido do SDK"            "$(grep -c 'cpAlterar\|/contas-pagar-api/alterar' $SDK)" 0
checkExact "CP /listar removido do SDK"             "$(grep -c 'cpListar\|/contas-pagar-api/listar' $SDK)" 0
checkExact "CP /registrar-pagamento removido"       "$(grep -c 'cpRegistrarPagamento\|/registrar-pagamento' $SDK)" 0
checkExact "CP /cancelar-pagamento removido"        "$(grep -c 'cpCancelarPagamento\|/cancelar-pagamento' $SDK)" 0
checkExact "CR /alterar removido"                   "$(grep -c 'crAlterar\|/contas-receber-api/alterar' $SDK)" 0
checkExact "CR /listar removido"                    "$(grep -c 'crListar\|/contas-receber-api/listar' $SDK)" 0
checkExact "CR /cancelar-recebimento removido"      "$(grep -c 'crCancelarRecebimento\|/cancelar-recebimento' $SDK)" 0
```

**Versões alinhadas** (atualizar para v4.0.0/3.0.0):
```bash
check "OpenAPI v4.0.0 no spec"                 "$(grep -c '\"4.0.0\"' $SPEC)" 1
check "SDK_VERSION 3.0.0"                      "$(grep -c \"SDK_VERSION = '3.0.0'\\|SDK_VERSION = \\\"3.0.0\\\"\" $SDK)" 3
check "APP_VERSION 3.0.0"                      "$(grep -c \"3.0.0\" src/lib/version.ts)" 1
```

**Total: 16 herdados + 4 invertidos + 6 positivos novos + 7 negativos novos + 3 versões = ~25 checks.**

### 5. Consumidores internos (cleanup mínimo)

**`src/components/erp/ApiTester.tsx`**: remover 7 entries do array de exemplos (CP `/alterar`, `/listar`, `/registrar-pagamento`, `/cancelar-pagamento`; CR `/alterar`, `/listar`, `/cancelar-recebimento`).

**`src/pages/RelatorioAPModule.tsx`** linha 386: trocar `"contas-pagar-api/listar"` por `"contas-pagar-api/query"`.

**`supabase/functions/api-support-ai/index.ts`**:
- Linhas 690, 697, 706: trocar exemplos curl/JS/Python de `/listar` para `/query` (params `limit`/`offset`).
- Linha 802: remover passo "PUT /contas-pagar-api/alterar" do fluxo end-to-end (ou trocar por `/upsert`).
- Linha 811: trocar `GET /contas-receber-api/listar` por `GET /contas-receber-api/query`.

### 6. Versões + Changelog

- `src/lib/version.ts`: `APP_VERSION = '3.0.0'`.
- `SdkDownloadButtons.tsx`: `SDK_VERSION = '3.0.0'` (3 ocorrências — TS, JS, Python).
- `ApiDocumentation.tsx` `info.version`: `"4.0.0"`.

**Changelog v4.0.0** em `ApiDocumentation.tsx` (entrada nova no array de releases, formato `mem://process/release-changelog-discipline`):

```
v4.0.0 / SDK v3.0.0 / APP v3.0.0 [PR-7 — BREAKING — Pre-prod cleanup]

Removed (no consumer detected, sunset antecipado):
  • /contas-pagar-api/alterar      → /contas-pagar-api/upsert
  • /contas-pagar-api/listar       → /contas-pagar-api/query
  • /contas-pagar-api/registrar-pagamento → /contas-pagar-api/lancar-pagamento
  • /contas-pagar-api/cancelar-pagamento  → /contas-pagar-api/estornar
  • /contas-receber-api/alterar    → /contas-receber-api/upsert
  • /contas-receber-api/listar     → /contas-receber-api/query (paginação REST limit/offset)
  • /contas-receber-api/cancelar-recebimento → /contas-receber-api/estornar

Removed SDK methods (TS/JS/Python):
  cpAlterar, cpListar, cpRegistrarPagamento, cpCancelarPagamento,
  crAlterar, crListar, crCancelarRecebimento + payload interfaces órfãs.

Motivação: nenhum integrador externo conectado. Janela de sunset 2026-09-30
protegia zero pessoas. Lançar API magra antes do primeiro parceiro.

Verificável: ./audit/regression-greps.sh → ~25/25 OK.
  grep -c "@deprecated" SdkDownloadButtons.tsx == 0
  grep -c "warnings.warn" SdkDownloadButtons.tsx == 0
  grep -c "deprecated: true" ApiDocumentation.tsx == 0
  grep -c '/contas-pagar-api/alterar' SdkDownloadButtons.tsx == 0
  grep -c '"4.0.0"' ApiDocumentation.tsx >= 1
```

### 7. Atualização de memória

Append em `mem://process/release-changelog-discipline`:
> v4.0.0 (PR-7) introduziu padrão de **invariantes negativos** em `audit/regression-greps.sh` — paths removidos têm asserção `== 0` para impedir reintrodução acidental. Toda remoção breaking futura deve seguir esse padrão.

### 8. Ordem de execução

1. Deletar handlers backend (CP crud + payment, CR routing).
2. Deletar entries no `PATH_SCHEMA_MAP` + arrays de endpoints em `ApiDocumentation.tsx`.
3. Deletar métodos + interfaces nos 3 SDKs em `SdkDownloadButtons.tsx`.
4. Atualizar `audit/regression-greps.sh` (4 invertidos + 16 novos).
5. Atualizar `ApiTester.tsx`, `RelatorioAPModule.tsx`, `api-support-ai/index.ts`.
6. Bump versões: `version.ts`, `SDK_VERSION`, `info.version`.
7. Adicionar changelog v4.0.0.
8. Rodar `bash audit/regression-greps.sh` localmente → ~25/25.
9. Push → CI verde via `regression-greps.yml`.

## Não-escopo

- Republicação SDKs em registries públicos (npm/pypi).
- Aviso a integradores externos — não há (gate confirmado).
- Edge functions outras que CP/CR — sem alteração.
- Banco de dados — sem migration.
- Generator de `Deprecation`/`Sunset` headers no runtime: manter código, apenas sem alvos. Custo zero, defesa para futuro.

## Impacto

Remove 7 endpoints + 7 métodos SDK + 5 interfaces órfãs. API fica magra: `upsert`, `query`, `lancar-pagamento/recebimento`, `estornar` são os únicos caminhos para escrita/leitura financeira. Integrador novo enxerga só o canônico. Regression script ganha 9 invariantes — fecha porta para reintrodução acidental. Edição em ~7 arquivos, ~600 linhas removidas, ~50 linhas adicionadas (changelog + greps). Nota projetada: **9.8 → 9.9**.

