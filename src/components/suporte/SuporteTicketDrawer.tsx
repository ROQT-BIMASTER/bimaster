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
import { useState } from "react";
import { TransferirChamadoDialog } from "@/components/suporte/TransferirChamadoDialog";
import { EscalonarChamadoDialog } from "@/components/suporte/EscalonarChamadoDialog";
import { SuporteSlaCountdown } from "@/components/suporte/SuporteSlaCountdown";

interface Props {
  ticket: SuporteChamado | null;
  onClose: () => void;
}

export function SuporteTicketDrawer({ ticket, onClose }: Props) {
  const { user } = useAuth();
  const { assumir, mudarStatus } = useSuporteAcoes();
  const [transferOpen, setTransferOpen] = useState(false);
  const [escalonarOpen, setEscalonarOpen] = useState(false);

  return (
    <>
      <Sheet open={!!ticket} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[720px] p-0 flex flex-col"
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

              <div className="flex-1 min-h-0">
                <ChatThread
                  conversaId={ticket.conversa_id}
                  onShowInfo={() => {}}
                  onBack={onClose}
                />
              </div>
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
    </>
  );
}
