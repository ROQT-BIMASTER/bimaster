import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, ListChecks, Bell, Home } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "react-router-dom";
import { usePageBgColor } from "@/hooks/usePageBgColor";
import { useProjetoAtividades } from "@/hooks/useProjetoAtividades";
import { useCentralPreferences } from "@/hooks/useCentralPreferences";
import {
  normalizeTab,
  normalizeFilter,
  normalizeView,
  normalizePriority,
  normalizeProject,
  normalizeSearch,
  sanitizeCentralSearchParams,
  type CentralTab,
} from "@/lib/centralUrlParams";
import { CentralHeader } from "@/components/projetos/central/CentralHeader";
import { CentralKPIs } from "@/components/projetos/central/CentralKPIs";
import { HojeTab } from "@/components/projetos/central/HojeTab";
import { MinhasTarefasContent } from "@/components/projetos/central/MinhasTarefasContent";
import { ProjetoInboxContent } from "@/components/projetos/central/ProjetoInboxContent";

type TabKey = CentralTab;

interface Props {
  defaultTab?: TabKey;
}

/** Stable, key-sorted serialization used to compare two URLSearchParams. */
function sortedQs(p: URLSearchParams): string {
  const entries: Array<[string, string]> = [];
  p.forEach((v, k) => entries.push([k, v]));
  entries.sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([k, v]) => `${k}=${v}`).join("&");
}

