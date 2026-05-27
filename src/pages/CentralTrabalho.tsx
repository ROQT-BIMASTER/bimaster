import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, ListChecks, Bell, Home, Send } from "lucide-react";
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
import { getBgPaletteVars } from "@/lib/colorUtils";
import { useProjetoAtividades } from "@/hooks/useProjetoAtividades";
import { useMinhasTarefas } from "@/hooks/useMinhasTarefas";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { isToday, isBefore, startOfDay } from "date-fns";
import { useCentralPreferences } from "@/hooks/useCentralPreferences";
import { ProjetoOnboardingCard } from "@/components/projetos/ProjetoOnboardingCard";
import { ProjetoShortcutsDialog } from "@/components/projetos/ProjetoShortcutsDialog";
import { useTour, projetoHomeTourSteps, PROJETO_HOME_TOUR_ID } from "@/components/tour";
import {
  normalizeTab,
  normalizeFilter,
  normalizeView,
  normalizePriority,
  normalizeProject,
  normalizeSearch,
  normalizeSort,
  sanitizeCentralSearchParams,
  type CentralTab,
} from "@/lib/centralUrlParams";
import { CentralHeader } from "@/components/projetos/central/CentralHeader";
import { useMinhasDelegadas } from "@/hooks/useMinhasDelegadas";
import { HojeTab } from "@/components/projetos/central/HojeTab";
import { MinhasTarefasContent } from "@/components/projetos/central/MinhasTarefasContent";
import { DelegadasContent } from "@/components/projetos/central/DelegadasContent";
import { ProjetoInboxContent } from "@/components/projetos/central/ProjetoInboxContent";
import { CentralLayout } from "@/components/projetos/central/CentralLayout";
import { useAuth } from "@/contexts/AuthContext";
import { buildReason, rememberReason } from "@/lib/centralSaveReason";

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
  const { user } = useAuth();
  const { bgColor, setBgColor } = usePageBgColor("central_trabalho");
  const { naoLidas } = useProjetoAtividades();
  const { startTour } = useTour();
  const {
    preferences,
    isLoading: prefsLoading,
    save: savePrefs,
    reset: resetPrefs,
    isResetting,
    resetFiltersOnly: resetFiltersOnlyPrefs,
    saveNow: saveNowPrefs,
    isSavingNow,
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
  }, [prefsLoading, isResetting, searchParams]);

  const setTab = (tab: TabKey, filter?: string, extras?: { sort?: string }) => {
    // Hard guard: ignore tab/filter changes while a reset mutation is pending.
    if (isResetting) return;
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
      // `extras.sort` overrides the URL value, otherwise we preserve whatever
      // the user already had (e.g. when switching tabs back-and-forth).
      const s = normalizeSort(extras?.sort ?? searchParams.get("sort"), "default");
      if (v !== "list") params.set("view", v);
      if (p !== "all") params.set("priority", p);
      if (pr !== "all") params.set("project", pr);
      if (q) params.set("q", q);
      if (s !== "default") params.set("sort", s);
    }
    setSearchParams(params);
    if (safeTab !== preferences.default_tab) {
      // Tag the cause so the audit indicator surfaces it once the save lands.
      rememberReason(user?.id, buildReason("tab_change"));
      savePrefs({ default_tab: safeTab });
    }
  };

  const initialTarefasFilter = useMemo(() => {
    if (activeTab !== "tarefas") return null;
    return tarefasFilter === "atrasadas" || tarefasFilter === "hoje" || tarefasFilter === "sem_data"
      ? tarefasFilter
      : null;
  }, [activeTab, tarefasFilter]);

  // Lightweight tab counters (reuses the same cached query as KPIs and HojeTab).
  const { data: tarefas = [] } = useMinhasTarefas();
  const tabCounts = useMemo(() => {
    const now = startOfDay(new Date());
    const pendentes = tarefas.filter((t) => t.status !== "concluida");
    const hojeC = pendentes.filter((t) => {
      const p = parseLocalDate(t.data_prazo);
      return p && (isToday(p) || isBefore(startOfDay(p), now));
    });
    return { hoje: hojeC.length, pendentes: pendentes.length };
  }, [tarefas]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main
          className="flex-1 overflow-auto"
          style={
            bgColor
              ? ({ backgroundColor: bgColor, color: "hsl(var(--foreground))", ...getBgPaletteVars(bgColor) } as React.CSSProperties)
              : undefined
          }
        >
          <div className="p-4 sm:p-6 w-full space-y-4">
            <Breadcrumb className="hidden lg:flex min-h-[24px] items-center overflow-x-auto [&::-webkit-scrollbar]:hidden">
              <BreadcrumbList className="flex-nowrap">
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
                  <BreadcrumbPage>Central de Trabalho</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>


            <CentralHeader
              bgColor={bgColor}
              onBgColorChange={setBgColor}
              preferences={preferences}
              onResetPreferences={async () => {
                try {
                  // Tag cause BEFORE the mutation so the indicator picks it up
                  // as soon as the new updated_at lands.
                  rememberReason(user?.id, buildReason("reset_full"));
                  await resetPrefs();
                  // Wipe URL params so the system defaults take effect immediately.
                  setSearchParams(new URLSearchParams(), { replace: true });
                  toast.success("Preferências restauradas para o padrão do sistema");
                } catch {
                  toast.error("Não foi possível restaurar as preferências");
                }
              }}
              onResetFiltersOnly={async () => {
                // Partial reset: keep the user's preferred tab + view but clear
                // every active filter/search both in the URL and in saved prefs.
                try {
                  // 1. URL: keep tab/view if not at default; drop filter/priority/project/q/subtab/group/tipos/projetos.
                  const next = new URLSearchParams();
                  const keepTab = searchParams.get("tab");
                  const keepView = searchParams.get("view");
                  if (keepTab) next.set("tab", keepTab);
                  if (keepView && activeTab === "tarefas") next.set("view", keepView);
                  setSearchParams(next, { replace: true });

                  // 2. Saved prefs: reset only the filter-related fields and
                  // record an audit trail entry (handled inside the hook).
                  rememberReason(user?.id, buildReason("reset_filters_only"));
                  await resetFiltersOnlyPrefs();

                  toast.success("Filtros e busca restaurados", {
                    description: "Aba e visualização atuais foram mantidas.",
                  });
                } catch {
                  toast.error("Não foi possível restaurar os filtros");
                }
              }}
              onSaveNow={async () => {
                try {
                  rememberReason(user?.id, buildReason("manual_save"));
                  await saveNowPrefs();
                  toast.success("Preferências salvas", {
                    description: "Data e hora atualizadas agora.",
                  });
                } catch {
                  // Hook already shows an error toast; keep silent here.
                }
              }}
              isSavingNow={isSavingNow}
              isResetting={isResetting}
            />

            <ProjetoOnboardingCard
              onStartTour={() => startTour(PROJETO_HOME_TOUR_ID, projetoHomeTourSteps)}
            />
            <ProjetoShortcutsDialog />

            {/* KPIs only on tabs where they don't duplicate visible content. */}
            {(activeTab === "tarefas" || activeTab === "delegadas") && (
              <CentralKPIs
                activeTab={activeTab}
                onNavigate={isResetting ? () => {} : setTab}
              />
            )}

            <Tabs
              value={activeTab}
              onValueChange={(v) => {
                if (isResetting) return;
                setTab(v as TabKey);
              }}
            >
              <TabsList className="bg-muted/30 h-10">
                <TabsTrigger value="hoje" className="gap-1.5 h-8 px-3" disabled={isResetting}>
                  <CalendarDays className="h-3.5 w-3.5" />
                  Hoje
                  {tabCounts.hoje > 0 && (
                    <span className="text-[10px] text-muted-foreground ml-1">{tabCounts.hoje}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="tarefas" className="gap-1.5 h-8 px-3" disabled={isResetting}>
                  <ListChecks className="h-3.5 w-3.5" />
                  Minhas tarefas
                  {tabCounts.pendentes > 0 && (
                    <span className="text-[10px] text-muted-foreground ml-1">{tabCounts.pendentes}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="delegadas" className="gap-1.5 h-8 px-3" disabled={isResetting}>
                  <Send className="h-3.5 w-3.5" />
                  Delegadas
                </TabsTrigger>
                <TabsTrigger value="inbox" className="gap-1.5 h-8 px-3" disabled={isResetting}>
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

                <TabsContent value="hoje" className="mt-4">
                  <CentralLayout toolbarSlot={null} chipsSlot={null}>
                    <HojeTab
                      onGoToTarefas={(filter) =>
                        !isResetting && setTab("tarefas", filter)
                      }
                    />
                  </CentralLayout>
                </TabsContent>

                <TabsContent value="tarefas" className="mt-4">
                  <CentralLayout toolbarSlot={null} chipsSlot={null}>
                    <MinhasTarefasContent
                      key={initialTarefasFilter || "default"}
                      initialFilter={initialTarefasFilter}
                    />
                  </CentralLayout>
                </TabsContent>

                <TabsContent value="delegadas" className="mt-4">
                  <CentralLayout toolbarSlot={null} chipsSlot={null}>
                    <DelegadasContent />
                  </CentralLayout>
                </TabsContent>

                <TabsContent value="inbox" className="mt-4">
                  <CentralLayout toolbarSlot={null} chipsSlot={null}>
                    <ProjetoInboxContent />
                  </CentralLayout>
                </TabsContent>
              </div>
            </Tabs>

          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
