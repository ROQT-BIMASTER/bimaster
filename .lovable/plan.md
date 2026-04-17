

## Diagnóstico

Revisor identificou erosão de processo: a v2.17.0 entregou código mas **não documentou no changelog visual** (`ApiDocumentation.tsx`). Isso quebra a disciplina "grep-verificável no changelog" estabelecida nas v2.15.0/v2.16.0. Custo: -0.25 na nota, mas o risco maior é cultural — se v2.18.0 também sair silenciosa, vira tendência.

Trabalho é de ~20 min: entrada retroativa v2.17.0 + reforço dos bumps OpenAPI 3.8.3/3.8.4 com grep verificável.

## Verificação prévia

Preciso ler `src/components/erp/ApiDocumentation.tsx` na seção de changelog para:
1. Confirmar se v2.17.0 está ausente ou apenas incompleta
2. Confirmar formato dos blocos anteriores (v2.16.0, v2.15.0) para manter consistência visual
3. Verificar se OpenAPI 3.8.4 tem entrada própria

## Escopo: Entrada retroativa v2.17.0 + reforço OpenAPI 3.8.4

### 1. Entrada changelog v2.17.0 / OpenAPI 3.8.4

Adicionar bloco no topo do changelog em `ApiDocumentation.tsx` seguindo o padrão das versões anteriores:

```
v2.17.0 / OpenAPI 3.8.4 — Smoke tests executáveis (fidelidade)

Mudanças:
- TS SDK: bloco runSmoke() descomentado e executável via `npx tsx huggs-erp-sdk.ts --smoke`
- JS SDK: simétrico ao TS, executável via `node huggs-erp-sdk.js --smoke`
- Python SDK: gate `if False:` substituído por `if __name__ == "__main__" and "--smoke" in sys.argv:`
- OpenAPI: /erp-export-payment response 200 como objeto JSON estruturado (não mais string escapada)

Verificável:
- grep -c "console.assert" huggs-erp-sdk.ts  → ≥ 5
- grep -c "console.assert" huggs-erp-sdk.js  → ≥ 5
- grep "if __name__" huggs_erp_sdk.py        → presente
- grep -c "if False:" huggs_erp_sdk.py       → 0
```

### 2. Reforçar entrada v2.16.1 / OpenAPI 3.8.3 (se incompleta)

Confirmar que a entrada do 404 fix tem seu bloco "Verificável:" com:
```
- grep -c "payment_queue_not_found" supabase/functions/erp-export-payment/index.ts → ≥ 1
- curl live com UUID inexistente → 404
```

### 3. Bump simbólico de patch (opcional)

Não bumpar versão — a v2.17.0 já está no código. Esta é puramente uma correção documental retroativa. Manter `APP_VERSION 2.32.0`, SDK 2.17.0, OpenAPI 3.8.4.

### 4. Princípio operacional registrado em memória

Salvar regra em `mem://process/release-changelog-discipline`:

> Nenhum bump de versão (SDK, OpenAPI, APP_VERSION) sobe sem entrada correspondente no changelog visual de `ApiDocumentation.tsx`. Toda entrada deve ter bloco "Verificável:" com ≥ 1 comando `grep` ou prova externa (ex: curl live). Aplicado desde v2.15.0; v2.17.0 foi corrigida retroativamente.

Atualizar `mem://index.md` adicionando referência.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/erp/ApiDocumentation.tsx` | Entrada retroativa v2.17.0/3.8.4 com bloco Verificável; reforço de v2.16.1/3.8.3 se necessário |
| `mem://process/release-changelog-discipline` | Nova memória de processo |
| `mem://index.md` | Adicionar referência à nova memória |

## Não-escopo

Bump de versão; mudanças de SDK; refactor do componente de changelog. Apenas conteúdo documental + memória de processo.

## Impacto esperado

Restaura disciplina grep-verificável quebrada na v2.17.0 silenciosa. Estabelece guarda permanente via memória para v2.18.0+. Recupera 0.25 de nota e — mais importante — bloqueia a tendência de erosão apontada pelo revisor.

