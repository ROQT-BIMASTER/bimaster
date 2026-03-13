import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  GitPullRequest, Settings, Clock, CheckCircle2, XCircle, ArrowRight,
  Search, Plus, Loader2, RotateCcw, Palette, ArrowLeft, Download
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { DateRangeFilter, filterByDateRange } from "@/components/shared/DateRangeFilter";
import { exportToExcel } from "@/utils/excelExport";
import { useFluxoInstancias, useFluxoConfigs, useIniciarFluxo, type FluxoInstancia } from "@/hooks/useFluxoAprovacaoArtes";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_MAP: Record<string, { label: string; variant: string; icon: any }> = {
  pendente: { label: "Pendente", variant: "secondary", icon: Clock },
  em_andamento: { label: "Em Andamento", variant: "default", icon: ArrowRight },
  aprovado: { label: "Aprovado", variant: "success", icon: CheckCircle2 },
  reprovado: { label: "Reprovado", variant: "destructive", icon: XCircle },
  devolvido: { label: "Devolvido", variant: "warning", icon: RotateCcw },
};

export default function FluxoAprovacaoArtes() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("em_andamento");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const { data: instancias = [], isLoading } = useFluxoInstancias(
    tab === "todos" ? undefined : { status: tab }
  );
  const { data: configs = [] } = useFluxoConfigs();
  const iniciarFluxo = useIniciarFluxo();

  const filteredInstancias = filterByDateRange(
    instancias.filter(i =>
      !search || (i.config?.nome || "").toLowerCase().includes(search.toLowerCase())
    ),
    "updated_at", dateFrom, dateTo
  );

  const handleExportExcel = () => {
    exportToExcel(filteredInstancias.map(i => ({
      Fluxo: i.config?.nome || "Fluxo",
      Status: STATUS_MAP[i.status]?.label || i.status,
      Etapa: i.etapa_atual_ordem + 1,
      Rodada: i.rodada,
      "Atualizado em": i.updated_at ? new Date(i.updated_at).toLocaleDateString("pt-BR") : "",
    })), { filename: "aprovacao_artes", sheetName: "Aprovações", includeTimestamp: true });
  };

  // KPIs
  const allInstancias = useFluxoInstancias();
  const total = allInstancias.data?.length || 0;
  const emAndamento = allInstancias.data?.filter(i => i.status === "em_andamento").length || 0;
  const aprovados = allInstancias.data?.filter(i => i.status === "aprovado").length || 0;
  const devolvidos = allInstancias.data?.filter(i => i.status === "devolvido").length || 0;

  return (
    <DashboardLayout>
    <div className="space-y-6 p-6">
      <ModuleBreadcrumb moduleName="Aprovação de Artes" moduleHref="/dashboard/aprovacao-artes" currentPage="Painel" />
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="p-2 rounded-lg bg-primary/10">
            <Palette className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Fluxo de Aprovação de Artes</h1>
            <p className="text-sm text-muted-foreground">Gerencie aprovações de artes com rastreabilidade completa</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel} disabled={filteredInstancias.length === 0}>
            <Download className="h-4 w-4 mr-2" />Exportar Excel
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/dashboard/aprovacao-artes/configuracao")}
          >
            <Settings className="h-4 w-4 mr-2" />
            Configurar Fluxos
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total", value: total, icon: GitPullRequest, color: "text-primary" },
          { label: "Em Andamento", value: emAndamento, icon: ArrowRight, color: "text-blue-500" },
          { label: "Aprovados", value: aprovados, icon: CheckCircle2, color: "text-green-500" },
          { label: "Devolvidos", value: devolvidos, icon: RotateCcw, color: "text-amber-500" },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <kpi.icon className={`h-8 w-8 ${kpi.color}`} />
              <div>
                <p className="text-2xl font-bold">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + Tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por fluxo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="em_andamento">Em Andamento</TabsTrigger>
          <TabsTrigger value="devolvido">Devolvidos</TabsTrigger>
          <TabsTrigger value="aprovado">Aprovados</TabsTrigger>
          <TabsTrigger value="reprovado">Reprovados</TabsTrigger>
          <TabsTrigger value="todos">Todos</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredInstancias.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <GitPullRequest className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhuma aprovação encontrada</p>
                <p className="text-sm">Inicie um novo fluxo a partir do módulo China ou Projetos</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredInstancias.map(inst => (
                <InstanciaCard
                  key={inst.id}
                  instancia={inst}
                  onClick={() => navigate(`/dashboard/aprovacao-artes/${inst.id}`)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InstanciaCard({ instancia, onClick }: { instancia: FluxoInstancia; onClick: () => void }) {
  const status = STATUS_MAP[instancia.status] || STATUS_MAP.pendente;
  const StatusIcon = status.icon;

  return (
    <Card
      className="cursor-pointer hover:border-primary/30 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <StatusIcon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{instancia.config?.nome || "Fluxo"}</span>
            <Badge variant={status.variant as any} className="text-[10px]">
              {status.label}
            </Badge>
            {instancia.rodada > 1 && (
              <Badge variant="outline" className="text-[10px]">
                Rodada {instancia.rodada}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Etapa {instancia.etapa_atual_ordem + 1} •{" "}
            {formatDistanceToNow(new Date(instancia.updated_at), { addSuffix: true, locale: ptBR })}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}
