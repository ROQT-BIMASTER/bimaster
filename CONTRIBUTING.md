# Contribuindo — Bi Master

Guia interno para devs trabalhando neste repositório. Para regras destinadas a
agentes de código (Cursor, Copilot, Claude Code, etc.), ver [`AGENTS.md`](./AGENTS.md).

## Setup

```bash
bun install
cp .env.example .env   # preencha as chaves publishable do backend de dev
bun run dev            # http://localhost:8080
```

Detalhes em [`docs/onboarding/01-STACK-AND-SETUP.md`](./docs/onboarding/01-STACK-AND-SETUP.md).

## Branch model

- `main` é protegido. Todo trabalho via feature branch + Pull Request.
- Nomeação sugerida: `feat/<modulo>-<descricao>`, `fix/<descricao>`,
  `chore/<descricao>`, `docs/<descricao>`.

## Commit convention

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat(financeiro): adicionar projeção DRE 12m
fix(trade): corrigir validação CNPJ duplicado
chore(deps): bump zod 3.25
docs(security): consolidar índice
```

## Checklist de PR

- [ ] `bun run lint` passa
- [ ] `bunx vitest run` passa
- [ ] Build limpo (sem warnings novos)
- [ ] Mudança em SDK/OpenAPI/`APP_VERSION` → entrada em `ApiDocumentation.tsx`
- [ ] Mudança em RLS / dados sensíveis → `scripts/security/e2e-*.sh` validado
- [ ] Documentação atualizada quando aplicável (`docs/`, `AGENTS.md`)
- [ ] Sem `console.log` esquecido em produção
- [ ] Sem cores literais — usar tokens semânticos do design system

## Padrões de código

- **TypeScript strict**, sem `any` implícito.
- **Tailwind** com tokens HSL semânticos (`bg-background`, `text-foreground`,
  `bg-primary`, etc.) — nunca `#hex` ou `bg-white` em componentes.
- **Zod** sempre com `.strict()`.
- **Datas Postgres `DATE`**: `parseLocalDate`, nunca `new Date(string)`.
- **Edge Functions**: sempre wrappadas em `secureHandler`.
- **IA**: sempre via `invokeChat` (front) ou `callAIGateway` (edge).

Padrões completos em [`AGENTS.md`](./AGENTS.md).

## Testes

```bash
bunx vitest run                                    # toda a suíte
bunx vitest <pattern>                              # filtrado
bash scripts/security/e2e-anonymous-sensitive-columns.sh
```

## Revisão

Atribua reviewer pela área dominante da mudança (ver `.github/CODEOWNERS`).
PRs grandes (>500 linhas) devem ser quebrados sempre que possível.
