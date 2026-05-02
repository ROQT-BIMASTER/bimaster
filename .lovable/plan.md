## Objetivo

Produzir um pacote de documentação que permita a **outro desenvolvedor — humano ou outra IA (Cursor, Claude Code, Copilot, Windsurf)** — clonar o repositório e operar no padrão do projeto sem precisar adivinhar regras. Tudo derivado da memória do projeto (`mem://index.md`), das pastas reais (`src/`, `supabase/functions/`, `docs/`) e dos padrões já consolidados.

Sem credenciais reais — apenas placeholders.

---

## Entregáveis (3 artefatos)

### 1. `AGENTS.md` (raiz do repo) — convenção de fato para agentes de IA

Arquivo único, ~600–900 linhas, formato imperativo, com:

- **Stack & runtime**: Vite 5 + React 18 + TS 5 + Tailwind 3 + shadcn/ui + React Router 6 + TanStack Query 5 + Supabase JS 2 + Zod + Recharts + date-fns. Bun como gerenciador.
- **Comandos**: `bun install`, `bun run dev`, `bun run build`, `bun run lint`, `bunx vitest run`. Aviso: **não rodar build manualmente em ambiente Lovable** (o harness faz isso).
- **Layout de pastas** (mapa real): `src/pages`, `src/components/{projetos,fabrica,trade,marketing,financeiro,china,…}`, `src/hooks`, `src/lib`, `src/integrations/supabase`, `supabase/functions`, `docs`.
- **Backend**: Lovable Cloud (Supabase gerenciado). Tabelas/RLS via migrations. **Nunca** editar `src/integrations/supabase/{client,types}.ts` nem `.env`.
- **Padrões de código** extraídos do `mem://index.md` Core:
  - Tom profissional, sem emojis, mascarar Lovable/Supabase para o usuário final ("backend", "Lovable Cloud").
  - `formatCurrency` para moeda; timezone `America/Sao_Paulo`.
  - `parseLocalDate` para colunas `DATE` (nunca `new Date(string)`).
  - `DecimalInput` com 4 casas.
  - `StoragePreviewDialog` + `triggerBlobDownload` (nunca `window.open` para arquivos).
  - Zod sempre `.strict()`.
  - `supervisor_id` é a fonte de verdade hierárquica (`gerente_id` deprecado).
- **Edge Functions**: sempre `Deno.serve` + wrapper `secureHandler` (`supabase/functions/_shared/secure-handler.ts`); IA via `callAIGateway` (`_shared/ai-gateway-call.ts`); frontend usa `invokeChat` (`src/lib/ai/invokeChat.ts`).
- **Modelos de IA**: política Gemini Flash em chats; GPT-5.2 para reasoning pesado; nunca `reasoning` em modelos `openai/*` (gateway rejeita).
- **RLS**: zero exposição pública; `SECURITY DEFINER` RPC; semi-joins (`IN`/`EXISTS`) em vez de funções SQL nas policies.
- **Storage**: paths começam com UID; magic-bytes; 20 MB; double-extension bloqueada.
- **Design tokens**: HSL semântico em `index.css` + `tailwind.config.ts`. **Nunca** usar `text-white`/`bg-black` direto. Hook `usePageBgColor` para fundo por página.
- **Git/Lovable**: sync bidirecional com GitHub. Commits do GitHub aparecem no Lovable e vice-versa. Não rodar `git add/commit/push` localmente sem coordenar.
- **DO / DON'T** explícitos no final.

### 2. `docs/onboarding/` (pacote modular)

```text
docs/onboarding/
├── 00-INDEX.md                  Roteiro de leitura
├── 01-STACK-AND-SETUP.md        Instalação, env vars, comandos, troubleshooting
├── 02-ARCHITECTURE.md           Camadas, fluxo de dados, query/cache, roteamento
├── 03-MODULES.md                Cada módulo de negócio (Projetos, Trade, Marketing, Fábrica, Finance, China, Sales, Marketing/Influencers, Admin, Portal)
├── 04-DATABASE-AND-RLS.md       Convenções de schema, hierarquia (supervisor_id), padrões RLS, SECURITY DEFINER, semi-joins
├── 05-EDGE-FUNCTIONS.md         secureHandler, callAIGateway, padrão de erros 429/402/timeout, config.toml
├── 06-AI-AND-COPILOT.md         Modelos suportados, política de fallback, copilots (Sofia, Projeto, Central), retenção 30d
├── 07-SECURITY-AND-LGPD.md      Zero public exposure, PII, file upload, storage UID paths, impersonation, secrets
├── 08-UI-DESIGN-SYSTEM.md       Tokens HSL, shadcn variants, densidade, page bg customizer, padrões Trade (#E91E78), focus mode (Fábrica)
├── 09-FINANCE-DEEP-DIVE.md      DRE IFRS-18, Chart of Accounts v2, AP/AR sync, Sofia, provisões PDD, DPO/DSO, audit
├── 10-INTEGRATIONS.md           Asana sync 2-fase, Shipsgo, Phyllo, Apify, Pluggy, ERP Huggs, Mapbox/Google Maps
├── 11-TESTING-AND-CI.md         Vitest, security RLS e2e (scripts/security/*), .github/workflows
├── 12-RELEASE-AND-CHANGELOG.md  Disciplina ApiDocumentation.tsx, APP_VERSION bumps
└── 13-GOTCHAS.md                Lista única de armadilhas (UTC date shift, anon vs publishable key, reasoning OpenAI, etc.)
```

