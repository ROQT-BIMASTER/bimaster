# AGENTS.md

> Convenção de fato para agentes de IA (Cursor, Claude Code, Copilot, Windsurf, Aider) e
> desenvolvedores humanos trabalhando neste repositório.
>
> **Leia este arquivo antes de qualquer alteração.** Para profundidade, ver
> [`docs/onboarding/`](./docs/onboarding/00-INDEX.md). Para colar como system prompt em
> outra IA, ver [`AI_CONTEXT.md`](./AI_CONTEXT.md).

---

## 0. Identidade do projeto

- **Nome interno**: `bimaster` (white-label).
- **Tipo**: ERP/PLM/CRM multi-módulo (Projetos, Trade Marketing, Marketing, Fábrica/PLM,
  Financeiro com DRE IFRS-18, Operações China–Brasil, Vendas, Portal Cliente, Admin).
- **Hospedagem**: Lovable (preview + sync bidirecional GitHub).
- **Backend**: Lovable Cloud (Supabase gerenciado). **Nunca chame de "Supabase"
  para o usuário final** — sempre "backend" ou "Lovable Cloud".

---

## 1. Stack

| Camada | Tecnologia |
|---|---|
| Build/dev | Vite 5 + `@vitejs/plugin-react-swc` |
| Linguagem | TypeScript 5.8 (strict) |
| UI | React 18.3 + shadcn/ui + Radix |
| Estilo | Tailwind CSS 3.4 + `tailwindcss-animate` + `@tailwindcss/typography` |
| Roteamento | React Router 6.30 |
| Data fetch / cache | TanStack Query 5.83 |
| Forms | React Hook Form 7 + `@hookform/resolvers` + Zod 3.25 (`.strict()`) |
| Backend SDK | `@supabase/supabase-js` 2.58 |
| Edge Functions | Deno (`Deno.serve`) com wrapper `secureHandler` |
| Charts | Recharts 2.15 |
| Datas | `date-fns` 3.6 (timezone `America/Sao_Paulo`) |
| Drag & drop | `@dnd-kit/*` + `@hello-pangea/dnd` |
| Mapas | Mapbox GL + `@vis.gl/react-google-maps` |
| Documentos | `jspdf`, `pptxgenjs`, `exceljs`, `pdfjs-dist`, `jszip` |
| Realtime/voz | `@elevenlabs/react` |
| Notifs | `sonner` (toasts) |
| PWA | `vite-plugin-pwa` + `workbox-window` |
| Testes | `vitest` 4 + `@testing-library/react` + `jsdom` |
| Pacotes | **Bun** (lockfile `bun.lockb`) |

---

## 2. Comandos

```bash
bun install              # instala deps
bun run dev              # vite dev server
bun run build            # build produção (NÃO rodar em ambiente Lovable; o harness faz isso)
bun run build:dev        # build em modo development (com sourcemaps)
bun run lint             # eslint
bunx vitest run          # roda toda a suíte de testes uma vez
bunx vitest              # watch mode
```

> **Regra Lovable**: dentro do agent Lovable, **não rode `npm run build`,
> `bun run build`, nem `tsc --noEmit` manualmente** — o harness faz isso
> automaticamente após cada edição. Em IDE local (Cursor etc.), pode rodar normalmente.

Scripts de segurança E2E:

```bash
bash scripts/security/e2e-anonymous-sensitive-columns.sh
bash scripts/security/e2e-authenticated-sensitive-columns.sh
bash scripts/security/e2e-clickjacking.sh
```

---

## 3. Layout do repositório

