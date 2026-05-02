---
title: Stack & Setup
audience: ai-coding-agent
last_updated: 2026-05-02
---

# 01 — Stack & Setup

## Stack confirmada (do `package.json`)

| Camada | Versão |
|---|---|
| Vite | 5.4 |
| React | 18.3 |
| TypeScript | 5.8 |
| Tailwind | 3.4 + `tailwindcss-animate` + `@tailwindcss/typography` |
| React Router | 6.30 |
| TanStack Query | 5.83 |
| `@supabase/supabase-js` | 2.58 |
| Zod | 3.25 (uso obrigatório de `.strict()`) |
| React Hook Form | 7.61 + `@hookform/resolvers` |
| Recharts | 2.15 |
| date-fns | 3.6 |
| `@dnd-kit/*`, `@hello-pangea/dnd` | — |
| Mapbox GL + `@vis.gl/react-google-maps` | — |
| `jspdf`, `pptxgenjs`, `exceljs`, `pdfjs-dist`, `jszip` | — |
| `@elevenlabs/react` | 0.14 |
| `vite-plugin-pwa` + `workbox-window` | — |
| `vitest` + `@testing-library/*` + `jsdom` | 4 / 16 / 27 |

Package manager: **Bun** (lockfile `bun.lockb`).

## Setup local

```bash
git clone <repo>
cd bimaster
bun install
cp .env.example .env   # preencha placeholders se rodar fora do Lovable
bun run dev            # vite em http://localhost:8080
```

## Variáveis de ambiente

`.env` é **gitignored** e gerenciado pela Lovable Cloud:

- **Dentro do sandbox Lovable**: o arquivo é auto-provisionado e regenerado a
  cada sessão. Não edite manualmente, não commite.
- **Fora do Lovable (Cursor, clone local, CI)**: o `.env` não vem no clone.
  Copie de `.env.example` e preencha com os valores exibidos em
  **Connectors → Lovable Cloud** dentro do editor Lovable (URL +
  publishable key + project id).

```env
VITE_SUPABASE_PROJECT_ID=<your-project-id>
VITE_SUPABASE_URL=<your-project-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
```

> Os valores são **publishable** (desenhados para vir no bundle do browser),
> mas mesmo assim mantemos `.env` fora do VCS por higiene. Se um `.env`
> antigo já estava trackeado, rode **uma vez** fora do agent Lovable:
> `git rm --cached .env && git commit -m "chore: untrack .env"`.

Secrets server-side (Edge Functions, via `Deno.env.get`):

- `LOVABLE_API_KEY` — auto-provisionado.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` — auto.
- Demais (Apify, Phyllo, Asana, Shipsgo, fal.ai, Pluggy, ElevenLabs, ERP Huggs,
  Mapbox server, etc.) → adicionar via tool de secrets do Lovable. Nunca
  hardcodar.

> **publishable key** é a nova chave pública do Supabase. **anon key legacy
> é deprecada** — não use em código novo.

## Comandos úteis

```bash
bun run dev              # vite dev
bun run build            # produção (NÃO no agent Lovable — harness compila)
bun run build:dev        # com sourcemaps
bun run lint             # eslint
bunx vitest run          # toda a suíte
bunx vitest <pattern>    # filtrado
```

## Hospedagem

- **Lovable** (preview e produção principal — `https://<slug>.lovable.app`).
- **Cloudflare Worker** (`cloudflare/worker.js`).
- **Netlify** (`netlify.toml`) e **Vercel** (`vercel.json`) configurados como
  alternativas.

## Sync GitHub

Lovable ↔ GitHub é bidirecional automática. Conecte em **Connectors → GitHub →
Connect project**. Em IDE local, abra branches e PRs normalmente.

> No agent Lovable, **nunca rode `git add/commit/push/pull/merge/rebase/reset`**
> — o harness gerencia o estado.

## Troubleshooting

- **`401` no front após deploy**: verifique se está usando
  `VITE_SUPABASE_PUBLISHABLE_KEY` (não a anon legacy).
- **Edge Function "trava"**: o `supabase.functions.invoke` não tem timeout.
  Use **sempre** o wrapper `invokeChat` (`src/lib/ai/invokeChat.ts`).
- **Datas aparecendo um dia antes**: você está usando `new Date(string)` em
  coluna `DATE`. Troque por `parseLocalDate` (ver gotcha 13.1).
