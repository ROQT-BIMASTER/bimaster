import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Plus, Rocket, Clock, CheckCircle, AlertTriangle, List, CalendarDays, Kanban } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import NovoLancamentoDialog from "@/components/fabrica/NovoLancamentoDialog";
import LancamentoDetailDialog from "@/components/fabrica/LancamentoDetailDialog";

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
  fabrica_produtos?: { nome: string; codigo: string } | null;
  profiles?: { nome: string } | null;
};

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  planejado: { label: "Planejado", color: "text-blue-600", bgColor: "bg-blue-100" },
  em_preparacao: { label: "Em Preparação", color: "text-yellow-600", bgColor: "bg-yellow-100" },
  aprovado: { label: "Aprovado", color: "text-green-600", bgColor: "bg-green-100" },
  lancado: { label: "Lançado", color: "text-purple-600", bgColor: "bg-purple-100" },
  cancelado: { label: "Cancelado", color: "text-red-600", bgColor: "bg-red-100" },
};

const tipoConfig: Record<string, string> = {
  novo_produto: "Novo Produto",
  reformulacao: "Reformulação",
  nova_versao: "Nova Versão",
  promocional: "Promocional",
};

const prioridadeConfig: Record<string, { label: string; color: string }> = {
  alta: { label: "Alta", color: "bg-red-500" },
  media: { label: "Média", color: "bg-yellow-500" },
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
          fabrica_produtos(nome, codigo),
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
              <Rocket className="h-6 w-6 text-primary" />
              Calendário de Lançamentos
            </h1>
            <p className="text-muted-foreground">
              Gerencie os lançamentos de produtos e coordene com distribuidores e marketing
            </p>
          </div>
          <Button onClick={() => { setSelectedLancamento(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Lançamento
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Próximos Lançamentos</p>
                  <p className="text-2xl font-bold">{proximosLancamentos}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Em Preparação</p>
                  <p className="text-2xl font-bold">{emPreparacao}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-full">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tarefas Marketing Pendentes</p>
                  <p className="text-2xl font-bold">{tarefasPendentes}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lançados Este Mês</p>
                  <p className="text-2xl font-bold">{lancadosNoMes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader className="pb-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="calendario" className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Calendário
                </TabsTrigger>
                <TabsTrigger value="lista" className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  Lista
                </TabsTrigger>
                <TabsTrigger value="kanban" className="flex items-center gap-2">
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
                    <Button variant="outline" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                      ← Anterior
                    </Button>
                    <h3 className="text-lg font-semibold">
                      {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                    </h3>
                    <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                      Próximo →
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
                      <div key={`empty-start-${i}`} className="min-h-[100px] bg-muted/30 rounded-lg" />
                    ))}

                    {daysInMonth.map((day) => {
                      const dayLancamentos = getLancamentosForDay(day);
                      return (
                        <div
                          key={day.toISOString()}
                          className={`min-h-[100px] border rounded-lg p-1 ${
                            isToday(day) ? "border-primary bg-primary/5" : "border-border"
                          }`}
                        >
                          <div className={`text-sm font-medium mb-1 ${isToday(day) ? "text-primary" : ""}`}>
                            {format(day, "d")}
                          </div>
                          <div className="space-y-1">
                            {dayLancamentos.slice(0, 3).map((l) => (
                              <div
                                key={l.id}
                                onClick={() => handleLancamentoClick(l)}
                                className={`text-xs p-1 rounded cursor-pointer truncate ${statusConfig[l.status]?.bgColor} ${statusConfig[l.status]?.color}`}
                              >
                                {l.nome_lancamento}
                              </div>
                            ))}
                            {dayLancamentos.length > 3 && (
                              <div className="text-xs text-muted-foreground">
                                +{dayLancamentos.length - 3} mais
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
                <div className="space-y-3">
                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                  ) : lancamentos?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum lançamento cadastrado
                    </div>
                  ) : (
                    lancamentos?.map((l) => (
                      <div
                        key={l.id}
                        onClick={() => handleLancamentoClick(l)}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-2 h-12 rounded-full ${prioridadeConfig[l.prioridade]?.color}`} />
                          <div>
                            <h4 className="font-medium">{l.nome_lancamento}</h4>
                            <p className="text-sm text-muted-foreground">
                              {l.fabrica_produtos?.nome || "Sem produto vinculado"} • {tipoConfig[l.tipo]}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {format(new Date(l.data_prevista), "dd/MM/yyyy")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {l.profiles?.nome || "Sem responsável"}
                            </p>
                          </div>
                          <Badge className={`${statusConfig[l.status]?.bgColor} ${statusConfig[l.status]?.color}`}>
                            {statusConfig[l.status]?.label}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Kanban View */}
              <TabsContent value="kanban" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {kanbanColumns.map((status) => (
                    <div key={status} className="space-y-3">
                      <div className={`p-2 rounded-lg ${statusConfig[status]?.bgColor}`}>
                        <h4 className={`font-medium text-center ${statusConfig[status]?.color}`}>
                          {statusConfig[status]?.label}
                        </h4>
                      </div>
                      <div className="space-y-2 min-h-[200px]">
                        {lancamentos
                          ?.filter((l) => l.status === status)
                          .map((l) => (
                            <Card
                              key={l.id}
                              onClick={() => handleLancamentoClick(l)}
                              className="cursor-pointer hover:shadow-md transition-shadow"
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <h5 className="font-medium text-sm">{l.nome_lancamento}</h5>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {l.fabrica_produtos?.nome || "Sem produto"}
                                    </p>
                                  </div>
                                  <div className={`w-2 h-2 rounded-full ${prioridadeConfig[l.prioridade]?.color}`} />
                                </div>
                                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                                  <span>{format(new Date(l.data_prevista), "dd/MM")}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {tipoConfig[l.tipo]}
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    </div>
                  ))}
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