```text
.
├── AGENTS.md                       ← você está aqui
├── AI_CONTEXT.md                   ← system prompt portátil para IAs externas
├── README.md
├── package.json                    ← Bun
├── vite.config.ts
├── tailwind.config.ts              ← tokens HSL
├── tsconfig*.json
├── components.json                 ← shadcn config
├── index.html
├── public/                         ← assets públicos, _headers, robots, sw
├── src/
│   ├── main.tsx                    ← entry
│   ├── App.tsx                     ← rotas raiz
│   ├── index.css                   ← tokens CSS (HSL semântico)
│   ├── pages/                      ← 200+ páginas, agrupadas por domínio
│   │   ├── projetos/
│   │   ├── financeiro/
│   │   ├── trade/
│   │   ├── marketing/
│   │   ├── fabrica/  (FichaCustoProduto, etc.)
│   │   ├── china/
│   │   ├── admin/
│   │   ├── portal/
│   │   └── ...
│   ├── components/
│   │   ├── projetos/               ← módulo Projetos (UI)
│   │   ├── trade/                  ← Trade Marketing (#E91E78)
│   │   ├── marketing/
│   │   ├── fabrica/                ← Focus Mode density
│   │   ├── financeiro/
│   │   ├── china/
│   │   ├── admin/, ai/, auth/, ui/ (shadcn primitives)
│   │   └── ...
│   ├── hooks/                      ← `usePageBgColor`, `useTarefaDensity`, etc.
│   ├── lib/
│   │   ├── ai/invokeChat.ts        ← wrapper IA com timeout
│   │   ├── utils/parseLocalDate.ts ← USAR para colunas DATE
│   │   ├── formatters.ts           ← `formatCurrency`, etc.
│   │   ├── validations/            ← schemas Zod
│   │   ├── fabrica/                ← BOM, custo, MRP, fiscal
│   │   ├── presentation/           ← PDF/PPTX builders
│   │   └── ...
│   ├── integrations/supabase/
│   │   ├── client.ts               ← AUTO-GERADO — NÃO EDITAR
│   │   └── types.ts                ← AUTO-GERADO — NÃO EDITAR
│   ├── contexts/                   ← EmpresaContext, InboxDrawerContext
│   ├── types/
│   ├── utils/, config/, test/
├── supabase/
│   ├── config.toml                 ← project_id + per-function overrides apenas
│   ├── functions/
│   │   ├── _shared/                ← secure-handler, ai-gateway-call, cors, waf...
│   │   ├── ai-insights/, ai-creative-studio/, asana-sync/, sofia-*/
│   │   ├── projeto-copilot-*/, central-copilot-*/
│   │   ├── shipsgo-*/, contas-pagar*/, contas-receber*/
│   │   └── 200+ outras funções
├── scripts/
│   ├── security/                   ← E2E RLS + clickjacking + HSTS
│   ├── audit/
│   └── dr/
├── docs/
│   ├── onboarding/                 ← documentação canônica (ler primeiro)
│   ├── API_*.md                    ← contratos públicos da API REST
│   ├── EDGE_FUNCTIONS.md, SECURITY.md, DEPLOYMENT.md, TESTING.md
│   └── migrations/, qa/, fixes-abr26/
├── .github/workflows/
│   ├── regression-greps.yml
│   └── security-rls-e2e.yml
├── cloudflare/                     ← worker.js, wrangler.toml
├── netlify.toml, vercel.json
└── .env.example
```

---

## 4. Arquivos auto-gerados — NUNCA editar manualmente

- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `.env`
- `supabase/config.toml` → **só** adicione blocos `[functions.<name>]` para overrides
  de função (ex.: `verify_jwt`, `import_map`). Nunca mude `project_id`.

---

## 5. Variáveis de ambiente

`.env` é **gitignored** (ver `.gitignore`) e gerenciado pelo Lovable Cloud:
auto-provisionado/regenerado dentro do sandbox, **nunca commitado**. Em
clones externos (Cursor, IDE local, CI), copie de `.env.example` e preencha
com os valores exibidos em **Connectors → Lovable Cloud** no editor Lovable.
Conteúdo esperado:

```env
VITE_SUPABASE_PROJECT_ID=<your-project-id>
VITE_SUPABASE_URL=<your-project-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
```

Se um `.env` antigo já estava trackeado no repo, rode **uma vez** fora do
agent Lovable: `git rm --cached .env && git commit -m "chore: untrack .env"`.

Secrets server-side (acessados em Edge Functions via `Deno.env.get`):

- `LOVABLE_API_KEY` — auto-provisionado, **nunca pedir ao usuário**.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` — auto.
- Demais secrets (Apify, Phyllo, Asana, Shipsgo, ElevenLabs, Mapbox server,
  fal.ai, Pluggy, ERP Huggs, etc.) → adicionar via tool `add_secret`. Nunca
  hardcodar nem logar.

> **Use a publishable key no front, nunca a anon key legacy.** A anon key foi
> deprecada em projetos novos.

---

## 6. Regras Core (extraídas de `mem://index.md` — invioláveis)

1. **Tom profissional, sem emojis** em UI, copy, comentários voltados ao usuário.
2. **Mascarar infra**: para o usuário final, sempre "backend" / "Lovable Cloud" —
   nunca "Supabase", "Postgres", "Edge Function", "RLS".
