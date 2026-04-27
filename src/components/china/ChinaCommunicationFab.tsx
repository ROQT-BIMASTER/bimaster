import { useState } from "react";
import { MessageCircle, X, Mail, FileText, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

/**
 * FAB (Floating Action Button) flutuante de comunicação rápida China–Brasil.
 *
 * Hoje a comunicação é via e-mail/WhatsApp/planilhas. Este botão expõe
 * dentro do sistema os atalhos para os canais já existentes:
 *  - Submissões pendentes (centraliza chat ChinaChatPanel via página detalhe)
 *  - Histórico/decisões (Inbox de Decisões)
 *
 * Não substitui as telas detalhadas — apenas dá acesso rápido em 1 clique.
 */
export function ChinaCommunicationFab() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {open && (
        <div className="flex flex-col gap-2 animate-fade-in">
          <Button
            size="sm"
            variant="secondary"
            className="shadow-lg gap-2 pl-3 pr-4"
            onClick={() => {
              navigate("/dashboard/fabrica-china/recebimentos");
              setOpen(false);
            }}
          >
            <FileText className="h-4 w-4" />
            <span className="text-xs">Submissões 提交</span>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="shadow-lg gap-2 pl-3 pr-4"
            onClick={() => {
              navigate("/dashboard/fabrica-china/ordens");
              setOpen(false);
            }}
          >
            <Mail className="h-4 w-4" />
            <span className="text-xs">Ordens 采购订单</span>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="shadow-lg gap-2 pl-3 pr-4"
            onClick={() => {
              navigate("/dashboard/fabrica-china");
              setOpen(false);
            }}
          >
            <Phone className="h-4 w-4" />
            <span className="text-xs">Painel China 面板</span>
          </Button>
        </div>
      )}
      <Button
        size="icon"
        className={cn(
          "h-12 w-12 rounded-full shadow-xl transition-transform",
          open && "rotate-90",
        )}
        onClick={() => setOpen(!open)}
        aria-label="Comunicação rápida China-Brasil"
        title="Comunicação China–Brasil"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </Button>
    </div>
  );
}
