---
title: Arquitetura
audience: ai-coding-agent
last_updated: 2026-05-02
---

# 02 — Arquitetura

## Camadas

```text
┌─────────────────────────────────────────────────────┐
│  React (src/)                                       │
│   - pages/        rotas                              │
│   - components/   UI por domínio + ui/ (shadcn)      │
│   - hooks/        lógica reutilizável                │
│   - lib/          utils puros, validações, IA, etc.  │
│   - contexts/     EmpresaContext, InboxDrawerContext │
│   - integrations/supabase/  ←  AUTO-GERADO           │
└─────────────────────────────────────────────────────┘
            │ HTTPS / SSE
            ▼
┌─────────────────────────────────────────────────────┐
│  Lovable Cloud (Supabase gerenciado)                │
│   - Postgres + RLS                                   │
│   - Auth (email + Google)                            │
│   - Storage (buckets com UID-paths)                  │
│   - Realtime                                         │
│   - Edge Functions (Deno)  ←  secureHandler          │
└─────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────┐
│  Lovable AI Gateway                                  │
│   - google/gemini-* + openai/gpt-5.x                 │
│   - 1 chave: LOVABLE_API_KEY (auto)                  │
└─────────────────────────────────────────────────────┘
```

## Fluxo de dados padrão

1. **UI** dispara mutação ou query.
2. **TanStack Query** (`useQuery`/`useMutation`) gerencia cache, loading, retries.
3. Request vai para **Supabase JS SDK** (RLS aplicada server-side) ou
   **`supabase.functions.invoke`** via wrapper `invokeChat`.
4. **Edge Function** envolvida em `secureHandler`: WAF → IP blocklist → auth
   (JWT/API-key) → quarentena → MFA → step-up → rate-limit → handler →
   security headers.
5. Para IA: `callAIGateway` no edge faz fallback automático em 429/402 e
   tradução de timeout.
6. Resposta volta para UI; toast de erro vem com `error.userMessage` já em PT-BR.

## Roteamento

- Definido em `src/App.tsx` (uma única árvore de rotas).
- Layouts compartilhados via componentes (sidebar, breadcrumb).
- Páginas em `src/pages/<dominio>/<Nome>.tsx`. Quando o domínio cresce, criar
  subpasta (ex.: `pages/financeiro/`).
- Rotas privadas usam `ProtectedRoute` (verifica sessão); rotas admin usam
  guard adicional baseado em `has_role`.

## Estado global

- **TanStack Query** → estado servidor (cache, refetch, invalidation).
- **Context** → poucos: `EmpresaContext`, `InboxDrawerContext`.
- **`localStorage`** → preferências de UI (densidade, cor de fundo de página).
  **Nunca** para checagem de autorização.

## Cache & invalidation

- Configuração base em `src/lib/queryClient.ts`.
- Após mutação, invalide a query-key correspondente, não toda a árvore.
- Para listas grandes, use `useInfiniteQuery` ou
  `src/components/common/InfiniteScrollList.tsx` /
  `VirtualizedTable.tsx`.

## Performance

- `react-window` / `@tanstack/react-virtual` para listas > 200 itens.
- `routePrefetch` (`src/lib/routePrefetch.ts`) pré-carrega rotas vizinhas.
- Memo / `useMemo` apenas quando profiling indicar (não preventivo).
- Evite re-render em massa: separar contextos pequenos.

## PWA

- `vite-plugin-pwa` + `workbox-window`.
- Sw em `dev-dist/sw.js` (gerado).
- Componentes: `OfflineIndicator`, `PWAUpdatePrompt`, `PushNotificationPrompt`,
  `SplashScreen`.

## White-label

Para o usuário final, **toda menção a "Supabase", "Postgres", "Edge Function",
"RLS" deve ser mascarada** como "backend" / "Lovable Cloud". Veja
`mem://architecture/white-label-technology-masking`.
