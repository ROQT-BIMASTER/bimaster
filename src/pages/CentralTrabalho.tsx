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
import { CentralHeader } from "@/components/projetos/central/CentralHeader";
import { CentralKPIs } from "@/components/projetos/central/CentralKPIs";
import { HojeTab } from "@/components/projetos/central/HojeTab";
import { MinhasTarefasContent } from "@/components/projetos/central/MinhasTarefasContent";
import { ProjetoInboxContent } from "@/components/projetos/central/ProjetoInboxContent";

type TabKey = "hoje" | "tarefas" | "inbox";

interface Props {
  defaultTab?: TabKey;
}

export default function CentralTrabalho({ defaultTab }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { bgColor, setBgColor } = usePageBgColor("central_trabalho");
  const { naoLidas } = useProjetoAtividades();
  const { preferences, isLoading: prefsLoading, save: savePrefs } = useCentralPreferences();

  const urlTab = searchParams.get("tab") as TabKey | null;
  const validTabs: TabKey[] = ["hoje", "tarefas", "inbox"];
  const fallbackTab: TabKey =
    defaultTab ?? (validTabs.includes(preferences.default_tab as TabKey) ? (preferences.default_tab as TabKey) : "hoje");
  const activeTab: TabKey = urlTab && validTabs.includes(urlTab) ? urlTab : fallbackTab;
  const tarefasFilter = searchParams.get("filter");

  // Make sure URL reflects active tab on mount (after prefs load)
  useEffect(() => {
    if (!urlTab && !prefsLoading) {
      const params = new URLSearchParams(searchParams);
      params.set("tab", fallbackTab);
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsLoading]);

  const setTab = (tab: TabKey, filter?: string) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (filter) params.set("filter", filter);
    // Preserve view-specific params when navigating to/within "tarefas"
    if (tab === "tarefas") {
      ["view", "q", "priority", "project"].forEach((k) => {
        const v = searchParams.get(k);
        if (v) params.set(k, v);
      });
    }
    setSearchParams(params);
    // Persist preferred tab
    if (tab !== preferences.default_tab) {
      savePrefs({ default_tab: tab });
    }
  };

  const initialTarefasFilter = useMemo(() => {
    if (activeTab !== "tarefas") return null;
    if (tarefasFilter === "atrasadas" || tarefasFilter === "hoje") return tarefasFilter;
    return null;
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
