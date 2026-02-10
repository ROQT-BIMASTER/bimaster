import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Sparkles, ListChecks, MessageCircle, ScrollText, UserCircle } from "lucide-react";
import { LeadResumoIA } from "./LeadResumoIA";
import { LeadSubtarefas } from "./LeadSubtarefas";
import { LeadWhatsAppHistory } from "./LeadWhatsAppHistory";
import { LeadActivityLog } from "./LeadActivityLog";

interface Prospect {
  id: string;
  nome_empresa: string;
  contato_principal: string | null;
  email: string | null;
  telefone: string | null;
  cnpj: string | null;
  endereco: string | null;
  porte_empresa: string | null;
  status: string;
  categoria: string | null;
  ultimo_contato: string | null;
  proxima_acao: string | null;
  observacoes: string | null;
  municipio_id: string | null;
  vendedor?: { nome: string } | null;
}

interface ProspectFullModalProps {
  prospect: Prospect | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  novo: { label: "Novo", color: "bg-blue-500" },
  em_contato: { label: "Em Contato", color: "bg-cyan-500" },
  proposta_enviada: { label: "Proposta Enviada", color: "bg-purple-500" },
  negociacao: { label: "Negociação", color: "bg-yellow-500" },
  ganho: { label: "Ganho", color: "bg-green-500" },
  perdido: { label: "Perdido", color: "bg-red-500" },
};

export const ProspectFullModal = ({ prospect, open, onOpenChange, onUpdate }: ProspectFullModalProps) => {
  if (!prospect) return null;

  const status = statusLabels[prospect.status] || { label: prospect.status, color: "bg-muted" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 flex flex-col gap-0 overflow-hidden" aria-describedby={undefined}>
        <VisuallyHidden><DialogTitle>{prospect.nome_empresa}</DialogTitle></VisuallyHidden>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
              {prospect.nome_empresa.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold truncate">{prospect.nome_empresa}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge className={`${status.color} text-white text-[10px]`}>{status.label}</Badge>
                {prospect.vendedor && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <UserCircle className="h-3 w-3" />
                    {prospect.vendedor.nome}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="resumo" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-3 w-fit">
            <TabsTrigger value="resumo" className="gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              Resumo IA
            </TabsTrigger>
            <TabsTrigger value="subtarefas" className="gap-1.5 text-xs">
              <ListChecks className="h-3.5 w-3.5" />
              Subtarefas
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-1.5 text-xs">
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="log" className="gap-1.5 text-xs">
              <ScrollText className="h-3.5 w-3.5" />
              Log
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <TabsContent value="resumo" className="mt-0">
              <LeadResumoIA prospect={prospect} />
            </TabsContent>
            <TabsContent value="subtarefas" className="mt-0">
              <LeadSubtarefas prospectId={prospect.id} />
            </TabsContent>
            <TabsContent value="whatsapp" className="mt-0">
              <LeadWhatsAppHistory prospectId={prospect.id} prospectName={prospect.nome_empresa} />
            </TabsContent>
            <TabsContent value="log" className="mt-0">
              <LeadActivityLog prospectId={prospect.id} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
