import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Inbox, Loader2, MessageSquare, UserCheck, ArrowRightLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { isSuporteV2Enabled } from "@/lib/featureFlags";
import { useMinhasFilasAgente, useSuporteFilas } from "@/hooks/suporte/useSuporteFilas";
import { useChamadosDesk } from "@/hooks/suporte/useSuporteChamados";
import { useSuporteAcoes } from "@/hooks/suporte/useSuporteAcoes";
import { useSuporteIaTrigger } from "@/hooks/suporte/useSuporteIaTrigger";
import { ChamadoListItem } from "@/components/suporte/ChamadoListItem";
import { TransferirChamadoDialog } from "@/components/suporte/TransferirChamadoDialog";
import { ChatThread } from "@/components/chat/v2/ChatThread";
import { SUPORTE_STATUS_LABEL, type SuporteTicketStatus } from "@/hooks/suporte/types";

export default function SuporteDesk() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { data: minhas, isLoading: filasLoading } = useMinhasFilasAgente();
  const { data: todasFilas, isLoading: todasLoading } = useSuporteFilas();
  const filas = isAdmin ? (todasFilas ?? []) : (minhas?.filas ?? []);
  const [filaAtiva, setFilaAtiva] = useState<string>("todas");
  const [filtroStatus, setFiltroStatus] = useState<string>("abertos");
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const { assumir, mudarStatus } = useSuporteAcoes();

  const filaIds = useMemo(
    () => (filaAtiva === "todas" ? filas.map((f) => f.id) : [filaAtiva]),
    [filaAtiva, filas],
  );
  const { data: chamados = [], isLoading } = useChamadosDesk(filaIds);

  const filtrados = useMemo(() => {
    if (filtroStatus === "abertos") return chamados.filter((c) => c.status !== "resolvido");
    if (filtroStatus === "todos") return chamados;
    return chamados.filter((c) => c.status === filtroStatus);
  }, [chamados, filtroStatus]);

  const selecionado = chamados.find((c) => c.id === selecionadoId) ?? null;
  useSuporteIaTrigger(selecionado?.conversa_id, user?.id);

  if (!isSuporteV2Enabled()) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto mb-2" />
              O desk de Suporte está em piloto interno e ainda não foi liberado para o seu usuário.
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!filasLoading && filas.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto mb-2" />
              Você não está vinculado a nenhuma fila de suporte. Peça a um administrador para te
              adicionar como agente de um departamento.
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4 h-[calc(100vh-8rem)]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Inbox className="h-6 w-6 text-primary" />
              Desk de Suporte
            </h2>
            <p className="text-sm text-muted-foreground">
              Chamados das filas em que você atende.
            </p>
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="abertos">Abertos</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
              {(Object.keys(SUPORTE_STATUS_LABEL) as SuporteTicketStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SUPORTE_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filas.length > 1 && (
          <Tabs value={filaAtiva} onValueChange={setFilaAtiva}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="todas">Todas</TabsTrigger>
              {filas.map((f) => (
                <TabsTrigger key={f.id} value={f.id}>
                  {f.nome}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 flex-1 min-h-0">
          {/* Lista */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
            {isLoading || filasLoading ? (
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

          {/* Detalhe: ações + thread */}
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
                        {(Object.keys(SUPORTE_STATUS_LABEL) as SuporteTicketStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>
                            {SUPORTE_STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
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
