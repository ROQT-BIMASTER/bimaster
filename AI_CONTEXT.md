# AI_CONTEXT.md

> **Cole este arquivo inteiro como system prompt** ao iniciar uma sessão em
> Cursor, Claude Code, Copilot Chat, Windsurf, Aider, ChatGPT ou qualquer outro
> assistente de IA que vá editar este repositório.
>
> Este arquivo é autocontido. Ele não exige que a IA leia outros arquivos para
> respeitar as regras do projeto.

---

## 1. Identidade

Você está editando o repositório **`bimaster`** — um ERP/PLM/CRM multi-módulo
em React + Vite + TypeScript com backend gerenciado (Lovable Cloud sobre
Supabase). Seu papel: implementar mudanças seguindo **estritamente** as regras
abaixo, sem inventar padrões novos.

Stack resumida:

- Vite 5 · React 18 · TypeScript 5 strict
- Tailwind 3 + shadcn/ui + Radix
- React Router 6 · TanStack Query 5
- React Hook Form + Zod 3 (`.strict()`)
- `@supabase/supabase-js` 2
- Edge Functions Deno (`Deno.serve`)
- Recharts · date-fns · `@dnd-kit/*` · Mapbox/Google Maps
- Bun como package manager (`bun.lockb`)
- Vitest 4

---

## 2. Invariantes inegociáveis

### Linguagem & comunicação

1. Tom **profissional, sem emojis**. PT-BR para usuário; nomes técnicos em inglês.
2. Para o **usuário final**, sempre dizer "backend" / "Lovable Cloud" — **nunca**
   "Supabase", "Postgres", "Edge Function", "RLS".
3. Comentários no código podem citar tecnologias reais; UI nunca.

### Datas, moeda, números

4. **Toda coluna `DATE` do Postgres** deve ser parseada com
   `parseLocalDate` de `@/lib/utils/parseLocalDate`. **Proibido**
   `new Date("YYYY-MM-DD")` — gera shift UTC e quebra `isToday`/`isBefore` em
   `America/Sao_Paulo`.
5. **Moeda**: `formatCurrency(value)` (com centavos), nunca `toFixed(2)` solto.
6. Timezone: **`America/Sao_Paulo`** em qualquer formatação ou comparação.
7. **`DecimalInput`** sempre com **4 casas decimais** (custos, alíquotas, IVA).

### Arquivos auto-gerados — proibido editar

8. `src/integrations/supabase/client.ts`
9. `src/integrations/supabase/types.ts`
10. `.env`
11. `supabase/config.toml` — só adicione blocos `[functions.<name>]` para
    overrides (ex.: `verify_jwt = false`); **nunca** mude `project_id`.

### Validação & segurança

12. Schemas Zod **sempre** com `.strict()` (bloqueia mass-assignment).
13. Edge Functions **sempre** envoltas em `secureHandler({...}, handler)` de
    `supabase/functions/_shared/secure-handler.ts`. Modos de auth:
    `"jwt" | "apikey" | "any" | "none"`.
14. Roles **nunca** em `profiles` ou `users`. Use tabela `user_roles` + função
    `has_role(_user_id, _role) SECURITY DEFINER`. Risco: privilege escalation.
15. **Nunca** usar `localStorage`/`sessionStorage` ou credenciais hardcoded
    para checar admin. Sempre validação server-side.
16. Sem signup anônimo. Sem auto-confirm de email a menos que pedido
    explicitamente.
17. Storage: paths começam com **UID** do dono (`<uid>/<...>`); validação
    magic-bytes obrigatória; limite 20 MB; double-extension bloqueada.
18. Download de arquivos: `StoragePreviewDialog` + helper `triggerBlobDownload`
    (em `@/lib/utils/storage-download` ou `@/lib/utils/storage-helper`).
    **Proibido** `window.open(url)` para arquivos privados.
19. **Zero exposição pública** de tabelas. RLS habilitada em todas. Para
    casos cross-tenant, use `SECURITY DEFINER` RPC ou tokens.
20. Em policies RLS de tabelas de alto volume, **prefira semi-joins**
    (`IN`, `EXISTS`) a chamadas de função SQL.

### IA

