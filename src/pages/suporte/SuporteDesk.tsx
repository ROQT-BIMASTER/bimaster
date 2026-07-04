import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Inbox,
  Loader2,
  MessageSquare,
  UserCheck,
  ArrowRightLeft,
  Search,
  BarChart3,
  LineChart as LineChartIcon,
} from "lucide-react";
import { subDays, format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { isSuporteV2Enabled } from "@/lib/featureFlags";
import { useMinhasFilasAgente, useSuporteFilas } from "@/hooks/suporte/useSuporteFilas";
import { useChamadosDesk } from "@/hooks/suporte/useSuporteChamados";
import { useSuporteAcoes } from "@/hooks/suporte/useSuporteAcoes";
import { useSuporteIaTrigger } from "@/hooks/suporte/useSuporteIaTrigger";
import { ChamadoListItem } from "@/components/suporte/ChamadoListItem";
import { TransferirChamadoDialog } from "@/components/suporte/TransferirChamadoDialog";
import { SuporteCentralKpis } from "@/components/suporte/SuporteCentralKpis";
import { SuporteVisaoExecutiva } from "@/components/suporte/SuporteVisaoExecutiva";
import { SuporteAnalisesBuilder } from "@/components/suporte/SuporteAnalisesBuilder";
import { ChatThread } from "@/components/chat/v2/ChatThread";
import {
  SUPORTE_STATUS_LABEL,
  type SuporteFila,
  type SuporteTicketStatus,
} from "@/hooks/suporte/types";

const TODOS = "__todos__";

const CATEGORIA_LABEL: Record<string, string> = {
  bug: "Bug",
  duvida_uso: "Dúvida de uso",
  solicitacao_acesso: "Acesso",
  solicitacao_funcionalidade: "Nova feature",
  integracao: "Integração",
  financeiro: "Financeiro",
  performance: "Performance",
  dados_inconsistentes: "Dados",
  outro: "Outro",
};

export default function SuporteDesk() {
  const { user } = useAuth();
  const { isAdmin, isAdminOrSupervisor } = useUserRole();

  const { data: minhas, isLoading: minhasLoading } = useMinhasFilasAgente();
  const { data: todasFilasData, isLoading: todasLoading } = useSuporteFilas();

  const podeVerTudo = isAdmin || isAdminOrSupervisor;
  const filasAgente = minhas?.filas ?? [];
  const todasFilas: SuporteFila[] = todasFilasData ?? [];
  const filasSelecionaveis: SuporteFila[] = podeVerTudo ? todasFilas : filasAgente;
  const carregandoFilas = podeVerTudo ? todasLoading : minhasLoading;

  const [departamentoSel, setDepartamentoSel] = useState<string>(
    podeVerTudo ? TODOS : "",
  );

  // Se o agente comum ainda não escolheu, escolher a primeira dele
  const departamentoAtivo = useMemo(() => {
    if (departamentoSel) return departamentoSel;
    if (!podeVerTudo && filasAgente.length > 0) return filasAgente[0].id;
    return TODOS;
  }, [departamentoSel, podeVerTudo, filasAgente]);

  const filaIds = useMemo(() => {
    if (departamentoAtivo === TODOS) return filasSelecionaveis.map((f) => f.id);
    return [departamentoAtivo];
  }, [departamentoAtivo, filasSelecionaveis]);

  const [filtroStatus, setFiltroStatus] = useState<string>("abertos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroPeriodo, setFiltroPeriodo] = useState<"7" | "30" | "90">("30");
  const [busca, setBusca] = useState("");
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [aba, setAba] = useState<"tickets" | "executiva" | "analises">("tickets");
  const { assumir, mudarStatus } = useSuporteAcoes();

  const { data: chamados = [], isLoading } = useChamadosDesk(filaIds);

  const ticketsPeriodo = useMemo(() => {
    const dias = parseInt(filtroPeriodo, 10);
    const limite = subDays(new Date(), dias).getTime();
    return chamados.filter((t) => new Date(t.created_at).getTime() >= limite);
  }, [chamados, filtroPeriodo]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return ticketsPeriodo.filter((c) => {
      if (filtroStatus === "abertos" && c.status === "resolvido") return false;
      if (filtroStatus !== "abertos" && filtroStatus !== "todos" && c.status !== filtroStatus)
        return false;
      if (filtroCategoria !== "todas" && (c.categoria ?? "outro") !== filtroCategoria)
        return false;
      if (!q) return true;
      return (
        (c.titulo ?? "").toLowerCase().includes(q) ||
        (c.protocolo ?? "").toLowerCase().includes(q) ||
        (c.resumo ?? "").toLowerCase().includes(q)
      );
    });
  }, [ticketsPeriodo, filtroStatus, filtroCategoria, busca]);

  const selecionado = chamados.find((c) => c.id === selecionadoId) ?? null;
  useSuporteIaTrigger(selecionado?.conversa_id, user?.id);

  if (!isSuporteV2Enabled()) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto mb-2" />
              A Central de Suporte está em piloto interno e ainda não foi liberada para o seu
              usuário.
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!carregandoFilas && filasSelecionaveis.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto mb-2" />
              {podeVerTudo
                ? "Nenhuma fila de suporte cadastrada. Crie uma fila em Admin › Suporte."
                : "Você não está vinculado a nenhuma fila de suporte. Peça a um administrador para te adicionar como agente de um departamento."}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const filaAtivaObj =
    departamentoAtivo === TODOS
      ? null
      : filasSelecionaveis.find((f) => f.id === departamentoAtivo) ?? null;

  const exibirSeletor = podeVerTudo || filasSelecionaveis.length > 1;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-3">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Inbox className="h-6 w-6 text-primary" />
              Central de Suporte
            </h2>
            <p className="text-sm text-muted-foreground">
              Chamados, SLA e indicadores por departamento.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {exibirSeletor ? (
              <Select value={departamentoAtivo} onValueChange={setDepartamentoSel}>
                <SelectTrigger className="w-[220px] h-9">
                  <SelectValue placeholder="Departamento" />
                </SelectTrigger>
                <SelectContent>
                  {podeVerTudo && (
                    <SelectItem value={TODOS}>Todos os departamentos</SelectItem>
                  )}
                  {filasSelecionaveis.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              filaAtivaObj && (
                <Badge variant="outline" className="h-9 px-3 text-sm">
                  {filaAtivaObj.nome}
                </Badge>
              )
            )}
            <Select value={filtroPeriodo} onValueChange={(v) => setFiltroPeriodo(v as any)}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPIs */}
        <SuporteCentralKpis tickets={ticketsPeriodo} />

        {/* Abas */}
        <Tabs value={aba} onValueChange={(v) => setAba(v as any)} className="flex flex-col">
          <TabsList className="w-fit">
            <TabsTrigger value="tickets" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Tickets
            </TabsTrigger>
            <TabsTrigger value="executiva" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> Visão executiva
            </TabsTrigger>
            <TabsTrigger value="analises" className="gap-1.5">
              <LineChartIcon className="h-3.5 w-3.5" /> Análises
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="mt-3 flex flex-col gap-3 h-[calc(100vh-22rem)] min-h-[520px]">

            {/* Filtros */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar título, protocolo, resumo…"
                  className="pl-8 w-64 h-9"
                />
              </div>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-44 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="abertos">Abertos</SelectItem>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  {(Object.keys(SUPORTE_STATUS_LABEL) as SuporteTicketStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {SUPORTE_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="w-44 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas categorias</SelectItem>
                  {Object.entries(CATEGORIA_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grid lista + detalhe */}
            <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
                {isLoading || carregandoFilas ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : filtrados.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Nenhum chamado nesta visão.
                  </p>
                ) : (
                  filtrados.map((c) => (
                    <ChamadoListItem
                      key={c.id}
                      chamado={c}
                      selecionado={c.id === selecionadoId}
                      onClick={() => setSelecionadoId(c.id)}
                      mostrarSolicitante
                    />
                  ))
                )}
              </div>

              <Card className="min-h-0 overflow-hidden hidden lg:flex lg:flex-col">
                {selecionado ? (
                  <>
                    <div className="flex items-center justify-between gap-2 border-b p-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {selecionado.protocolo && (
                          <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                            {selecionado.protocolo}
                          </Badge>
                        )}
                        <span className="text-sm font-medium truncate">{selecionado.titulo}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {selecionado.assignee_id !== user?.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            disabled={assumir.isPending}
                            onClick={() => assumir.mutate(selecionado.id)}
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            Assumir
                          </Button>
                        )}
                        {selecionado.status !== "resolvido" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => setTransferOpen(true)}
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                            Transferir
                          </Button>
                        )}
                        <Select
                          value={selecionado.status}
                          onValueChange={(v) =>
                            mudarStatus.mutate({
                              ticketId: selecionado.id,
                              status: v as SuporteTicketStatus,
                            })
                          }
                        >
                          <SelectTrigger className="w-[180px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(SUPORTE_STATUS_LABEL) as SuporteTicketStatus[]).map(
                              (s) => (
                                <SelectItem key={s} value={s}>
                                  {SUPORTE_STATUS_LABEL[s]}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex-1 min-h-0">
                      <ChatThread
                        conversaId={selecionado.conversa_id}
                        onShowInfo={() => {}}
                        onBack={() => setSelecionadoId(null)}
                      />
                    </div>
                  </>
                ) : (
                  <CardContent className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <MessageSquare className="h-8 w-8" />
                    <p className="text-sm">Selecione um chamado para atender.</p>
                  </CardContent>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="executiva" className="mt-4">
            <SuporteVisaoExecutiva
              de={format(subDays(new Date(), parseInt(filtroPeriodo, 10) - 1), "yyyy-MM-dd")}
              ate={format(new Date(), "yyyy-MM-dd")}
              filaId={departamentoAtivo === TODOS ? null : departamentoAtivo}
              filaNome={filaAtivaObj?.nome ?? "Todos os departamentos"}
            />
          </TabsContent>

          <TabsContent value="analises" className="mt-4">
            <SuporteAnalisesBuilder
              de={format(subDays(new Date(), parseInt(filtroPeriodo, 10) - 1), "yyyy-MM-dd")}
              ate={format(new Date(), "yyyy-MM-dd")}
              filaId={departamentoAtivo === TODOS ? null : departamentoAtivo}
              filaNome={filaAtivaObj?.nome ?? "Todos os departamentos"}
              filasSelecionaveis={filasSelecionaveis}
              podeCompartilhar={podeVerTudo || filasAgente.length > 0}
            />
          </TabsContent>
        </Tabs>
      </div>

      {selecionado && (
        <TransferirChamadoDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          ticketId={selecionado.id}
          filaAtualId={selecionado.fila_id}
          onTransferido={() => setSelecionadoId(null)}
        />
      )}
    </DashboardLayout>
  );
}