export default function CentralTrabalho({ defaultTab }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { bgColor, setBgColor } = usePageBgColor("central_trabalho");
  const { naoLidas } = useProjetoAtividades();
  const {
    preferences,
    isLoading: prefsLoading,
    save: savePrefs,
    reset: resetPrefs,
    isResetting,
  } = useCentralPreferences();

  const rawTab = searchParams.get("tab");
  const fallbackTab: TabKey =
    defaultTab ?? normalizeTab(preferences.default_tab, "hoje");
  const activeTab: TabKey = normalizeTab(rawTab, fallbackTab);
  const tarefasFilter = normalizeFilter(searchParams.get("filter"));

  // Track keys we've already warned about so we don't spam toasts on re-renders.
  const warnedKeysRef = useRef<Set<string>>(new Set());

  // Friendly labels used in the "URL corrigida" notification.
  const PARAM_LABELS: Record<string, string> = {
    tab: "aba",
    filter: "filtro",
    view: "visualização",
    priority: "prioridade",
    project: "projeto",
    q: "busca",
    subtab: "sub-aba",
    group: "agrupamento",
    tipos: "tipos",
    projetos: "projetos",
  };

  // Normalize URL params on mount / when they change. Uses the single sanitizer
  // in centralUrlParams so dedup + encoding cleanup happens in one place.
  useEffect(() => {
    if (prefsLoading) return;
    // Skip URL sanitization while a reset is in flight: the reset handler will
    // wipe the query string itself once the mutation resolves. Touching the URL
    // here would race with the reset and could re-emit stale params.
    if (isResetting) return;

    // Detect duplicated keys BEFORE we lose the raw repr (URLSearchParams.get
    // would silently keep only the first value).
    const seenKeys = new Set<string>();
    const duplicatedKeys = new Set<string>();
    searchParams.forEach((_v, k) => {
      if (seenKeys.has(k)) duplicatedKeys.add(k);
      else seenKeys.add(k);
    });

    const sanitized = sanitizeCentralSearchParams(searchParams);

    // Compare sorted query strings so key ordering doesn't trigger a rewrite.
    const before = sortedQs(searchParams);
    const after = sortedQs(sanitized);
    if (before === after && duplicatedKeys.size === 0) return;

    // Figure out which keys actually changed value (not just got reordered) so
    // the toast only mentions things the user can perceive as "wrong".
    const correctedKeys = new Set<string>(duplicatedKeys);
    const allKeys = new Set<string>([
      ...Array.from(seenKeys),
      ...Array.from({ length: 0 }, () => ""),
    ]);
    sanitized.forEach((_v, k) => allKeys.add(k));
    allKeys.forEach((k) => {
      const rawValues = searchParams.getAll(k);
      const newValue = sanitized.get(k);
      // Coerce "no value" both ways for comparison.
      const rawCanonical = rawValues.length === 0 ? null : rawValues[0];
      if (rawCanonical !== (newValue ?? null)) correctedKeys.add(k);
    });

    setSearchParams(sanitized, { replace: true });

    const newKeys = Array.from(correctedKeys).filter((k) => !warnedKeysRef.current.has(k));
    if (newKeys.length > 0) {
      newKeys.forEach((k) => warnedKeysRef.current.add(k));
      const labels = Array.from(new Set(newKeys.map((k) => PARAM_LABELS[k] ?? k)));
      toast.info("Link ajustado automaticamente", {
        description: `Os parâmetros inválidos (${labels.join(", ")}) foram removidos e voltamos ao padrão.`,
        duration: 5000,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsLoading, searchParams]);

  const setTab = (tab: TabKey, filter?: string) => {
    const safeTab = normalizeTab(tab, fallbackTab);
    const params = new URLSearchParams();
    params.set("tab", safeTab);
    const safeFilter = normalizeFilter(filter ?? null, "all");
    if (safeFilter !== "all") params.set("filter", safeFilter);
    // Preserve (and re-normalize) view-specific params when navigating to "tarefas".
    if (safeTab === "tarefas") {
      const v = normalizeView(searchParams.get("view"), "list");
      const p = normalizePriority(searchParams.get("priority"), "all");
      const pr = normalizeProject(searchParams.get("project"), "all");
      const q = normalizeSearch(searchParams.get("q"));
      if (v !== "list") params.set("view", v);
      if (p !== "all") params.set("priority", p);
      if (pr !== "all") params.set("project", pr);
      if (q) params.set("q", q);
    }
    setSearchParams(params);
    if (safeTab !== preferences.default_tab) {
      savePrefs({ default_tab: safeTab });
    }
  };

  const initialTarefasFilter = useMemo(() => {
    if (activeTab !== "tarefas") return null;
    return tarefasFilter === "atrasadas" || tarefasFilter === "hoje" ? tarefasFilter : null;
  }, [activeTab, tarefasFilter]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto" style={bgColor ? { backgroundColor: bgColor } : undefined}>
          <div className="p-6 max-w-6xl mx-auto space-y-5">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard" className="flex items-center gap-1">
                      <Home className="h-3.5 w-3.5" />
                      Dashboard
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard/projetos">Projetos</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard/projetos/central">Central de Trabalho</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="capitalize">
                    {activeTab === "hoje" && "Hoje"}
                    {activeTab === "tarefas" && (
                      <>
                        Tarefas
                        {tarefasFilter === "atrasadas" && " · Atrasadas"}
                        {tarefasFilter === "hoje" && " · Hoje"}
                      </>
                    )}
                    {activeTab === "inbox" && "Notificações"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <CentralHeader
              bgColor={bgColor}
              onBgColorChange={setBgColor}
              preferences={preferences}
              onResetPreferences={async () => {
                try {
                  await resetPrefs();
                  // Wipe URL params so the system defaults take effect immediately.
                  setSearchParams(new URLSearchParams(), { replace: true });
                  toast.success("Preferências restauradas para o padrão do sistema");
                } catch {
                  toast.error("Não foi possível restaurar as preferências");
                }
              }}
              isResetting={isResetting}
            />

            <CentralKPIs onNavigate={isResetting ? () => {} : setTab} />

            <Tabs
              value={activeTab}
              onValueChange={(v) => {
                if (isResetting) return;
                setTab(v as TabKey);
              }}
            >
              <TabsList className="bg-muted/30">
                <TabsTrigger value="hoje" className="gap-1.5" disabled={isResetting}>
                  <CalendarDays className="h-3.5 w-3.5" />
                  Hoje
                </TabsTrigger>
                <TabsTrigger value="tarefas" className="gap-1.5" disabled={isResetting}>
                  <ListChecks className="h-3.5 w-3.5" />
                  Tarefas
                </TabsTrigger>
                <TabsTrigger value="inbox" className="gap-1.5" disabled={isResetting}>
                  <Bell className="h-3.5 w-3.5" />
                  Notificações
                  {naoLidas > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">{naoLidas}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* While restoring preferences, freeze every interactive surface
                  inside the tabs to prevent races between user input and the
                  pending reset mutation. */}
              <div
                className={
                  isResetting
                    ? "pointer-events-none opacity-60 transition-opacity"
                    : "transition-opacity"
                }
                aria-busy={isResetting || undefined}
              >
                {isResetting && (
                  <div
                    role="status"
                    className="mt-3 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
                  >
                    Restaurando preferências… ações da Central temporariamente bloqueadas.
                  </div>
                )}

                <TabsContent value="hoje" className="mt-5">
                  <HojeTab onGoToTarefas={() => !isResetting && setTab("tarefas")} />
                </TabsContent>

                <TabsContent value="tarefas" className="mt-5">
                  <MinhasTarefasContent
                    key={initialTarefasFilter || "default"}
                    initialFilter={initialTarefasFilter}
                  />
                </TabsContent>

                <TabsContent value="inbox" className="mt-5">
                  <ProjetoInboxContent />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
