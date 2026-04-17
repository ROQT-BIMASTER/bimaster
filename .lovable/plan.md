

## Diagnóstico

Mensagem de fechamento. Não há pedido de código novo — é um sinal de que o ciclo PR-7B está carimbado em 9.8 e que o próximo trabalho técnico só abre em setembro/2026 (PR-7, remoção dos legacy endpoints pós-Sunset).

O que o usuário está, implicitamente, pedindo:

1. **Reconhecer o fechamento** sem inventar trabalho.
2. **Garantir que a disciplina de regressão fique registrada** — o bloco de greps da Etapa 4 do PR-7B precisa virar regression test executável a cada bump de SDK/OpenAPI/APP_VERSION.

Hoje, esse bloco vive apenas no changelog em `ApiDocumentation.tsx` (texto) e nos invariantes embutidos nos SDKs (smoke 8/8 TS+JS, 10/10 Python). Não há um único arquivo `audit/regression-greps.sh` que rode os greps de uma vez. Sem isso, "vigilância a cada tag" depende de memória, e a memória falha em 17 rodadas.

A memória `mem://process/release-changelog-discipline` já cobre o **changelog**. Falta o complemento operacional: **um script executável que valida os invariantes**.

## Proposta — única ação técnica recomendada

Criar `audit/regression-greps.sh` (≤60 linhas, bash puro, zero dependência) consolidando os 8 greps da Etapa 4 do PR-7B + os invariantes herdados (X-Request-ID, idempotency-key, lastRequestId nos SDKs, headers documentados no OpenAPI).

Estrutura:

```bash
#!/usr/bin/env bash
# audit/regression-greps.sh — invariantes pós-PR-7B (v3.9.1)
# Uso: bash audit/regression-greps.sh   → exit 0 se OK, 1 se regredir.
set -euo pipefail
SDK="src/components/erp/SdkDownloadButtons.tsx"
SPEC="src/components/erp/ApiDocumentation.tsx"
fail=0
check() { local label="$1" actual="$2" min="$3"
  if [ "$actual" -lt "$min" ]; then echo "FAIL $label: $actual < $min"; fail=1
  else echo "OK   $label: $actual >= $min"; fi; }

# PR-1/1B: observabilidade
check "X-Request-ID nos SDKs"         "$(grep -c 'X-Request-ID\|x-request-id' $SDK)" 3
check "lastRequestId/last_request_id" "$(grep -c 'lastRequestId\|last_request_id' $SDK)" 3

# PR-2: idempotency
check "Idempotency-Key nos SDKs"      "$(grep -c 'Idempotency-Key\|idempotency_key' $SDK)" 3

# PR-4: deprecation
check "Sunset documentado no spec"    "$(grep -c 'Sunset' $SPEC)" 2

# PR-5: ETag
check "ETag nos SDKs"                 "$(grep -c 'If-None-Match' $SDK)" 3
check "ETag no spec"                  "$(grep -c 'ETag' $SPEC)" 4
check "Response 304 no spec"          "$(grep -c '\"304\"' $SPEC)" 1
check "NotModified component"         "$(grep -c 'NotModified' $SPEC)" 2

# PR-6: rate-limit
check "RateLimit headers no spec"     "$(grep -c 'RateLimit-Limit\|RateLimit-Remaining\|RateLimit-Reset' $SPEC)" 6

# PR-7B: robustez SDK
check "LRU bound (LRUMap/OrderedDict)" "$(grep -c 'LRUMap\|OrderedDict' $SDK)" 2
check "cacheBody opt"                  "$(grep -c 'cacheBody\|cache_body' $SDK)" 6
check "RateLimitMetadata exportado"    "$(grep -c 'RateLimitMetadata' $SDK)" 4
check "smoke#8 normalization"          "$(grep -c 'smoke#8\|normalization' $SDK)" 3

# Versões alinhadas
check "OpenAPI v3.9.1 no spec"        "$(grep -c '\"3.9.1\"' $SPEC)" 1
check "APP_VERSION 2.33.1"            "$(grep -c \"2.33.1\" src/lib/version.ts)" 1

[ "$fail" -eq 0 ] && echo "ALL OK" || { echo "REGRESSION DETECTED"; exit 1; }
```

**Por que faz sentido agora, mesmo o usuário tendo dito "zero código pendente":**

- Custo: 1 arquivo, 60 linhas, bash puro. Não toca runtime, não toca SDK, não toca spec.
- Benefício: transforma a frase "rodar o bloco de greps a cada tag" em comando único (`bash audit/regression-greps.sh`). Pré-requisito para o usuário cumprir a própria recomendação dele de vigilância.
- Habilita o item 3 do roadmap dele ("smoke suite pública via GitHub Actions") com 5 linhas extras de YAML quando ele quiser publicar — o script já fica pronto.

**Não faço:**
- GitHub Actions workflow agora — ele marcou como "opcional". Espera pedido explícito.
- PR-7 (remoção legacy) — janela só abre setembro/2026.
- Tocar `mem://process/release-changelog-discipline` — já cobre a parte de changelog; este script é o **complemento operacional**, e adiciono uma linha na memória mencionando o caminho do script.

## Atualização de memória

Após criar o script, append em `mem://process/release-changelog-discipline`:
> Bloco de greps de regressão consolidado em `audit/regression-greps.sh`. Rodar antes de qualquer bump de SDK_VERSION/OpenAPI/APP_VERSION. Se algum check vier < N, PR não merge.

## Não-escopo

- Código de runtime, SDK, spec, edge function, banco — nenhum toque.
- Workflow CI público — opcional, fica para quando o usuário pedir.
- Qualquer trabalho ligado a PR-7 (legacy removal) — só pós Sunset 2026-09-30.

## Impacto

Fecha o gap entre "disciplina documentada" e "disciplina executável". Custo trivial (1 arquivo, 60 linhas), retorno é a única coisa que protege os 9.8 entre agora e set/2026 sem depender de memória humana. Nota não muda (continua 9.8) — esse arquivo é infraestrutura de manutenção, não feature nova.

