import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Calendar, Plus, Rocket, Clock, CheckCircle, AlertTriangle, List, CalendarDays, Kanban,
  TrendingUp, ChevronLeft, ChevronRight
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import NovoLancamentoDialog from "@/components/fabrica/NovoLancamentoDialog";
import LancamentoDetailDialog from "@/components/fabrica/LancamentoDetailDialog";
import LaunchCard from "@/components/fabrica/LaunchCard";
import CountdownBadge from "@/components/fabrica/CountdownBadge";
import ProductThumbnail from "@/components/fabrica/ProductThumbnail";
import { cn } from "@/lib/utils";

type Lancamento = {
  id: string;
  nome_lancamento: string;
  descricao: string | null;
  data_prevista: string;
  data_efetiva: string | null;
  status: string;
  tipo: string;
  prioridade: string;
  produto_id: string | null;
  tabela_preco_id: string | null;
  responsavel_id: string | null;
  observacoes: string | null;
  fabrica_produtos?: { nome: string; codigo: string; foto_url?: string | null } | null;
  profiles?: { nome: string } | null;
};

const statusConfig: Record<string, { label: string; color: string; bgColor: string; gradient: string }> = {
  planejado: { 
    label: "Planejado", 
    color: "text-blue-700 dark:text-blue-300", 
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    gradient: "from-blue-500 to-blue-600"
  },
  em_preparacao: { 
    label: "Em Preparação", 
    color: "text-amber-700 dark:text-amber-300", 
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    gradient: "from-amber-500 to-yellow-500"
  },
  aprovado: { 
    label: "Aprovado", 
    color: "text-green-700 dark:text-green-300", 
    bgColor: "bg-green-100 dark:bg-green-900/30",
    gradient: "from-green-500 to-emerald-500"
  },
  lancado: { 
    label: "Lançado", 
    color: "text-purple-700 dark:text-purple-300", 
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    gradient: "from-purple-500 to-violet-500"
  },
  cancelado: { 
    label: "Cancelado", 
    color: "text-red-700 dark:text-red-300", 
    bgColor: "bg-red-100 dark:bg-red-900/30",
    gradient: "from-red-500 to-red-600"
  },
};

const prioridadeConfig: Record<string, { label: string; color: string }> = {
  alta: { label: "Alta", color: "bg-red-500" },
  media: { label: "Média", color: "bg-amber-500" },
  baixa: { label: "Baixa", color: "bg-green-500" },
};