21. Chat front-end: **sempre** `invokeChat(funcName, body, opts?)` de
    `@/lib/ai/invokeChat`. Ele tem timeout 90s e traduz 402/429/timeout em
    `error.userMessage` para toast.
22. Edge Function chamando IA: **sempre** `callAIGateway({...})` de
    `_shared/ai-gateway-call.ts`. Ele faz fallback automático
    `pro → flash → flash-lite` em 429/402, timeout 60s, e retorna
    `{ kind: "ok" | "rate_limited" | "payment_required" | "timeout" | "upstream" }`.
    Em erro, use `aiGatewayErrorResponse(r, corsHeaders)`.
23. **Nunca** chamar `https://ai.gateway.lovable.dev/...` direto do cliente.
24. Modelo padrão para chats: `google/gemini-3-flash-preview`.
    Para reasoning pesado: `openai/gpt-5.2`.
25. **Nunca** envie `reasoning: {...}` para modelos `openai/*` — o gateway
    rejeita com 400. Só Gemini aceita `reasoning`.
26. Streaming SSE: parse linha-a-linha, ignore comentários `:`/keepalive,
    re-buffer JSON parcial, atualize a **última** mensagem assistant in-place
    (não crie nova a cada token). Padrão de referência: `src/hooks/useQAAgent.ts`.
27. Para erros 402: "Créditos de IA esgotados…". Para 429: "Muitas requisições…".
    Para timeout: "Assistente demorou demais…".

### Hierarquia & domínio

28. **`supervisor_id` é a única fonte de verdade hierárquica.** `gerente_id` é
    deprecado — não use em código novo.
29. Acesso a Projetos: criador + admin sempre veem; demais via `projeto_membros`.
    Adição de membros via RPC dedicada, nunca insert direto.
30. Trade — bloquear cadastro de loja com CNPJ duplicado por marca.
31. China–Brasil — protocolo de submissão e torre de controle têm regras de
    bloqueio por etapa; veja módulo `china/`.
32. Financeiro — Contas a Pagar/Receber pagas/canceladas são **imutáveis**;
    atualizações exigem reabertura justificada.
33. DRE segue padrão IFRS-18 com grupos analíticos próprios; Chart of Accounts v2
    é hierárquico.

### UI / Design system

34. Cores: **somente tokens semânticos** (`bg-background`, `text-foreground`,
    `bg-primary`, `bg-card`, `border-border`, `bg-muted`, etc.). **Proibido**
    `bg-white`, `text-black`, `bg-[#fff]`, `#hex` em componentes.
35. Tokens definidos em `src/index.css` e `tailwind.config.ts` em **HSL** (sem
    `#`, sem `rgb()`).
36. Variantes via `cva` (class-variance-authority).
37. Trade Marketing: tema rosa `#E91E78` (via token), bordas 16px, banners 3:1.
38. Fábrica – Ficha de Análise: Focus Mode densidade alta (10–11px, padding mínimo).
39. Hook `usePageBgColor` quando uma página precisa fundo configurável (padrão Projetos).
40. Toasts via `sonner` (`import { toast } from "sonner"`).

### Git / build

41. **No agent Lovable, nunca rode** `git add/commit/push/pull/merge/rebase/reset/stash/checkout`
    — o estado git é gerenciado pelo harness. Em IDE local, fluxo Git normal.
42. **No agent Lovable, nunca rode** `bun run build`, `npm run build`,
    `tsc --noEmit` — o harness compila automaticamente após cada edição.
43. Bump de SDK / OpenAPI / `APP_VERSION` requer entrada correspondente no
    changelog em `src/pages/admin/ApiDocumentation.tsx` (verificável por grep no CI).

---

## 3. Glossário de domínio

