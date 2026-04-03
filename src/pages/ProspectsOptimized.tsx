import { useState, useMemo, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus, Sparkles, Users, TrendingUp, Activity, Target, LayoutGrid, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { NovoProspectDialog } from "@/components/prospects/NovoProspectDialog";
import { ProspectFullModal } from "@/components/kanban/ProspectFullModal";
import { AIInsightsChat } from "@/components/chat/AIInsightsChat";
import { useUserRole } from "@/hooks/useUserRole";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { InfiniteScrollList } from "@/components/common/InfiniteScrollList";
import { debounce } from "@/lib/utils/query-optimizer";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface Prospect {
  id: string;
  nome_empresa: string;
  contato_principal: string | null;
  email: string | null;
  telefone: string | null;
  cnpj: string | null;
  endereco: string | null;
  municipio?: string | null;
  uf?: string | null;
  porte_empresa: string | null;
  status: string;
  categoria: string | null;
  ultimo_contato: string | null;
  proxima_acao: string | null;
  observacoes: string | null;
  municipio_id: string | null;
  vendedor?: {
    nome: string;
  } | null;
}

const statusKeys: Record<string, string> = {
  novo: "status.novo",
  em_contato: "status.em_contato",
  proposta_enviada: "status.proposta_enviada",
  negociacao: "status.negociacao",
  ganho: "status.ganho",
  perdido: "status.perdido",
};

const statusBadgeVariants: Record<string, "default" | "secondary" | "destructive" | "success" | "warning" | "outline" | "ghost"> = {
  novo: "default",
  em_contato: "warning",
  proposta_enviada: "secondary",
  negociacao: "outline",
  ganho: "success",
  perdido: "destructive",
};

const pipelineColors: Record<string, string> = {
  novo: "hsl(var(--primary))",
  em_contato: "hsl(var(--warning))",
  proposta_enviada: "hsl(var(--secondary))",
  negociacao: "hsl(var(--accent))",
  ganho: "hsl(var(--success))",
  perdido: "hsl(var(--destructive))",
};

interface KpiStats {
  total: number;
  negociacao: number;
  atividadesHoje: number;
  taxaConversao: number;
}

const ProspectsOptimized = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [kpiStats, setKpiStats] = useState<KpiStats | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [pipelineData, setPipelineData] = useState<{ name: string; value: number; key: string }[]>([]);
  const { toast } = useToast();
  const { isAdmin, isSupervisor } = useUserRole();
  const { t } = useLanguage();

  const debouncedSetSearch = useMemo(
    () => debounce((value: string) => setDebouncedSearch(value), 300),
    []
  );

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    debouncedSetSearch(value);
  };

  const filters = useMemo(() => {
    const f: Record<string, any> = {};
    if (selectedStatus !== "todos") f.status = selectedStatus;
    return f;
  }, [selectedStatus]);

  const {
    data: prospects,
    loading,
    hasMore,
    loadMore,
    refresh,
    totalCount,
  } = usePaginatedQuery<Prospect>({
    table: "prospects",
    select: "*, vendedor:profiles!prospects_vendedor_id_fkey(nome)",
    pageSize: 25,
    filters,
    orderBy: { column: "created_at", ascending: false },
  });

  // Load KPIs
  useEffect(() => {
    const fetchKpis = async () => {
      try {
        const [totalRes, negociacaoRes, atividadesRes, ganhosRes] = await Promise.all([
          supabase.from("prospects").select("*", { count: "exact", head: true }),
          supabase.from("prospects").select("*", { count: "exact", head: true }).eq("status", "negociacao"),
          supabase.from("atividades").select("*", { count: "exact", head: true })
            .gte("data_atividade", new Date().toISOString().split("T")[0]),
          supabase.from("prospects").select("*", { count: "exact", head: true }).eq("status", "ganho"),
        ]);

        const total = totalRes.count || 0;
        const ganhos = ganhosRes.count || 0;

        setKpiStats({
          total,
          negociacao: negociacaoRes.count || 0,
          atividadesHoje: atividadesRes.count || 0,
          taxaConversao: total > 0 ? (ganhos / total) * 100 : 0,
        });
      } catch (e) {
        console.error("KPI fetch error:", e);
      } finally {
        setKpiLoading(false);
      }
    };
    fetchKpis();
  }, []);

  // Load pipeline data
  useEffect(() => {
    const fetchPipeline = async () => {
      const statusOrder = ["novo", "em_contato", "proposta_enviada", "negociacao", "ganho", "perdido"] as const;
      const results = await Promise.all(
        statusOrder.map(s =>
          supabase.from("prospects").select("*", { count: "exact", head: true }).eq("status", s)
        )
      );
      setPipelineData(
        statusOrder.map((s, i) => ({
          name: t(statusKeys[s] || s),
          value: results[i].count || 0,
          key: s,
        }))
      );
    };
    fetchPipeline();
  }, [t]);

  const filteredProspects = useMemo(() => {
    if (!debouncedSearch.trim()) return prospects;
    const search = debouncedSearch.toLowerCase();
    return prospects.filter(
      (p) =>
        p.nome_empresa?.toLowerCase().includes(search) ||
        p.contato_principal?.toLowerCase().includes(search) ||
        p.email?.toLowerCase().includes(search) ||
        p.telefone?.includes(search) ||
        p.cnpj?.includes(search)
    );
  }, [prospects, debouncedSearch]);

  // Mobile card renderer
  const renderProspectCard = useCallback((prospect: Prospect) => (
    <Card
      className="hover:shadow-soft-lg transition-all cursor-pointer border-border"
      onClick={() => setSelectedProspect(prospect)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground truncate">{prospect.nome_empresa}</p>
            {prospect.contato_principal && (
              <p className="text-sm text-muted-foreground truncate">{prospect.contato_principal}</p>
            )}
          </div>
          <Badge variant={statusBadgeVariants[prospect.status] || "secondary"}>
            {t(statusKeys[prospect.status] || prospect.status)}
          </Badge>
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          {prospect.vendedor && <span>{prospect.vendedor.nome}</span>}
          {prospect.ultimo_contato && (
            <span>{format(new Date(prospect.ultimo_contato), "dd/MM/yyyy")}</span>
          )}
        </div>
      </CardContent>
    </Card>
  ), [t]);

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        {/* Header */}
        <PageHeader
          title={t("prospects.title")}
          description={
            totalCount !== null
              ? `${totalCount} ${t("prospects.registered")}`
              : t("loading")
          }
          icon={Users}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setChatOpen(true)}>
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">IA Insights</span>
              </Button>
              <Button variant="outline" size="sm" asChild className="gap-1.5">
                <Link to="/dashboard/kanban">
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden sm:inline">Kanban</span>
                </Link>
              </Button>
              <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">{t("prospects.new")}</span>
              </Button>
            </div>
          }
        />

        {/* KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            title="Total Prospects"
            value={kpiStats?.total ?? 0}
            icon={Users}
            variant="info"
            loading={kpiLoading}
          />
          <KpiCard
            title={t("widget.in_negotiation")}
            value={kpiStats?.negociacao ?? 0}
            icon={TrendingUp}
            variant="warning"
            loading={kpiLoading}
          />
          <KpiCard
            title={t("widget.activities_today")}
            value={kpiStats?.atividadesHoje ?? 0}
            icon={Activity}
            variant="success"
            loading={kpiLoading}
          />
          <KpiCard
            title="Taxa Conversão"
            value={kpiStats ? `${kpiStats.taxaConversao.toFixed(1)}%` : "0%"}
            icon={Target}
            variant="accent"
            loading={kpiLoading}
          />
        </div>

        {/* Pipeline Chart */}
        {pipelineData.length > 0 && (
          <Card className="border-border">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted-foreground mb-3">Pipeline por Status</p>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number) => [value, "Prospects"]}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--popover))",
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {pipelineData.map((entry) => (
                        <Cell key={entry.key} fill={pipelineColors[entry.key] || "hsl(var(--muted))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Inline Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("prospects.search")}
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t("prospects.filter_status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">{t("prospects.all_status")}</SelectItem>
              {Object.entries(statusKeys).map(([value, key]) => (
                <SelectItem key={value} value={value}>{t(key)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(isAdmin || isSupervisor) && (
            <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              {t("prospects.update_list")}
            </Button>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block">
          <Card className="border-border overflow-hidden">
            <div className="overflow-auto max-h-[calc(100vh-520px)]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Último Contato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProspects.map((prospect) => (
                    <TableRow
                      key={prospect.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedProspect(prospect)}
                    >
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{prospect.nome_empresa}</p>
                          {prospect.email && (
                            <p className="text-xs text-muted-foreground truncate">{prospect.email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {prospect.contato_principal || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariants[prospect.status] || "secondary"}>
                          {t(statusKeys[prospect.status] || prospect.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {prospect.vendedor?.nome || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {prospect.ultimo_contato
                          ? format(new Date(prospect.ultimo_contato), "dd/MM/yyyy")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {loading && (
                    <>
                      {[...Array(3)].map((_, i) => (
                        <TableRow key={`skel-${i}`}>
                          {[...Array(5)].map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
            {hasMore && !loading && (
              <div className="border-t p-3 text-center">
                <Button variant="ghost" size="sm" onClick={loadMore}>
                  Carregar mais...
                </Button>
              </div>
            )}
            {!loading && filteredProspects.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                {t("prospects.none_found")}
              </div>
            )}
          </Card>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden">
          <InfiniteScrollList
            items={filteredProspects}
            renderItem={renderProspectCard}
            onLoadMore={loadMore}
            loading={loading}
            hasMore={hasMore}
            emptyMessage={t("prospects.none_found")}
            loadingMessage={t("prospects.loading_list")}
          />
        </div>

        <NovoProspectDialog onSuccess={refresh} />

        <ProspectFullModal
          prospect={selectedProspect}
          open={!!selectedProspect}
          onOpenChange={(open) => !open && setSelectedProspect(null)}
          onUpdate={refresh}
        />

        <AIInsightsChat open={chatOpen} onOpenChange={setChatOpen} />
      </div>
    </DashboardLayout>
  );
};

export default ProspectsOptimized;
