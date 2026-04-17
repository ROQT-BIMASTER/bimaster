

## Diagnóstico

Usuário escolheu **Opção 2: Continuar PR-7 imediatamente**. Estado atual do repo é inconsistente — `crud-handlers.ts` perdeu `handleAlterar`/`handleListar` mas `index.ts` do CP ainda tenta roteá-los. Deploy falharia agora. Precisa terminar o ciclo na sequência completa.

Vou mapear o que falta antes de propor execução, para o plano refletir o estado real (não o estado teórico do plano original).
<lov-tool-use>
<lov-view file_path="supabase/functions/contas-pagar-api/index.ts" />
<lov-view file_path="supabase/functions/_shared/contas-pagar/crud-handlers.ts" />
<lov-view file_path="supabase/functions/_shared/contas-pagar/payment-handlers.ts" />
<lov-view file_path="supabase/functions/contas-receber-api/index.ts" lines="1-100" />
<lov-view file_path="supabase/functions/contas-receber-api/index.ts" lines="800-900" />
</lov-tool-use>

## Plano de execução PR-7 (continuação) — ordem rígida para nunca deixar repo quebrado

### Etapa A — Fechar backend CP (estado inconsistente atual)
1. **`supabase/functions/contas-pagar-api/index.ts`**: remover roteamento de `/alterar`, `/listar`, `/registrar-pagamento`, `/cancelar-pagamento`. Limpar `CP_IDEMPOTENT_ROUTES` (remover `registrar-pagamento:POST`, `cancelar-pagamento:POST`). Atualizar `available_routes` no health.
2. **`supabase/functions/_shared/contas-pagar/payment-handlers.ts`**: deletar `handleRegistrarPagamento`, `handleCancelarPagamento` + imports órfãos (`RegistrarPagamentoSchema`, `CancelarPagamentoSchema` se não usados).

### Etapa B — Backend CR
3. **`supabase/functions/contas-receber-api/index.ts`**: deletar 3 blocos (`/alterar` PUT, `/cancelar-recebimento` POST, `/listar` GET). Atualizar `available_routes`. Remover imports órfãos (`AlterarSchema`, `ListarParamsSchema` se só usados aqui).

### Etapa C — OpenAPI (`ApiDocumentation.tsx`)
4. Deletar 7 entries `deprecated: true` dos arrays de endpoints.
5. Deletar 4 entries do `PATH_SCHEMA_MAP`.
6. Bump `info.version: "3.9.1"` → `"4.0.0"` + nota breaking no description.
7. Adicionar entrada changelog v4.0.0 no array de releases.

### Etapa D — SDKs (`SdkDownloadButtons.tsx`)
8. Deletar 7 métodos × 3 SDKs (TS/JS/Python): `cpAlterar`, `cpListar`, `cpRegistrarPagamento`, `cpCancelarPagamento`, `crAlterar`, `crListar`, `crCancelarRecebimento`.
9. Deletar interfaces órfãs: `CpAlterarPayload`, `CpRegistrarPagamentoPayload`, `CpCancelarPagamentoPayload`, `CrAlterarPayload`, `CrCancelarRecebimentoPayload` (verificar reuso antes).
10. Limpar comentários "GUIA DE USO" e seção "cpListar vs cpQuery".
11. Bump `SDK_VERSION = '3.0.0'` (3 ocorrências).
12. Ajustar smoke tests se algum case usar método removido.

### Etapa E — Consumidores internos
13. **`src/components/erp/ApiTester.tsx`**: remover 7 entries do menu de exemplos.
14. **`src/pages/RelatorioAPModule.tsx`** linha 386: trocar `contas-pagar-api/listar` → `contas-pagar-api/query`.
15. **`supabase/functions/api-support-ai/index.ts`**: trocar 5 menções de `/listar`/`/alterar` por `/query`/`/upsert` em exemplos curl/JS/Python.

### Etapa F — Versão APP + Regression script
16. **`src/lib/version.ts`**: `APP_VERSION = '3.0.0'`.
17. **`audit/regression-greps.sh`**: adicionar `checkExact` helper, inverter 4 invariantes (`@deprecated`, `warnings.warn`, `deprecated:true`, `x-sunset` → `== 0`), adicionar 6 positivos (canônicos sobreviventes), 7 negativos (paths removidos), 3 versões (`4.0.0`, `SDK 3.0.0`, `APP 3.0.0`). Total ~25 checks.

### Etapa G — Validação + memória
18. Deploy edge functions CP/CR via `supabase--deploy_edge_functions`.
19. Rodar `bash audit/regression-greps.sh` → exigir 25/25 OK.
20. Smoke via `supabase--curl_edge_functions` em `/upsert`, `/query`, `/lancar-pagamento`, `/estornar` (CP+CR) → confirmar 200/2xx.
21. Update memória `mem://process/release-changelog-discipline` com padrão de invariantes negativos.

## Não-escopo

- Republicação SDKs em registries públicos.
- Migration de banco.
- Generator `Deprecation`/`Sunset` no spec — manter código (custo zero, defesa futura).
- Edge functions outras que CP/CR.

## Impacto

Fecha PR-7 em sequência única, sem janela de inconsistência após Etapa A. ~600 linhas removidas, ~80 adicionadas (changelog + greps novos). Regression script salta de 16 para ~25 invariantes (positivos + negativos), fechando porta para reintrodução acidental. Nota: **9.8 → 9.9**.

