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

## Novos hooks de domínio

Hooks que expõem regras de negócio (ex.: histórico, aprovação, custo, etc.)
devem seguir o **padrão de barrel** para garantir imports estáveis e
documentação descobrível. Use `src/hooks/itemHistorico/` como referência.

Checklist obrigatório ao adicionar um hook de domínio:

- [ ] **Implementação** em arquivo dedicado (`src/hooks/use<Dominio>.ts`),
      com hooks como `export const` (não `function` solto) para garantir
      detecção de exports pelo TS no CI de typecheck.
- [ ] **Barrel** em `src/hooks/<dominio>/index.ts` reexportando hooks,
      constantes e **tipos** (`export type`) — sempre com caminho `@/...`,
      nunca relativo.
- [ ] **Imports padronizados** em todo o projeto via barrel
      (`@/hooks/<dominio>`); não importar do arquivo interno.
- [ ] **Regra ESLint** em `eslint.config.js` (`no-restricted-imports`)
      bloqueando o caminho interno e apontando para o barrel; isentar
      apenas o próprio diretório do barrel via override de `files`.
- [ ] **README** em `src/hooks/<dominio>/README.md` com: padrão de import,
      tabela da API pública, exemplos de uso e convenções (cache,
      invalidação, filtros).
- [ ] **Testes** em `src/hooks/<dominio>/__tests__/` cobrindo casos felizes,
      filtros/parâmetros e invalidação de cache de mutations.
- [ ] **Link** do README do hook adicionado à tabela de documentação do
      `README.md` raiz e à seção "Hooks de domínio".
- [ ] Sem chamadas diretas ao Supabase no componente — toda I/O passa pelo
      hook (front mascarado, fácil de mockar em teste).
- [ ] Mutations invalidam **todas** as `queryKey`s afetadas via
      `queryClient.invalidateQueries`.
- [ ] Datas Postgres `DATE` sempre via `parseLocalDate`; moeda via
      `formatCurrency`.

## Migrations vs seeds

- `supabase/migrations/` — **apenas DDL** (CREATE/ALTER TABLE, RLS, GRANTs,
  functions, triggers, RPCs, índices). O harness Lovable reaplica em ordem
  qualquer arquivo novo aqui; DML destrutiva (`DELETE`, `TRUNCATE`, `UPDATE`
  em massa) reexecutada apaga dados reais.
- `supabase/seeds/` — seeds de dados (INSERTs de catálogos, templates,
  fixtures de demo). Não são aplicados automaticamente. Rodar manualmente em
  clones via `psql "$DATABASE_URL" -f supabase/seeds/<arquivo>.sql`.
- Antes de abrir PR, rodar:

  ```bash
  rg -n '^(DELETE|TRUNCATE|UPDATE)\s' supabase/migrations/
  ```

  Qualquer hit precisa virar seed ou ser justificado em revisão.


## Revisão

Atribua reviewer pela área dominante da mudança (ver `.github/CODEOWNERS`).
PRs grandes (>500 linhas) devem ser quebrados sempre que possível.