Cada arquivo entre 150 e 400 linhas, denso, com snippets curtos referenciando o caminho real. Sem narrativa de "como cheguei aqui".

### 3. `AI_CONTEXT.md` (raiz) — system prompt portátil

Versão condensada (~400 linhas) escrita como **system prompt para IA externa**:

- Identidade: "Você está editando o repositório `bimaster` (React/Vite/Supabase via Lovable Cloud)…"
- Invariantes inegociáveis (lista numerada de ~40 itens, derivada do Core do `mem://index.md`).
- Glossário de domínio (Projeto, Tarefa, Processo, Etapa, DRE, AP/AR, Trade PDV, Influencer, Submissão China, etc.).
- Mapa "se o usuário pedir X → vá para Y": tabela de roteamento de tarefas para arquivos/pastas certos.
- Comandos seguros vs. proibidos.
- Modelos de IA, fallback, e formato esperado de erros.
- Bloco final "When in doubt, ask" com perguntas-modelo.

Esse arquivo é o que se cola direto no chat de outra IA antes de pedir uma tarefa.

---

## Conteúdo derivado de fontes reais

Nenhum conteúdo será inventado. Cada seção mapeia para:

- `mem://index.md` + memórias linkadas → regras Core e governança.
- `package.json` → versões e libs.
- `src/integrations/supabase/client.ts` → cliente (não editar).
- `supabase/functions/_shared/{secure-handler,ai-gateway-call,cors}.ts` → padrão edge.
- `src/lib/ai/invokeChat.ts` → padrão chamada IA no front.
- `src/lib/utils/parseLocalDate.ts`, `src/lib/formatters.ts` → utilitários obrigatórios.
- `src/hooks/usePageBgColor.ts` (e similares) → padrão de fundo por página.
- `docs/API_*.md` (já existem ~30) → linkados de `10-INTEGRATIONS.md`.
- `scripts/security/*` + `.github/workflows/security-rls-e2e.yml` → seção testes.
- `tailwind.config.ts` + `index.css` → design system.

---

## Política de credenciais (seu pedido: placeholders)

Em todos os arquivos, usar:

```text
SUPABASE_URL=<your-project-url>
SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
SUPABASE_PROJECT_REF=<your-project-ref>
LOVABLE_API_KEY=<auto-provisionado-pela-Lovable-Cloud>
```

Não incluir: project ref real, anon key, URLs de preview/produção, nomes de domínios customizados, IDs internos.

---

## Detalhes técnicos (para revisor técnico)

**Tamanho-alvo total**: ~3.500 linhas markdown distribuídas. AGENTS.md prioriza densidade; `/docs/onboarding/` prioriza navegabilidade; AI_CONTEXT.md prioriza prompt-eficiência (token budget < 8k).

**Formato consistente**: cada arquivo abre com bloco YAML simples (`title`, `audience: ai-coding-agent`, `last_updated`), sumário de 5–10 linhas, depois seções `##`.

**Cross-linking**: AGENTS.md aponta para `docs/onboarding/` para profundidade; AI_CONTEXT.md é autocontido (não depende de outros arquivos para funcionar colado em outra IA).

**Não toca código de aplicação**: apenas cria arquivos de documentação. Nada em `src/`, `supabase/`, `.github/`. Nenhuma migration. Nenhum impacto em build.

**Mantém memória**: ao final, atualizar `mem://index.md` adicionando uma entrada apontando para `AGENTS.md` e `AI_CONTEXT.md` (entrada do tipo `reference`) para que o próprio Lovable saiba que esses documentos existem como fonte canônica de onboarding externo.

---

## Fora de escopo

- Não criar repositório/PR no GitHub (já discutido em mensagem anterior — é ação manual no Connectors).
- Não gerar `CONTRIBUTING.md`, templates de PR/issue ou GitHub Actions novos (pode ser próximo passo se você quiser).
- Não traduzir para inglês (tudo em PT-BR, mantendo termos técnicos e nomes de produto em inglês quando padrão).
