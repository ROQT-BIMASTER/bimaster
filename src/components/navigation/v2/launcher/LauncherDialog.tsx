/**
 * LauncherDialog — modal premium da navegação v2.
 *
 * Layout (referência do mockup):
 *   ┌──────────────────────────────────────────────────┐
 *   │ 🔍 Para onde você quer ir?         ⌘K  ESC       │
 *   ├──────────┬───────────────────────────────────────┤
 *   │ Acesso   │ RECENTES                  últimas 24h │
 *   │ rápido   │ [tile][tile][tile][tile]              │
 *   │          │                                       │
 *   │ Recentes │ Categoria                  N · M pág. │
 *   │          │ [card][card][card]                    │
 *   └──────────┴───────────────────────────────────────┘
 *
 * - Sempre dark (tokens --launcher-*), independente do tema do app.
 * - Sem dependência de cmdk: layout custom com filtro próprio.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { LauncherHeader } from "./LauncherHeader";
import { LauncherSidebar } from "./LauncherSidebar";
import { RecentTile } from "./RecentTile";
import { CategoryBlock } from "./CategoryBlock";
import { ModuleCard } from "./ModuleCard";
import { ModulePagesView } from "./ModulePagesView";
import { useRecents } from "./useRecents";
import { useLauncherTheme } from "../useLauncherTheme";
import {
  findActiveModule,
  useNavV2Data,
  type NavV2Category,
  type NavV2Module,
} from "../useNavV2Data";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  operacao: "Produção, estoque e cadeia de suprimentos",
  comercial: "Vendas, trade e relacionamento com clientes",
  marketing: "Conteúdo, influência e branding",
  financeiro: "Contas, conciliação e contabilidade",
  projetos: "Projetos, tarefas e fluxos cross-time",
  admin: "Configurações, usuários e governança",
};

function filterTree(tree: NavV2Category[], q: string): NavV2Category[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return tree;
  return tree
    .map((cat) => {
      const modules = cat.modules.filter((m) => {
        if (m.label.toLowerCase().includes(needle)) return true;
        return m.pages.some(
          (p) =>
            p.label.toLowerCase().includes(needle) ||
            p.route.toLowerCase().includes(needle),
        );
      });
      return { ...cat, modules };
    })
    .filter((c) => c.modules.length > 0);
}

export function LauncherDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { categories } = useNavV2Data();
  const { entries } = useRecents();
  const { theme } = useLauncherTheme();
  const [query, setQuery] = useState("");
  const [drilledCode, setDrilledCode] = useState<string | null>(null);

  // Reset drill-in / busca quando o dialog fecha
  useEffect(() => {
    if (!open) {
      setDrilledCode(null);
      setQuery("");
    }
  }, [open]);

  const filtered = useMemo(() => filterTree(categories, query), [categories, query]);
  const active = findActiveModule(categories, location.pathname);

  // Mantém o módulo em drill-in referenciando a árvore viva (perms podem mudar)
  const drilledModule = useMemo<NavV2Module | null>(() => {
    if (!drilledCode) return null;
    for (const cat of categories) {
      const found = cat.modules.find((m) => m.code === drilledCode);
      if (found) return found;
    }
    return null;
  }, [categories, drilledCode]);

  const go = (route: string) => {
    onOpenChange(false);
    setQuery("");
    setDrilledCode(null);
    navigate(route);
  };

  const selectModule = (mod: NavV2Module, opts?: { openFirst?: boolean }) => {
    if (mod.pages.length === 0) return;
    if (opts?.openFirst || mod.pages.length === 1) {
      go(mod.pages[0].route);
      return;
    }
    setQuery("");
    setDrilledCode(mod.code);
  };

  const backToGrid = () => {
    setDrilledCode(null);
    setQuery("");
  };

  const hasQuery = query.trim().length > 0;
  const allFlatModules = useMemo(
    () => filtered.flatMap((c) => c.modules),
    [filtered],
  );

  const drilledFilteredPages = useMemo(() => {
    if (!drilledModule) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return drilledModule.pages;
    return drilledModule.pages.filter(
      (p) =>
        p.label.toLowerCase().includes(needle) ||
        p.route.toLowerCase().includes(needle),
    );
  }, [drilledModule, query]);

  const handleEscape = () => {
    if (drilledModule) {
      backToGrid();
    } else {
      onOpenChange(false);
    }
  };

  const handleEnter = () => {
    if (drilledModule && drilledFilteredPages[0]) {
      go(drilledFilteredPages[0].route);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-launcher-theme={theme}
        className="p-0 overflow-hidden border-0 max-w-[960px] w-[min(960px,95vw)] gap-0"
        style={{
          background: "hsl(var(--launcher-surface))",
          color: "hsl(var(--launcher-foreground))",
          borderRadius: "18px",
          boxShadow:
            theme === "light"
              ? "0 30px 90px -20px hsl(220 40% 20% / 0.25), inset 0 0 0 1px hsl(var(--launcher-border))"
              : "0 30px 90px -20px hsl(0 0% 0% / 0.6), inset 0 0 0 1px hsl(var(--launcher-border))",
        }}
      >
        <LauncherHeader
          value={query}
          onChange={setQuery}
          onEscape={() => onOpenChange(false)}
        />

        <div className="flex" style={{ height: "min(640px, 75vh)" }}>
          <LauncherSidebar
            recentsCount={entries.length}
            active="recents"
            onSelect={() => undefined}
          />

          <div className="flex-1 overflow-y-auto p-5 space-y-7">
            {hasQuery ? (
              allFlatModules.length === 0 ? (
                <EmptyState query={query} />
              ) : (
                <section className="space-y-3">
                  <header className="flex items-end justify-between">
                    <h2
                      className="text-[14px] font-semibold uppercase tracking-wider"
                      style={{ color: "hsl(var(--launcher-muted))" }}
                    >
                      Resultados
                    </h2>
                    <span
                      className="text-[11px]"
                      style={{ color: "hsl(var(--launcher-muted))" }}
                    >
                      {allFlatModules.length}{" "}
                      {allFlatModules.length === 1 ? "módulo" : "módulos"}
                    </span>
                  </header>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {allFlatModules.map((mod) => (
                      <ModuleCard
                        key={mod.code}
                        module={mod}
                        isCurrent={active?.module.code === mod.code}
                        onSelect={selectModule}
                      />
                    ))}
                  </div>
                </section>
              )
            ) : (
              <>
                {entries.length > 0 && (
                  <section className="space-y-3">
                    <header className="flex items-end justify-between">
                      <h2
                        className="text-[12px] font-semibold uppercase tracking-[0.14em]"
                        style={{ color: "hsl(var(--launcher-muted))" }}
                      >
                        Recentes
                      </h2>
                      <span
                        className="text-[11px]"
                        style={{ color: "hsl(var(--launcher-muted))" }}
                      >
                        últimas 24h
                      </span>
                    </header>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {entries.slice(0, 4).map((e) => (
                        <RecentTile
                          key={e.route}
                          entry={e}
                          isCurrent={location.pathname.startsWith(e.route)}
                          onSelect={go}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {filtered.map((cat) => (
                  <CategoryBlock
                    key={cat.key}
                    category={cat}
                    description={CATEGORY_DESCRIPTIONS[cat.key.toLowerCase()]}
                    activeModuleCode={active?.module.code ?? null}
                    onSelectModule={selectModule}
                  />
                ))}

                {filtered.length === 0 && entries.length === 0 && (
                  <EmptyState />
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ query }: { query?: string } = {}) {
  return (
    <div
      className="h-full flex flex-col items-center justify-center text-center py-16"
      style={{ color: "hsl(var(--launcher-muted))" }}
    >
      <div className="text-sm">
        {query ? (
          <>
            Nada encontrado para <strong>"{query}"</strong>.
          </>
        ) : (
          "Nenhum módulo disponível."
        )}
      </div>
    </div>
  );
}
