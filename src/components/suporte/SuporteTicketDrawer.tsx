import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserCheck, ArrowRightLeft, AlertTriangle } from "lucide-react";
import { ChatThread } from "@/components/chat/v2/ChatThread";
import { CsatPrompt } from "@/components/suporte/CsatPrompt";
import { TicketEtapaBadge } from "@/components/suporte/TicketEtapaBadge";
import {
  SUPORTE_STATUS_LABEL,
  type SuporteChamado,
  type SuporteTicketStatus,
} from "@/hooks/suporte/types";
import { useSuporteAcoes } from "@/hooks/suporte/useSuporteAcoes";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { TransferirChamadoDialog } from "@/components/suporte/TransferirChamadoDialog";
import { EscalonarChamadoDialog } from "@/components/suporte/EscalonarChamadoDialog";
import { SuporteSlaCountdown } from "@/components/suporte/SuporteSlaCountdown";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PareceresTab } from "@/components/suporte/pareceres/PareceresTab";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  ticket: SuporteChamado | null;
  onClose: () => void;
}

export function SuporteTicketDrawer({ ticket, onClose }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { assumir, mudarStatus } = useSuporteAcoes();
  const [transferOpen, setTransferOpen] = useState(false);
  const [escalonarOpen, setEscalonarOpen] = useState(false);

  // Garante que o observador (dono, solicitante, responsável, fila) do ticket
  // é participante ativo da conversa antes do ChatThread renderizar. Sem isso
  // usuários fora da conversa veem "Conversa não encontrada" mesmo com histórico.
  useEffect(() => {
    if (!ticket?.conversa_id || !user?.id) return;
    let cancelled = false;
    (async () => {
      const { error } = await (supabase.rpc as any)(
        "add_conversa_participante_if_missing",
        { _conversa_id: ticket.conversa_id },
      );
      if (!cancelled && !error) {
        qc.invalidateQueries({ queryKey: ["chat", "conversas", user.id] });
        qc.invalidateQueries({ queryKey: ["chat", "conversa-info", ticket.conversa_id] });
        qc.invalidateQueries({ queryKey: ["chat", "mensagens", ticket.conversa_id] });
      }
    })();
    return () => { cancelled = true; };
  }, [ticket?.id, ticket?.conversa_id, user?.id, qc]);

  return (
    <>
      <Sheet open={!!ticket} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[960px] lg:max-w-[1100px] xl:max-w-[1240px] p-0 flex flex-col"
        >
          {ticket && (
            <>
              <div className="flex items-center justify-between gap-2 border-b p-3">
                <div className="flex items-center gap-2 min-w-0">
                  {ticket.protocolo && (
                    <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                      {ticket.protocolo}
                    </Badge>
                  )}
                  <span className="text-sm font-medium truncate">
                    {ticket.titulo ?? "(sem título)"}
                  </span>
                  <TicketEtapaBadge projetoTarefaId={ticket.projeto_tarefa_id} />
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <SuporteSlaCountdown ticket={ticket} />
                  {ticket.assignee_id !== user?.id && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={assumir.isPending}
                      onClick={() => assumir.mutate(ticket.id)}
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      Assumir
                    </Button>
                  )}
                  {ticket.status !== "resolvido" && (
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
                  {ticket.status !== "resolvido" && ticket.status !== "escalado" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-amber-500/50 text-amber-700 hover:bg-amber-500/10 hover:text-amber-800 dark:text-amber-400"
                      onClick={() => setEscalonarOpen(true)}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Escalonar
                    </Button>
                  )}
                  <Select
                    value={ticket.status}
                    onValueChange={(v) =>
                      mudarStatus.mutate({
                        ticketId: ticket.id,
                        status: v as SuporteTicketStatus,
                      })
                    }
                  >
                    <SelectTrigger className="w-[170px] h-8 text-xs">
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

              {ticket.status === "resolvido" &&
                (ticket.requester_id ?? ticket.owner_id) === user?.id && (
                  <div className="px-3 pt-3">
                    <CsatPrompt ticketId={ticket.id} />
                  </div>
                )}

              <Tabs defaultValue="chat" className="flex-1 min-h-0 flex flex-col">
                <TabsList className="mx-3 mt-2 self-start">
                  <TabsTrigger value="chat" className="text-xs">Conversa</TabsTrigger>
                  <TabsTrigger value="pareceres" className="text-xs">Pareceres</TabsTrigger>
                </TabsList>
                <TabsContent value="chat" className="flex-1 min-h-0 mt-2">
                  <ChatThread
                    conversaId={ticket.conversa_id}
                    onShowInfo={() => {}}
                    onBack={onClose}
                  />
                </TabsContent>
                <TabsContent value="pareceres" className="flex-1 min-h-0 mt-0">
                  <PareceresTab
                    ticketId={ticket.id}
                    filaAtualId={ticket.fila_id}
                    canWrite={ticket.requester_id !== user?.id}
                    onlyExterno={
                      (ticket.requester_id ?? ticket.owner_id) === user?.id
                    }
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {ticket && (
        <TransferirChamadoDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          ticketId={ticket.id}
          filaAtualId={ticket.fila_id}
          onTransferido={onClose}
        />
      )}

      {ticket && (
        <EscalonarChamadoDialog
          open={escalonarOpen}
          onOpenChange={setEscalonarOpen}
          ticketId={ticket.id}
          prioridadeAtual={ticket.prioridade}
        />
      )}
    </>
  );
}
