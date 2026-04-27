import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Truck, AlertTriangle } from "lucide-react";
import {
  useFabricaCompraItens,
  useRegistrarRecebimentoCompra,
} from "@/hooks/useFabricaCompraItens";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compraId: string;
  numero: string;
}

export function RegistrarRecebimentoNacionalDialog({
  open,
  onOpenChange,
  compraId,
  numero,
}: Props) {
  const { data: itens = [] } = useFabricaCompraItens(compraId);
  const registrar = useRegistrarRecebimentoCompra();
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [nf, setNf] = useState("");
  const [obs, setObs] = useState("");
  const [qtys, setQtys] = useState<Record<string, number>>({});

  const linhas = itens
    .map((i) => ({
      ...i,
      saldo: Math.max(0, Number(i.qty_pedida) - Number(i.qty_cancelada) - Number(i.qty_recebida)),
    }))
    .filter((i) => i.saldo > 0);

  const total = Object.values(qtys).reduce((s, q) => s + (q || 0), 0);

  const handleSubmit = async () => {
    await registrar.mutateAsync({
      compra_id: compraId,
      data_recebimento: data,
      nota_fiscal: nf,
      observacoes: obs,
      itens: linhas.map((l) => ({ compra_item_id: l.id, qty_recebida: qtys[l.id] || 0 })),
    });
    onOpenChange(false);
    setQtys({});
    setNf("");
    setObs("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Registrar recebimento parcial
          </DialogTitle>
          <DialogDescription>
            Compra <strong>{numero}</strong> — informe quantidade recebida por item.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Data do recebimento</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nota fiscal</Label>
            <Input value={nf} onChange={(e) => setNf(e.target.value)} placeholder="NF-e" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-xs">Itens em aberto</Label>
            <span className="text-xs text-muted-foreground">
              Total: <strong className="text-primary">{total}</strong>
            </span>
          </div>

          {linhas.length === 0 ? (
            <div className="p-4 border border-dashed rounded-lg text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Nenhum item em aberto
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {linhas.map((l: any) => (
                <div key={l.id} className="grid grid-cols-12 gap-2 items-center p-2 border rounded-lg">
                  <div className="col-span-7 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {l.descricao || l.mp?.nome || "Item"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Pedido: {l.qty_pedida} · Recebido: {l.qty_recebida} · Saldo:{" "}
                      <strong>{l.saldo}</strong>
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={l.saldo}
                    value={qtys[l.id] ?? ""}
                    onChange={(e) =>
                      setQtys((p) => ({
                        ...p,
                        [l.id]: Math.min(l.saldo, Math.max(0, Number(e.target.value) || 0)),
                      }))
                    }
                    className="col-span-5 h-9"
                    placeholder="Qty recebida"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Observações</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={registrar.isPending || total === 0}>
            {registrar.isPending ? "Registrando..." : "Registrar recebimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
