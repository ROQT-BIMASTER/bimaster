/**
 * Route prefetch registry.
 *
 * Maps a path prefix to the same dynamic import used by `App.tsx`. When the
 * user hovers/focuses a sidebar link, we trigger the import early so the
 * route's JS chunk is already in cache by the time they click.
 *
 * Notes:
 * - Vite/Rollup deduplicates dynamic imports, so calling the same `import()`
 *   twice does not download the chunk twice.
 * - Misses (paths not registered) are a no-op — never throws, never blocks.
 * - We also cache the in-flight promise per path so repeated hovers do not
 *   re-invoke the import.
 */

type Importer = () => Promise<unknown>;

// Order matters: more specific prefixes first.
const ROUTE_IMPORTS: Array<[string, Importer]> = [
  // Projetos (foco competitivo - Asana)
  ["/dashboard/projetos", () => import("@/pages/Projetos")],
  ["/projetos/", () => import("@/pages/ProjetoDetalhe")],

  // Dashboards comerciais (alta frequência)
  ["/dashboard/painel-executivo", () => import("@/pages/PainelExecutivo")],
  ["/dashboard/performance-vendas", () => import("@/pages/PerformanceVendas")],
  ["/dashboard/clientes", () => import("@/pages/AnaliseClientes")],
  ["/dashboard/produtos", () => import("@/pages/AnaliseProdutos")],
  ["/dashboard/geografico", () => import("@/pages/AnaliseGeografico")],
  ["/dashboard/metas", () => import("@/pages/MetasProjecoes")],

  // Trade Marketing
  ["/dashboard/trade", () => import("@/pages/modules/TradeModule")],

  // Marketing / Influencers
  ["/dashboard/marketing/influencers", () => import("@/pages/marketing/InfluencersPage")],
  ["/dashboard/marketing", () => import("@/pages/modules/MarketingModule")],

  // Outros frequentes
  ["/dashboard/atividades", () => import("@/pages/Atividades")],
  ["/dashboard/tarefas", () => import("@/pages/Tarefas")],
  ["/dashboard/kanban", () => import("@/pages/Kanban")],
  ["/dashboard/chat", () => import("@/pages/Chat")],
  ["/dashboard/ranking", () => import("@/pages/Ranking")],
  ["/dashboard/configuracoes", () => import("@/pages/Configuracoes")],
];

const inflight = new Map<string, Promise<unknown>>();

function findImporter(path: string): Importer | null {
  for (const [prefix, importer] of ROUTE_IMPORTS) {
    if (path.startsWith(prefix)) return importer;
  }
  return null;
}

/**
 * Trigger a prefetch for the given route path. Safe to call repeatedly and
 * for unknown paths (no-op). Errors are swallowed so prefetch never breaks UX.
 */
export function prefetchRoute(path: string): void {
  if (!path) return;
  // Strip query/hash for prefix matching
  const cleaned = path.split(/[?#]/)[0];

  if (inflight.has(cleaned)) return;
  const importer = findImporter(cleaned);
  if (!importer) return;

  try {
    const p = importer().catch(() => {
      // Allow retry on next hover after a soft delay
      setTimeout(() => inflight.delete(cleaned), 5000);
    });
    inflight.set(cleaned, p);
  } catch {
    /* noop */
  }
}
