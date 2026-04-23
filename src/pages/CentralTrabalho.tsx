import { useEffect, useMemo } from "react";
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

  // Normalize URL params on mount / when they change: drop invalid values automatically.
  useEffect(() => {
    if (prefsLoading) return;
    const params = new URLSearchParams(searchParams);
    let changed = false;

    const enforce = (key: string, raw: string | null, normalized: string, defaultValue: string) => {
      if (raw === null && normalized === defaultValue) return;
      if (raw !== normalized) {
        if (normalized && normalized !== defaultValue) params.set(key, normalized);
        else params.delete(key);
        changed = true;
      }
    };

    enforce("tab", rawTab, activeTab, fallbackTab);
    enforce("filter", searchParams.get("filter"), tarefasFilter, "all");

    // For the "tarefas" tab, also normalize view-specific params.
    if (activeTab === "tarefas") {
      const rawView = searchParams.get("view");
      const rawPriority = searchParams.get("priority");
      const rawProject = searchParams.get("project");
      const rawQ = searchParams.get("q");
      enforce("view", rawView, normalizeView(rawView, "list"), "list");
      enforce("priority", rawPriority, normalizePriority(rawPriority, "all"), "all");
      enforce("project", rawProject, normalizeProject(rawProject, "all"), "all");
      enforce("q", rawQ, normalizeSearch(rawQ), "");
    } else {
      // Strip task-only params when not on the tarefas tab.
      ["view", "priority", "project", "q"].forEach((k) => {
        if (params.has(k)) {
          params.delete(k);
          changed = true;
        }
      });
    }

    if (changed) setSearchParams(params, { replace: true });
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

            <CentralHeader bgColor={bgColor} onBgColorChange={setBgColor} />

            <CentralKPIs onNavigate={setTab} />

            <Tabs value={activeTab} onValueChange={(v) => setTab(v as TabKey)}>
              <TabsList className="bg-muted/30">
                <TabsTrigger value="hoje" className="gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Hoje
                </TabsTrigger>
                <TabsTrigger value="tarefas" className="gap-1.5">
                  <ListChecks className="h-3.5 w-3.5" />
                  Tarefas
                </TabsTrigger>
                <TabsTrigger value="inbox" className="gap-1.5">
                  <Bell className="h-3.5 w-3.5" />
                  Notificações
                  {naoLidas > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">{naoLidas}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="hoje" className="mt-5">
                <HojeTab onGoToTarefas={() => setTab("tarefas")} />
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
            </Tabs>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
