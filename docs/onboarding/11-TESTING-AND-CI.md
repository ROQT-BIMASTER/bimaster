---
title: Testes & CI
audience: ai-coding-agent
last_updated: 2026-05-02
---

# 11 — Testes & CI

## Stack de testes

- **Vitest 4** (`vitest.config.ts`).
- **@testing-library/react** + `@testing-library/jest-dom` + `@testing-library/user-event`.
- **jsdom** como ambiente.
- Setup global: `src/test/setup.ts`.
- Helpers: `src/test/utils/test-utils.tsx`.

## Onde colocar testes

| Tipo | Local |
|---|---|
| Unitário de util | `src/lib/__tests__/<nome>.test.ts` |
| Unitário de helper | `src/lib/utils/__tests__/<nome>.test.ts` |
| Componente | `src/pages/modules/__tests__/<X>.test.tsx` ou ao lado do componente |
| Contexto | `src/test/contexts/<X>.test.tsx` |
| Segurança (validação) | `src/test/security/security-validation.test.ts` |

## Comandos

```bash
bunx vitest run                 # toda a suíte
bunx vitest                     # watch
bunx vitest <padrão>            # filtrado
bunx vitest run --coverage      # cobertura (se configurado)
```

## Padrão de teste

```ts
import { describe, it, expect } from "vitest";
import { formatCurrency } from "@/lib/formatters";

describe("formatCurrency", () => {
  it("formata em BRL com centavos", () => {
    expect(formatCurrency(1234.5)).toMatch(/1\.234,50/);
  });
});
```

Para componentes:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

it("dispara onSubmit", async () => {
  const onSubmit = vi.fn();
  render(<MyForm onSubmit={onSubmit} />);
  await userEvent.type(screen.getByLabelText("Nome"), "João");
  await userEvent.click(screen.getByRole("button", { name: /salvar/i }));
  expect(onSubmit).toHaveBeenCalledWith({ nome: "João" });
});
```

## Suites já existentes

- `src/lib/__tests__/formatters.test.ts`
- `src/lib/__tests__/prazoCalculator.test.ts`
- `src/lib/__tests__/projetoFilterUtils.test.ts`
- `src/lib/utils/__tests__/debounce.test.ts`
- `src/lib/utils/__tests__/memory-manager.test.ts`
- `src/lib/utils/__tests__/offline-manager.test.ts`
- `src/lib/utils/__tests__/storage-helper.test.ts`
- `src/utils/__tests__/tarefaRiskUtils.test.ts`
- `src/test/contexts/AuthContext.test.tsx`
- `src/test/security/security-validation.test.ts`
- `src/pages/modules/__tests__/MarketingModule.test.tsx`

## Testes E2E de segurança (RLS)

`scripts/security/`:

| Script | Verifica |
|---|---|
| `e2e-anonymous-sensitive-columns.sh` | Anônimo não acessa colunas sensíveis (`our_products`, `product_comparisons`, `social_media_metrics_history`). |
| `e2e-authenticated-sensitive-columns.sh` | Usuário autenticado só vê o que deveria ver. |
| `e2e-clickjacking.sh` | Headers anti-frame em rotas sensíveis. |
| `hsts-subdomain-scan.sh` | HSTS em subdomínios. |

Rode local:

```bash
bash scripts/security/e2e-anonymous-sensitive-columns.sh
```

Memória: `mem://security/rls-e2e-security-suite`.

## CI — `.github/workflows/`

### `security-rls-e2e.yml`

Roda os scripts E2E de RLS em cada push/PR. **Bloqueia merge** se anônimo
ganhar acesso a coluna sensível.

### `regression-greps.yml`

Verificações por grep para regressões conhecidas. Inclui:

- Changelog em `ApiDocumentation.tsx` quando `APP_VERSION` muda.
- Outras invariantes de memória.

## Boas práticas

- Mock o **mínimo** possível. Prefira testar comportamento real.
- Use `parseLocalDate` em assertions de data — mesmo gotcha do app.
- Não teste implementação interna; teste contrato.
- Teste fluxos críticos (auth, AP imutável, RLS) — não 100% de coverage.

## QA Agent

`src/pages/QAAgent.tsx` + edge `qa-agent`. Conta `✅`/`❌`/`⚠️` no markdown da
resposta para popular stats. Útil para QA exploratória orientada por IA.