3. **Moeda**: `formatCurrency(value)` (com centavos). Nunca `toFixed(2)` solto.
4. **Timezone**: `America/Sao_Paulo` em todo formato/comparação de data.
5. **Datas Postgres `DATE`**: usar `parseLocalDate` de `@/lib/utils/parseLocalDate`.
   **Nunca `new Date("2024-05-01")`** — gera shift UTC e quebra `isToday`/`isBefore` em SP.
6. **Download de arquivos**: `StoragePreviewDialog` + helper `triggerBlobDownload`.
   **Nunca `window.open(url)`** para arquivos privados.
7. **Zod**: sempre `.strict()` (bloqueia mass-assignment).
8. **Edge Functions**: sempre `Deno.serve(secureHandler({...}, async (req, ctx) => {...}))`.
9. **IA no edge**: sempre `callAIGateway` de `_shared/ai-gateway-call.ts`. Nunca
   chamar `https://ai.gateway.lovable.dev/...` direto sem o wrapper (perde fallback
   429→flash, timeout, tradução de erros).
10. **IA no front**: sempre `invokeChat()` de `@/lib/ai/invokeChat`. Tem timeout 90s
    e traduz 402/429/timeout em `userMessage` para toast.
11. **Modelo padrão de chats**: `google/gemini-3-flash-preview`. Para reasoning
    pesado: `openai/gpt-5.2`. **Nunca enviar `reasoning` para modelos `openai/*`**
    (gateway rejeita com 400) — só Gemini.
12. **RLS**: zero exposição pública. Use `SECURITY DEFINER` RPC para casos
    cross-tenant. Em policies, **prefira semi-joins (`IN`, `EXISTS`)** em vez de
    funções SQL (perf em alta volumetria).
13. **Hierarquia**: `supervisor_id` é a única fonte de verdade. `gerente_id` é
    deprecado — não use em código novo.
14. **`DecimalInput`**: sempre 4 casas decimais (custo, alíquotas, IVA).
15. **Storage**: paths começam com UID do dono (`<uid>/<...>`); validação magic-bytes;
    limite 20 MB; double-extension bloqueada.
16. **Roles**: nunca em `profiles`. Sempre tabela `user_roles` + função
    `has_role(_user_id, _role)` SECURITY DEFINER. Risco de privilege escalation.
17. **Sem credenciais hardcoded**, sem `localStorage` para checar admin.
18. **Sem signups anônimos**. Confirmação de email **não** auto-confirma sem pedido.
19. **Releases**: bump de SDK/OpenAPI/`APP_VERSION` exige entrada no changelog
    em `src/pages/admin/ApiDocumentation.tsx` (verificável por grep no CI).

---

## 7. Padrão de Edge Function

```ts
// supabase/functions/<name>/index.ts
import { z } from "https://esm.sh/zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";

const Body = z.object({
  message: z.string().min(1).max(4000),
}).strict();

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 30, rateLimitPrefix: "<name>" },
  async (req, ctx) => {
    const cors = getCorsHeaders(req);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const r = await callAIGateway({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "Você é um assistente útil." },
        { role: "user", content: parsed.data.message },
      ],
    });
    if (r.kind !== "ok") return aiGatewayErrorResponse(r, cors);

    return new Response(JSON.stringify({ reply: r.data.choices[0].message.content }),
      { headers: { ...cors, "Content-Type": "application/json" } });
  },
));
```

Modos de auth do `secureHandler`: `"jwt" | "apikey" | "any" | "none"`.
Pipeline aplicada: CORS → WAF L7 → IP blocklist → JWT/API-key → quarentena de
conta → MFA enforcement → step-up (se exigido) → rate-limit → handler →
security headers → headers `RateLimit-*`.

---

## 8. Padrão de chamada IA no frontend

```ts
import { invokeChat } from "@/lib/ai/invokeChat";

const { data, error } = await invokeChat<{ reply: string }>(
  "ai-insights",
  { message: input },
  { timeoutMs: 60_000 },
);
if (error) {
  toast.error(error.userMessage); // já traduz 402/429/timeout
  return;
}
```

Para streaming (SSE), seguir o padrão em `src/hooks/useQAAgent.ts`: `fetch` direto
para `${VITE_SUPABASE_URL}/functions/v1/<name>` com `getAuthHeaders()`, parse
linha-a-linha, atualizar a última mensagem do assistant in-place.

---

## 9. Database & RLS

- Migrations via tool `supabase--migration` (nunca `psql` direto para DDL).
- Nunca FK em `auth.users` — replicar dados em `profiles` no schema `public`.
- Nunca `ALTER DATABASE postgres ...`.
- Nunca `CHECK (expire_at > now())` — use trigger de validação (CHECK precisa
  ser imutável).