export default function FabricaLancamentos() {
  const { loading: permLoading } = useScreenPermissions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLancamento, setSelectedLancamento] = useState<Lancamento | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState("calendario");

  const { data: lancamentos, isLoading, refetch } = useQuery({
    queryKey: ["lancamentos-produtos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos_produtos")
        .select(`
          *,
          fabrica_produtos(nome, codigo, foto_url),
          profiles!lancamentos_produtos_responsavel_id_fkey(nome)
        `)
        .order("data_prevista", { ascending: true });

      if (error) throw error;
      return data as Lancamento[];
    },
  });

  const { data: tarefasPendentes } = useQuery({
    queryKey: ["lancamentos-tarefas-pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos_tarefas_marketing")
        .select("id")
        .neq("status", "concluido");

      if (error) throw error;
      return data?.length || 0;
    },
  });

  if (permLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const proximosLancamentos = lancamentos?.filter(
    (l) => l.status !== "lancado" && l.status !== "cancelado" && new Date(l.data_prevista) >= new Date()
  ).length || 0;

  const emPreparacao = lancamentos?.filter((l) => l.status === "em_preparacao").length || 0;

  const lancadosNoMes = lancamentos?.filter((l) => {
    if (!l.data_efetiva) return false;
    const dataEfetiva = new Date(l.data_efetiva);
    return dataEfetiva.getMonth() === new Date().getMonth() && dataEfetiva.getFullYear() === new Date().getFullYear();
  }).length || 0;

  // Calendar view logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getLancamentosForDay = (day: Date) => {
    return lancamentos?.filter((l) => isSameDay(new Date(l.data_prevista), day)) || [];
  };

  const handleLancamentoClick = (lancamento: Lancamento) => {
    setSelectedLancamento(lancamento);
    setDetailOpen(true);
  };

  // Kanban columns
  const kanbanColumns = ["planejado", "em_preparacao", "aprovado", "lancado"];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
                <Rocket className="h-6 w-6 text-primary" />
              </div>
              Calendário de Lançamentos
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie lançamentos de produtos e coordene com distribuidores e marketing
            </p>
          </div>
          <Button onClick={() => { setSelectedLancamento(null); setDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Lançamento
          </Button>
        </div>

        {/* KPIs Modernizados */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Próximos Lançamentos</p>
                  <p className="text-3xl font-bold mt-1">{proximosLancamentos}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-blue-500/20 to-cyan-500/10 rounded-xl">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span>Agendados</span>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="h-1 bg-gradient-to-r from-amber-500 to-yellow-500" />
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Em Preparação</p>
                  <p className="text-3xl font-bold mt-1">{emPreparacao}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-amber-500/20 to-yellow-500/10 rounded-xl">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                <span>Aguardando conclusão</span>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="h-1 bg-gradient-to-r from-orange-500 to-red-500" />
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Marketing Pendente</p>
                  <p className="text-3xl font-bold mt-1">{tarefasPendentes}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-orange-500/20 to-red-500/10 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-orange-600" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                <span>Tarefas a concluir</span>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Lançados Este Mês</p>
                  <p className="text-3xl font-bold mt-1">{lancadosNoMes}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs text-green-600">
                <CheckCircle className="h-3 w-3" />
                <span>Concluídos</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-muted/50">
                <TabsTrigger value="calendario" className="flex items-center gap-2 data-[state=active]:bg-background">
                  <CalendarDays className="h-4 w-4" />
                  Calendário
                </TabsTrigger>
                <TabsTrigger value="lista" className="flex items-center gap-2 data-[state=active]:bg-background">
                  <List className="h-4 w-4" />
                  Lista
                </TabsTrigger>
                <TabsTrigger value="kanban" className="flex items-center gap-2 data-[state=active]:bg-background">
                  <Kanban className="h-4 w-4" />
                  Kanban
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              {/* Calendar View */}
              <TabsContent value="calendario" className="mt-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>
                    <h3 className="text-lg font-semibold capitalize">
                      {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                      Próximo
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                      <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                        {day}
                      </div>
                    ))}

                    {/* Empty cells for days before month start */}
                    {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                      <div key={`empty-start-${i}`} className="min-h-[120px] bg-muted/20 rounded-lg" />
                    ))}

                    {daysInMonth.map((day) => {
                      const dayLancamentos = getLancamentosForDay(day);
                      return (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            "min-h-[120px] rounded-lg p-2 transition-all",
                            isToday(day) 
                              ? "ring-2 ring-primary bg-primary/5" 
                              : "border border-border/50 hover:bg-muted/30"
                          )}
                        >
                          <div className={cn(
                            "text-sm font-medium mb-1.5 h-6 w-6 rounded-full flex items-center justify-center",
                            isToday(day) ? "bg-primary text-primary-foreground" : ""
                          )}>
                            {format(day, "d")}
                          </div>
                          <div className="space-y-1">
                            {dayLancamentos.slice(0, 2).map((l) => (
                              <div
                                key={l.id}
                                onClick={() => handleLancamentoClick(l)}
                                className={cn(
                                  "flex items-center gap-1.5 p-1 rounded cursor-pointer transition-all hover:scale-[1.02]",
                                  statusConfig[l.status]?.bgColor
                                )}
                              >
                                <ProductThumbnail src={l.fabrica_produtos?.foto_url} size="sm" className="h-5 w-5" />
                                <span className={cn("text-xs truncate flex-1", statusConfig[l.status]?.color)}>
                                  {l.nome_lancamento}
                                </span>
                                <div className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", prioridadeConfig[l.prioridade]?.color)} />
                              </div>
                            ))}
                            {dayLancamentos.length > 2 && (
                              <div className="text-xs text-primary font-medium cursor-pointer hover:underline">
                                +{dayLancamentos.length - 2} mais
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>

              {/* List View */}
              <TabsContent value="lista" className="mt-0">
                <div className="space-y-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                  ) : lancamentos?.length === 0 ? (
                    <div className="text-center py-12">
                      <Rocket className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-muted-foreground">Nenhum lançamento cadastrado</p>
                      <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => { setSelectedLancamento(null); setDialogOpen(true); }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Criar Primeiro Lançamento
                      </Button>
                    </div>
                  ) : (
                    lancamentos?.map((l) => (
                      <LaunchCard
                        key={l.id}
                        id={l.id}
                        nome={l.nome_lancamento}
                        produto={l.fabrica_produtos}
                        responsavel={l.profiles}
                        data_prevista={l.data_prevista}
                        status={l.status}
                        tipo={l.tipo}
                        prioridade={l.prioridade}
                        onClick={() => handleLancamentoClick(l)}
                      />
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Kanban View */}
              <TabsContent value="kanban" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {kanbanColumns.map((status) => {
                    const columnLancamentos = lancamentos?.filter((l) => l.status === status) || [];
                    return (
                      <div key={status} className="space-y-3">
                        <div className={cn(
                          "p-3 rounded-xl flex items-center justify-between",
                          statusConfig[status]?.bgColor
                        )}>
                          <h4 className={cn("font-semibold", statusConfig[status]?.color)}>
                            {statusConfig[status]?.label}
                          </h4>
                          <Badge variant="secondary" className="text-xs">
                            {columnLancamentos.length}
                          </Badge>
                        </div>
                        <div className="space-y-3 min-h-[300px]">
                          {columnLancamentos.map((l) => (
                            <LaunchCard
                              key={l.id}
                              id={l.id}
                              nome={l.nome_lancamento}
                              produto={l.fabrica_produtos}
                              responsavel={l.profiles}
                              data_prevista={l.data_prevista}
                              status={l.status}
                              tipo={l.tipo}
                              prioridade={l.prioridade}
                              onClick={() => handleLancamentoClick(l)}
                              variant="compact"
                            />
                          ))}
                          {columnLancamentos.length === 0 && (
                            <div className="flex items-center justify-center h-24 border-2 border-dashed rounded-lg text-muted-foreground text-sm">
                              Nenhum item
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <NovoLancamentoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        lancamento={selectedLancamento}
        onSuccess={() => {
          refetch();
          setDialogOpen(false);
        }}
      />

      <LancamentoDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        lancamento={selectedLancamento}
        onEdit={() => {
          setDetailOpen(false);
          setDialogOpen(true);
        }}
        onRefresh={refetch}
      />
    </DashboardLayout>
  );
}
