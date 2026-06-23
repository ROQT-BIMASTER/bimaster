# ARCHITECTURE_REVIEW — Auditoria 2026-Q2

> Revisão dos documentos arquiteturais existentes contra o estado atual do repositório.
> Esta nota é descritiva: lista as divergências encontradas e recomenda atualizações
> pontuais — **não substitui** `docs/ARCHITECTURE.md` ou `docs/ARCHITECTURE_DIAGRAMS.md`.

---

## 1. Documentos avaliados

| Documento | LoC | Status |
| --- | ---: | --- |
| `docs/ARCHITECTURE.md` | 218 | ✅ fiel à stack atual |
| `docs/ARCHITECTURE_DIAGRAMS.md` | 501 | 🟡 diagramas válidos; alguns contadores defasados |
| `docs/MODULES_OVERVIEW.md` | 291 | 🟡 estrutura fiel; contadores precisam refresh |
| `docs/onboarding/02-ARCHITECTURE.md` | n/a | ✅ canônico |

Conclusão: **não é necessário reescrever** os documentos arquiteturais. As correções
recomendadas abaixo são pontuais.

---

## 2. Divergências encontradas

### 2.1 Contagens defasadas em `MODULES_OVERVIEW.md`

- Páginas declaradas no documento divergem do filesystem em alguns módulos
  (ex.: Trade Marketing "40+" vs ~50 páginas hoje; Financeiro "20+" vs ~30+).
- O guard `ClienteProtectedRoute` está mencionado mas não detalha que opera
  fora da árvore de `EmpresaProvider`.

**Ação recomendada:** atualizar a tabela do §2 do documento com base no script
de inventário a ser entregue no PR-4 (`scripts/audit/list-modules.ts`).

### 2.2 Providers no `App.tsx` vs documentado

O documento (`MODULES_OVERVIEW.md` §1) lista a árvore de providers em ordem,
mas omite `ConfirmDialogProvider`, `InboxDrawerProvider`, `ChatDrawerProvider`.
A ordem atual real em `src/App.tsx`:

```
QueryClientProvider
└─ PWAProvider
   └─ LanguageProvider
      └─ AuthProvider
         └─ ThemeProvider
            └─ PermissionsProvider
               └─ ImpersonationProvider
                  └─ EmpresaProvider
                     └─ MeetingRecordingProvider
                        └─ InboxDrawerProvider
                           └─ ChatDrawerProvider
                              └─ ConfirmDialogProvider
                                 └─ TourProvider
                                    └─ TooltipProvider + Toasters
                                       └─ BrowserRouter
```

**Ação recomendada:** atualizar o diagrama do §1 quando o PR-4 emitir o snapshot
automatizado.

### 2.3 RLS — referência a "1252 rules"

O número está congelado em março/2026. Migrations adicionadas posteriormente
alteram o total. Recomenda-se converter o número em macro emitida pelo
script `scripts/audit/db-stats.ts` (PR-4).

### 2.4 Falta menção a `_shared` em Edge Functions

`ARCHITECTURE.md` lista o padrão de Edge Function mas não enumera os helpers
canônicos em `supabase/functions/_shared/`:

- `secure-handler.ts` (auth + WAF + rate-limit + headers)
- `ai-gateway-call.ts` (fallback 429 + tradução de erros)
- `cors.ts`, `waf.ts`, `quarantine.ts`
- `copilot/*`, `rag/*` (fase 2 do Copilot)

**Ação recomendada:** acrescentar subseção "Shared library" em `ARCHITECTURE.md`
no PR-3 (junto à reescrita de `EDGE_FUNCTIONS.md`).

### 2.5 Internacionalização do worker Cloudflare não documentada

`ARCHITECTURE.md` não menciona `cloudflare/worker.js` nem o roteamento via
`china.bimaster.online`. Isso é coberto por `mem://infra/china-network-resilience`
mas deve ser referenciado a partir de `INFRASTRUCTURE.md` (PR-3).

---

## 3. Pontos onde os documentos estão corretos

- Stack tecnológica (Vite/React/TS/Tailwind/shadcn) — fiel.
- Padrões de design tokens HSL — fiel.
- Política "nunca editar `client.ts` / `types.ts`" — fiel.
- Política de PWA, versionamento e cache (`mem://pwa/anti-cache-versioning`) — fiel.
- Política de uso de IA (`gemini-3-flash` em chat, `gpt-5.2` em reasoning) — fiel.

---

## 4. Itens a executar em PRs futuros

| Item | PR |
| --- | --- |
| Atualizar contagens de páginas/rotas por módulo | PR-3 (com o script de inventário) |
| Acrescentar seção "Shared library" em `ARCHITECTURE.md` | PR-3 |
| Documentar `cloudflare/worker.js` em `INFRASTRUCTURE.md` | PR-3 |
| Substituir números congelados por macros geradas | PR-4 (`docs-drift.yml`) |
| Decomposição de god-files | PR fora do ciclo de auditoria |

---

## 5. Diagramas presentes em `ARCHITECTURE_DIAGRAMS.md`

Inventário (501 LoC totais): diagramas de árvore de providers, fluxo de
autenticação, ciclo de vida de uma tarefa em Projetos, pipeline de Edge Functions,
fluxo de Copilot v2, hierarquia de supervisão. Todos permanecem **válidos**;
apenas contadores precisam refresh (ver §2).
