

## Diagnóstico

Validei tudo contra runtime + código atual:

### Item 1 — `ContaCorrenteInput` desatualizado CONFIRMADO
Linhas 1201-1213: schema tem só 7 campos. Runtime (`docs/API_CONTAS_CORRENTES.md` + Edge Function) e SDKs v3.2.4 expõem 10. Faltam `codigo_agencia`, `numero_conta_corrente`, `valor_limite`, `pix_sn` (S/N), `bol_sn` (S/N). Os campos `agencia`/`conta` são deprecated nos SDKs (aliases legados) — **devem sair do OpenAPI** porque o runtime ignora.

### Item 2 — `EmpresaInput` falta `endereco_numero` CONFIRMADO
Linha 1137-1168 do OpenAPI: tem `endereco`/`complemento`/`bairro` mas **não** `endereco_numero`. SDK TS tem (linha ~457). Runtime aceita.

### Item 3 — `ClienteInput.telefone1_ddd` deve ser REMOVIDO do OpenAPI (não adicionado)
Validei `supabase/functions/clientes-api/index.ts` (linhas 11-31, 33-60): schemas `IncluirClienteSchema` e `AlterarClienteSchema` são `.strict()` e **só aceitam `telefone1_numero`** — não há `telefone1_ddd`. O response (linha 78) devolve `telefone1_ddd: ""` fixo. **Se um dev usar o campo, recebe 400 Zod**. Linha 1012 do OpenAPI declara `telefone1_ddd: { type: "string" }` — **bug documental**. Remover.

### Item 4 — Schemas órfãos
- **`IdempotencyHeaders`** (schema linha 986-993): documenta headers de **response**, mas `parameters.IdempotencyKey`/`RequestId` (linhas 1819-1832) já cobrem o lado request. O schema nunca é referenciado e duplica info de `headers.XRequestId`. → **Remover**.
- **`MetaEnvelope`** (linha 976): só mencionado no markdown da `info.description`. Wire via `allOf` injetado no `successContent.schema` para endpoints CP/CR (escopo do PR-21). Padrão:
  ```ts
  successContent.schema = {
    allOf: [
      { $ref: `#/components/schemas/${resSchemaName}` },
      { type: "object", properties: { meta: { $ref: "#/components/schemas/MetaEnvelope" } } }
    ]
  };
  ```

### Item extra (verificar): `ContaCorrenteResponse` interface no SDK TS
Comentário na linha 1214 diz que foi removido. Confirmar se ainda há uso na interface TS do SDK — se sim, manter aviso no changelog (não bloqueia PR-21 cosmético).

## Plano — PR-21 (OpenAPI 4.3.4 / SDK 3.2.4 mantém / APP 3.1.13)

### Fase 1 — `ContaCorrenteInput` completo (linhas 1201-1213)
Substituir bloco para incluir 10 campos canônicos do runtime:
- Manter: `cCodCCInt`, `descricao` (req), `tipo_conta_corrente`, `codigo_banco`, `saldo_inicial`.
- Adicionar: `codigo_agencia`, `numero_conta_corrente`, `valor_limite` (number), `pix_sn` (enum `["S","N"]`), `bol_sn` (enum `["S","N"]`).
- Remover: `agencia`, `conta` (deprecated, ignorados pelo runtime).
- Atualizar `description` para PR-21.

### Fase 2 — `EmpresaInput` adicionar `endereco_numero`
Linha 1159 (após `endereco`): inserir `endereco_numero: { type: "string" }`.

### Fase 3 — `ClienteInput` remover `telefone1_ddd`
Linha 1012: deletar a propriedade. Atualizar `description` (linha 1005) mencionando PR-21 + motivo (Zod `.strict()` rejeita).

### Fase 4 — Wiring de schemas órfãos
1. **Remover `IdempotencyHeaders`** (linhas 986-993) — orphan irrecuperável (já coberto por `parameters.IdempotencyKey`/`RequestId` + `headers.XRequestId`).
2. **Wire `MetaEnvelope`**: no builder de response (~linha 1605), quando `fullPath` começa com `/contas-pagar-api/` ou `/contas-receber-api/` E `resSchemaName` existe, envolver em `allOf` adicionando `meta`:
   ```ts
   const isCpCr = fullPath.startsWith("/contas-pagar-api/") || fullPath.startsWith("/contas-receber-api/");
   if (resSchemaName) {
     const baseRef = { $ref: `#/components/schemas/${resSchemaName}` };
     successContent.schema = isCpCr
       ? { allOf: [baseRef, { type: "object", properties: { meta: { $ref: "#/components/schemas/MetaEnvelope" } } }] }
       : baseRef;
   }
   ```

### Fase 5 — Versionamento + changelog
- `version: "4.3.4"` (linha 1741).
- `APP_VERSION = '3.1.13'` em `src/lib/version.ts` com nota PR-21.
- Inline changelog v4.3.4 em `ApiDocumentation.tsx` antes do bloco v4.3.3 (markdown da `info.description`).
- SDK_VERSION mantém `3.2.4` (sem mudança de interface).

### Fase 6 — Regression (`audit/regression-greps.sh`)
6 invariantes novos:
- `pix_sn` em `ApiDocumentation.tsx` ≥1 (ContaCorrenteInput tem o enum).
- `bol_sn` em `ApiDocumentation.tsx` ≥1.
- `numero_conta_corrente:` no schema OpenAPI ≥1.
- `endereco_numero:` no `EmpresaInput` (grep contextual).
- `telefone1_ddd:` no `ClienteInput` ≤0 (negativo — campo removido).
- `version: "4.3.4"` ≥1.
- `IdempotencyHeaders` schema definition ≤0 (negativo — orfão removido).
- `allOf:.*MetaEnvelope` ≥1 (wiring efetivo).

### Fase 7 — Smoke E2E
1. `POST /contas-correntes-api/incluir` com `pix_sn:"S"`+`bol_sn:"N"`+`valor_limite:50000` → 201.
2. `POST /clientes-api/incluir` com `telefone1_ddd:"11"` → **espera 400 Zod** (prova que remoção do OpenAPI estava certa).
3. `bash audit/regression-greps.sh` → todos verdes.

## Não-escopo
- Não tocar SDKs (sem mudança de interface no PR-21).
- Não wire `MetaEnvelope` em todos os módulos — apenas CP/CR (escopo declarado).
- Não tocar Edge Functions.

## Impacto
**3 arquivos**: `ApiDocumentation.tsx` (~25 linhas — CC schema, Empresa +1 campo, Cliente -1 campo, IdempotencyHeaders removido, MetaEnvelope wiring, changelog, version), `version.ts` (1 linha + nota), `audit/regression-greps.sh` (+8 invariantes).

**Risco: muito baixo** — puramente documental/cosmético. Único ponto de atenção: o `allOf` com `MetaEnvelope` em CP/CR não quebra clientes existentes (campos extras em response são tolerados por geradores OpenAPI).