- Nunca operar nos schemas `auth`, `storage`, `realtime`, `supabase_functions`,
  `vault` (degrada serviço).
- RLS sempre habilitado. Policies preferem `EXISTS`/`IN` a chamadas de função.

---

## 10. Design system

- **Tokens**: definidos em `src/index.css` e `tailwind.config.ts` em **HSL** (sem `#`,
  sem `rgb`).
- **Nunca** `bg-white`, `text-black`, `bg-[#fff]` em componentes — sempre tokens
  semânticos: `bg-background`, `text-foreground`, `bg-primary`, `text-primary-foreground`,
  `bg-muted`, `bg-card`, `border-border`, etc.
- Gradientes/sombras customizadas como variáveis: `--gradient-primary`,
  `--shadow-elegant`.
- Variantes via `cva` (class-variance-authority).
- Hook `usePageBgColor` para fundo configurável por página (padrão Projetos).
- **Trade Marketing**: tema rosa `#E91E78`, bordas 16px, banners 3:1. Ver
  `mem://architecture/trade-marketing-standards-consolidated`.
- **Fábrica – Ficha de Análise**: Focus Mode densidade alta (10–11px, padding mínimo).
- **Projetos**: `useTarefaDensity` (compact / comfortable, persistido em
  `localStorage`); KPIs translúcidos `bg-card/70 backdrop-blur-sm`.

---

## 11. Sincronização com GitHub

- Lovable ↔ GitHub é **sync bidirecional automática**. Commit no GitHub
  reflete no Lovable em segundos e vice-versa.
- Em IDE local: trabalhe normalmente em branches, abra PRs para `main`. Após
  merge, mudanças aparecem no Lovable.
- **No agent Lovable**: nunca rode `git add/commit/push/pull/merge/rebase/reset/stash/checkout`
  — o estado git é gerenciado pelo harness.
- Para conectar GitHub: editor Lovable → **Connectors** (sidebar raiz) → **GitHub** → **Connect project**.

---

## 12. Testes & CI

- `vitest` em `src/**/__tests__/*.test.ts(x)` e `src/test/**`.
- E2E de RLS (anônimo + autenticado bloqueados em colunas sensíveis):
  `scripts/security/e2e-*.sh`, rodados em `.github/workflows/security-rls-e2e.yml`.
- Regression greps (`mem://process/release-changelog-discipline` etc.) em
  `.github/workflows/regression-greps.yml`.

---

## 13. DO

- Ler `mem://index.md` (fica sempre em contexto no Lovable; em IA externa, ler
  `AI_CONTEXT.md`) **antes** de propor mudanças amplas.
- Usar `parseLocalDate`, `formatCurrency`, `triggerBlobDownload`, `usePageBgColor`,
  `invokeChat`, `secureHandler`, `callAIGateway`, `DecimalInput`.
- Preferir migrations atômicas a múltiplos `ALTER` separados.
- Quebrar componentes grandes (>300 linhas) em arquivos menores e focados.
- Verificar build/console/network após mudanças relevantes.
- Sempre tratar 402 e 429 do AI Gateway com toast claro ao usuário.

## 14. DON'T

- ❌ Editar `src/integrations/supabase/client.ts`, `types.ts`, `.env`.
- ❌ Chamar `https://ai.gateway.lovable.dev/...` direto do front.
- ❌ Usar `new Date("YYYY-MM-DD")`.
- ❌ Usar `window.open` para baixar arquivos privados.
- ❌ Cores literais (`bg-white`, `#FF0000`).
- ❌ `gerente_id` em código novo.
- ❌ Roles em `profiles`.
- ❌ `localStorage` para checar admin / autorização.
- ❌ Funções SQL pesadas dentro de RLS policies em tabelas de alto volume.
- ❌ Mencionar "Supabase" / "Edge Function" para o usuário final.
- ❌ `git commit`/`push` dentro do agent Lovable.
- ❌ Rodar `bun run build` / `tsc --noEmit` manualmente no agent Lovable.
- ❌ `reasoning: {...}` em modelos `openai/*` (só Gemini).
- ❌ Signup anônimo / auto-confirm de email sem pedido explícito.

---

## 15. Quando estiver em dúvida

1. Procure no `mem://index.md` (índice de memórias) ou em `docs/onboarding/`.
2. Faça grep em `src/` por padrão similar (`rg "padrão"`).
3. Pergunte ao usuário com opções concretas — não com perguntas abertas.

Para profundidade módulo a módulo, ver [`docs/onboarding/`](./docs/onboarding/00-INDEX.md).
