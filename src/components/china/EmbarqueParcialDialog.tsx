import { useState, useMemo } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ship, AlertTriangle } from "lucide-react";
import { BilingualLabel } from "./BilingualLabel";
import { useChinaOrdemItens } from "@/hooks/useChinaOrdemItens";
import { useCriarEmbarqueParcial } from "@/hooks/useChinaEmbarquesItens";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordemId: string;
  numeroOC: string;
}

export function EmbarqueParcialDialog({ open, onOpenChange, ordemId, numeroOC }: Props) {
  const { data: itens = [] } = useChinaOrdemItens(ordemId);
  const criar = useCriarEmbarqueParcial();
  const [tipo, setTipo] = useState<"parcial" | "final" | "unico">("parcial");
  const [container, setContainer] = useState("");
  const [navio, setNavio] = useState("");
  const [dataEmb, setDataEmb] = useState("");
  const [dataEta, setDataEta] = useState("");
  const [obs, setObs] = useState("");
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [lotes, setLotes] = useState<Record<string, string>>({});

  const linhasDisponiveis = useMemo(() => {
    return itens
      .filter((i) => i.qty_produzida - i.qty_embarcada > 0)
      .map((i) => ({
        ...i,
        disponivel: Math.max(0, i.qty_produzida - i.qty_embarcada),
      }));
  }, [itens]);

  const totalEmbarcando = Object.values(qtys).reduce((s, q) => s + (q || 0), 0);

  const handleSubmit = async () => {
    const linhas = linhasDisponiveis
      .map((l) => ({
        ordem_item_id: l.id,
        qty_embarcada: qtys[l.id] || 0,
        lote: lotes[l.id],
      }))
      .filter((l) => l.qty_embarcada > 0);

    await criar.mutateAsync({
      ordem_compra_id: ordemId,
      tipo_embarque: tipo,
      itens: linhas,
      numero_container: container,
      navio,
      data_embarque: dataEmb,
      data_eta: dataEta,
      observacoes: obs,
    });
    onOpenChange(false);
    setQtys({});
    setLotes({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5 text-blue-600" />
            <BilingualLabel pt="Novo embarque parcial" cn="新装运" size="md" />
          </DialogTitle>
          <DialogDescription>
            OC <strong>{numeroOC}</strong> — escolha quantidades por SKU. Vários embarques são permitidos.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de embarque</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="parcial">Parcial 部分</SelectItem>
                <SelectItem value="final">Final 最终</SelectItem>
                <SelectItem value="unico">Único 唯一</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Container 集装箱</Label>
            <Input value={container} onChange={(e) => setContainer(e.target.value)} placeholder="MSCU1234567" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Navio 船名</Label>
            <Input value={navio} onChange={(e) => setNavio(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data embarque 装船</Label>
            <Input type="date" value={dataEmb} onChange={(e) => setDataEmb(e.target.value)} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">ETA Brasil 预计到达</Label>
            <Input type="date" value={dataEta} onChange={(e) => setDataEta(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Itens disponíveis para embarque</Label>
            <span className="text-xs text-muted-foreground">
              Total embarcando: <strong className="text-blue-600">{totalEmbarcando}</strong>
            </span>
          </div>
          {linhasDisponiveis.length === 0 ? (
            <div className="p-4 border border-dashed rounded-lg text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Nenhum item produzido pendente de embarque
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {linhasDisponiveis.map((l) => (
                <div key={l.id} className="grid grid-cols-12 gap-2 items-center p-2 border rounded-lg">
                  <div className="col-span-5 min-w-0">
                    <p className="text-sm font-medium truncate">{l.cor_nome || l.sku || "Único"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Disponível: <strong>{l.disponivel}</strong>
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={l.disponivel}
                    value={qtys[l.id] ?? ""}
                    onChange={(e) =>
                      setQtys((p) => ({
                        ...p,
                        [l.id]: Math.min(l.disponivel, Math.max(0, Number(e.target.value) || 0)),
                      }))
                    }
                    className="col-span-3 h-9 text-sm"
                    placeholder="Qty"
                  />
                  <Input
                    value={lotes[l.id] || ""}
                    onChange={(e) => setLotes((p) => ({ ...p, [l.id]: e.target.value }))}
                    className="col-span-4 h-9 text-sm"
                    placeholder="Lote"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Observações 备注</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={criar.isPending || totalEmbarcando === 0}>
            {criar.isPending ? "Registrando..." : "Registrar embarque"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
