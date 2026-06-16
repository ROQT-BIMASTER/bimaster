---
name: Date Timezone Guard
description: Datepickers devem usar parseLocalDate/formatLocalDate; CI valida em SP/UTC/Tóquio e bloqueia regressão via grep
type: preference
---
Datepickers (shadcn `<Calendar>`) e qualquer leitura/gravação em coluna Postgres `DATE` DEVEM usar `parseLocalDate` / `formatLocalDate` / `parseLocalDateOrNow` de `@/lib/utils/parseLocalDate`.

**Why:** `new Date("YYYY-MM-DD")` parseia como UTC midnight, deslocando para o dia anterior em SP (UTC-3) na exibição. `Date.toISOString().split("T")[0]` desloca para o dia seguinte em fusos positivos. Ambos os anti-padrões são proibidos.

**How to apply:**
- Testes canônicos: `src/lib/utils/__tests__/parseLocalDate.test.ts` (round-trip + contrato com shadcn Calendar + asserts negativos por fuso).
- Scripts: `bun run test:tz` roda os helpers em `TZ=America/Sao_Paulo`, `UTC` e `Asia/Tokyo`.
- Guard CI: `audit/date-tz-guard.sh` + `audit/date-tz-allowlist.txt` (60 arquivos legados). Workflow `.github/workflows/regression-greps.yml` job `test-tz` + step "Date timezone guard" falha o PR se um arquivo NOVO usar os anti-padrões.
- Refatorou um arquivo legado? Remover linha do `audit/date-tz-allowlist.txt` (o guard emite WARN para entradas stale).
