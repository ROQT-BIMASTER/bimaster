import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ClienteHistoricoCompraChart } from "@/components/fornecedor/clientes/ClienteHistoricoCompraChart";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: number | null;
  clienteNome?: string | null;
}

export function ClienteHistoricoCompraDialog({ open, onOpenChange, clienteId, clienteNome }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-8">
            <div>
              <DialogTitle>Histórico de compras do cliente</DialogTitle>
              <DialogDescription>
                Evolução mensal, tendência e projeção dos próximos meses.
              </DialogDescription>
            </div>
            {clienteId && (
              <Button asChild variant="outline" size="sm" className="gap-1.5 shrink-0">
                <Link to={`/dashboard/fornecedor/clientes/${clienteId}`} onClick={() => onOpenChange(false)}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Página do cliente
                </Link>
              </Button>
            )}
          </div>
        </DialogHeader>
        {clienteId ? (
          <ClienteHistoricoCompraChart clienteId={clienteId} clienteNome={clienteNome} height={380} />
        ) : (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Pedido sem cliente vinculado.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