| Termo | Significado |
|---|---|
| **Projeto** | Container de produto/iniciativa em desenvolvimento. Tem tarefas, processos, briefing, equipe, copilot. |
| **Tarefa** | Unidade de trabalho dentro de um Projeto; tem prazo obrigatório, responsável, status, prioridade. |
| **Processo** | Workflow regulatório/produtivo (5 etapas: aprovação ART, regulatório etc.) anexado a um Projeto/Produto. |
| **Etapa** | Passo de um Processo; cada uma com permissões granulares (ver Process Permission Matrix). |
| **Pasta Oficial** | Estrutura fixa de tabs por produto (composição, embalagem, INCI, regulatório, fiscal). |
| **DRE** | Demonstração do Resultado do Exercício, padrão IFRS-18 com grupos analíticos. |
| **AP / AR** | Accounts Payable / Receivable — Contas a Pagar / Receber. |
| **PDV** | Ponto de Venda; loja física no módulo Trade. |
| **Influencer** | Perfil monitorado (Instagram, TikTok, YouTube via Phyllo); tem score 360, brand safety, ranking de autopilot. |
| **Submissão China** | Envio de produto/dossiê ao fornecedor chinês; controlada pela Torre de Controle Internacional. |
| **Sofia** | Agente IA financeiro (markdown + Recharts + voz). |
| **Copilot Projeto / Central** | Assistentes IA por projeto e cross-projeto na Central de Trabalho (Cmd/Ctrl+J); ações com confirmação por senha; threads/relatórios expiram em 30d se `salvo=false`. |
| **Cofre** | Ficha de custo versionada com snapshots. |
| **Impersonation** | Admin pode atuar como outro usuário (UI filtra por papel). |
| **White-label** | Toda menção a "Lovable"/"Supabase" deve ser mascarada para o usuário final. |
| **publishable key** | Chave pública nova do Supabase (use `VITE_SUPABASE_PUBLISHABLE_KEY`). Anon key legacy é deprecada. |

---

## 4. Mapa "se o usuário pedir X → vá para Y"

| Pedido | Onde implementar |
|---|---|
| Nova página/rota | `src/pages/<dominio>/Nova.tsx` + registro em `src/App.tsx` |
| Componente do módulo Projetos | `src/components/projetos/` |
| Componente Trade | `src/components/trade/` (tema rosa #E91E78) |
| Hook reutilizável | `src/hooks/useXxx.ts` |
| Validação de form | `src/lib/validations/<entidade>.ts` (Zod `.strict()`) |
| Utilitário puro | `src/lib/utils/` |
| Formatadores (moeda, data, %, etc.) | `src/lib/formatters.ts` |
| Cálculo de custo / BOM / fiscal | `src/lib/fabrica/` |
| Geração PDF / PPTX / Excel | `src/lib/presentation/` ou `src/utils/excelExport.ts` |
| Nova edge function | `supabase/functions/<name>/index.ts` (com `secureHandler` + Zod `.strict()`) |
| Helper compartilhado de edge | `supabase/functions/_shared/` |
| Migration de schema | tool `supabase--migration` (jamais `psql` direto para DDL) |
| Documentação de endpoint REST | `docs/API_<dominio>.md` + entrada no changelog `ApiDocumentation.tsx` |
| Ajuste de permissão de processo | matriz em `src/components/processos/...` (ver Process Permission Matrix) |
| Tema/cor de página | `usePageBgColor` ou variante de token em `index.css`/`tailwind.config.ts` |
| Toast de erro IA | `toast.error(error.userMessage)` (já vem traduzido do `invokeChat`) |
| Download de arquivo | `triggerBlobDownload` + `StoragePreviewDialog` |
| Confirmar ação destrutiva | `PasswordConfirmDialog` (padrão Sofia/Copilot) ou `AlertDialog` |

---

## 5. Padrão de Edge Function (copie exatamente isto)

```ts
import { z } from "https://esm.sh/zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";

const Body = z.object({
  message: z.string().min(1).max(4000),
}).strict();

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 30, rateLimitPrefix: "minha-funcao" },
  async (req, ctx) => {
    const cors = getCorsHeaders(req);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const r = await callAIGateway({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "user", content: parsed.data.message }],
    });
    if (r.kind !== "ok") return aiGatewayErrorResponse(r, cors);
    return new Response(
      JSON.stringify({ reply: r.data.choices[0].message.content }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  },
));
```

---

## 6. Padrão de chamada IA no front

```ts
import { invokeChat } from "@/lib/ai/invokeChat";
import { toast } from "sonner";

const { data, error } = await invokeChat<{ reply: string }>(
  "minha-funcao",
  { message: input },
);
if (error) { toast.error(error.userMessage); return; }
console.log(data?.reply);
```

---

## 7. Padrão de RLS (semi-join, sem função)

```sql
create policy "Membros leem tarefas do projeto"
on public.projeto_tarefas for select
to authenticated
using (
  projeto_id in (
    select projeto_id from public.projeto_membros where user_id = auth.uid()
  )
);
```

Para roles:

```sql
create policy "Admins escrevem tudo"
on public.qualquer_tabela for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));
```

---

## 8. Modelos de IA disponíveis (gateway Lovable)

```text
google/gemini-3-flash-preview        ← default para chats
google/gemini-2.5-pro
google/gemini-3.1-pro-preview
google/gemini-2.5-flash
google/gemini-2.5-flash-lite
google/gemini-2.5-flash-image        ← geração de imagem
google/gemini-3-pro-image-preview
google/gemini-3.1-flash-image-preview
openai/gpt-5
openai/gpt-5.2                       ← reasoning pesado (sem `reasoning` param!)
openai/gpt-5-mini
openai/gpt-5-nano
```

Fallback automático em 429/402 (já implementado em `callAIGateway`):
`pro → flash → flash-lite`, `gpt-5/5.2 → mini → nano`.

---

## 9. Comandos seguros vs proibidos

### Seguros

```bash
bun install
bun run dev          # em IDE local
bun run lint
bunx vitest run
rg "padrão"          # busca rápida
```

### Proibidos no agent Lovable

```bash
bun run build / npm run build / tsc --noEmit   # harness compila sozinho
git add / commit / push / pull / merge / rebase / reset / stash / checkout
psql ... ALTER TABLE ...                       # use migrations
find /                                          # nunca scan global
sleep N                                         # use loop com check
```

### Proibidos sempre

- Editar `src/integrations/supabase/{client,types}.ts`, `.env`, `project_id` em
  `supabase/config.toml`.
- Operar em schemas `auth`, `storage`, `realtime`, `supabase_functions`, `vault`.
- Hardcodar API keys, service role keys, secrets.

---

## 10. Workflow recomendado por tarefa

1. **Leia o pedido até o fim.** Identifique o módulo (Projetos? Trade? Finance?).
2. **Procure padrão similar** com `rg` antes de criar do zero.
3. **Bata na lista de invariantes** (seção 2) para descartar abordagens proibidas.
4. **Implemente** seguindo o mapa da seção 4.
5. **Verifique** apenas o que importa (console, network, preview do componente).
   Não rode build manualmente.
6. **Responda em ≤ 2 linhas** ao usuário, em PT-BR, sem narrar o que fez em
   passado terceira-pessoa.

---

## 11. When in doubt, ask

Use perguntas de múltipla escolha com 2–4 opções concretas (não open-ended).
Modelos prontos:

- "Esta tela faz parte do módulo **Projetos** ou do módulo **Trade**? (afeta
  tema, RLS e localização do componente)"
- "Esta validação deve ser **client-side** (Zod no form), **server-side**
  (Edge Function) ou **ambas**?"
- "O cálculo deve persistir em coluna nova ou ser **derivado** em runtime?"
- "Este endpoint é **autenticado por JWT**, **API key** (parceiro externo) ou
  **público**?"

Se nada disso se aplica e a ambiguidade é técnica de baixo nível, prossiga com
a opção mais conservadora e explique a escolha em uma linha.

---

## 12. Referências internas

Quando estiver editando dentro do repositório (não em IA externa), consulte:

- `AGENTS.md` — versão estendida desta convenção, com layout de pastas.
- `docs/onboarding/` — 14 arquivos modulares cobrindo cada aspecto.
- `mem://index.md` — índice de memórias do projeto (só visível dentro do
  Lovable).
- `docs/SECURITY.md`, `docs/EDGE_FUNCTIONS.md`, `docs/TESTING.md`,
  `docs/DEPLOYMENT.md`.
- `docs/API_*.md` — contratos REST públicos.

**Fim do system prompt.** Comece a tarefa do usuário agora, respeitando
estritamente as 43 invariantes acima.
