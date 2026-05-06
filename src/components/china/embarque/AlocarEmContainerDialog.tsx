import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Container } from "lucide-react";
import { toast } from "sonner";
import {
  useContainersAbertos,
  useAlocarOPEmContainer,
  useCriarContainerConsolidado,
  type PatioOPItem,
} from "@/hooks/usePatioProntoEmbarque";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ops: PatioOPItem[];
  onSuccess?: () => void;
}

export function AlocarEmContainerDialog({ open, onOpenChange, ops, onSuccess }: Props) {
  const [tab, setTab] = useState<"existente" | "novo">("existente");
  const [embarqueId, setEmbarqueId] = useState<string>("");
  const [qtys, setQtys] = useState<Record<string, number>>(() =>
    Object.fromEntries(ops.map((o) => [o.ordem_producao_id, o.qty_disponivel]))
  );
  const [lotes, setLotes] = useState<Record<string, string>>({});
  const [novo, setNovo] = useState({
    numero_container: "",
    numero_bl: "",
    booking_number: "",
    navio: "",
    porto_origem: "",
    porto_destino: "",
    data_embarque: "",
    data_eta: "",
    modalidade: "FCL",
    observacoes: "",
  });

  const { data: containers = [], isLoading: loadingContainers } = useContainersAbertos();
  const alocar = useAlocarOPEmContainer();
  const criar = useCriarContainerConsolidado();
  const submitting = alocar.isPending || criar.isPending;

  const totalPecas = useMemo(
    () => ops.reduce((s, o) => s + (qtys[o.ordem_producao_id] ?? o.qty_disponivel), 0),
    [ops, qtys]
  );
  const ocsEnvolvidas = useMemo(
    () => new Set(ops.map((o) => o.ordem_compra_id).filter(Boolean)).size,
    [ops]
  );

  const handleSubmit = async () => {
    const itens = ops.map((o) => ({
      ordem_producao_id: o.ordem_producao_id,
      qty: Number(qtys[o.ordem_producao_id] ?? o.qty_disponivel),
      lote: lotes[o.ordem_producao_id] || o.lote || undefined,
    })).filter((i) => i.qty > 0);

    if (itens.length === 0) {
      toast.error("Informe ao menos uma quantidade");
      return;
    }

    try {
      if (tab === "existente") {
        if (!embarqueId) {
          toast.error("Selecione um container");
          return;
        }
        for (const it of itens) {
          await alocar.mutateAsync({
            embarque_id: embarqueId,
            op_id: it.ordem_producao_id,
            qty: it.qty,
            lote: it.lote,
          });
        }
        toast.success(`${itens.length} OP(s) alocada(s) no container`);
      } else {
        await criar.mutateAsync({ payload: novo, itens });
        toast.success("Container consolidado criado");
      }
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao alocar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Container className="h-4 w-4" />
            Alocar em container
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs grid grid-cols-3 gap-3">
          <div><span className="text-muted-foreground">OPs selecionadas:</span> <strong>{ops.length}</strong></div>
          <div><span className="text-muted-foreground">Total peças:</span> <strong>{totalPecas}</strong></div>
          <div><span className="text-muted-foreground">OCs envolvidas:</span> <strong>{ocsEnvolvidas}</strong></div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="existente">Container existente</TabsTrigger>
            <TabsTrigger value="novo">Novo container consolidado</TabsTrigger>
          </TabsList>

          <TabsContent value="existente" className="space-y-3 pt-3">
            <div>
              <Label className="text-xs">Container aberto</Label>
              <Select value={embarqueId} onValueChange={setEmbarqueId}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingContainers ? "Carregando..." : "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  {containers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      #{c.numero_embarque ?? "—"} · {c.numero_container || "sem container"} · {c.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="novo" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nº Container</Label>
                <Input value={novo.numero_container} onChange={(e) => setNovo({ ...novo, numero_container: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">BL</Label>
                <Input value={novo.numero_bl} onChange={(e) => setNovo({ ...novo, numero_bl: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Booking</Label>
                <Input value={novo.booking_number} onChange={(e) => setNovo({ ...novo, booking_number: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Navio</Label>
                <Input value={novo.navio} onChange={(e) => setNovo({ ...novo, navio: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Porto Origem</Label>
                <Input value={novo.porto_origem} onChange={(e) => setNovo({ ...novo, porto_origem: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Porto Destino</Label>
                <Input value={novo.porto_destino} onChange={(e) => setNovo({ ...novo, porto_destino: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Data Embarque</Label>
                <Input type="date" value={novo.data_embarque} onChange={(e) => setNovo({ ...novo, data_embarque: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">ETA</Label>
                <Input type="date" value={novo.data_eta} onChange={(e) => setNovo({ ...novo, data_eta: e.target.value })} />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-2 max-h-64 overflow-y-auto rounded-md border border-border p-2">
          <div className="text-[11px] font-medium text-muted-foreground px-1">Itens</div>
          {ops.map((o) => (
            <div key={o.ordem_producao_id} className="grid grid-cols-[1fr_100px_120px] gap-2 items-center text-xs">
              <div className="truncate">
                <span className="font-medium">{o.op_numero}</span>{" "}
                <span className="text-muted-foreground">· {o.produto_codigo} · disp. {o.qty_disponivel}</span>
              </div>
              <Input
                type="number"
                min={1}
                max={o.qty_disponivel}
                value={qtys[o.ordem_producao_id] ?? o.qty_disponivel}
                onChange={(e) => setQtys({ ...qtys, [o.ordem_producao_id]: Number(e.target.value) })}
                className="h-7"
              />
              <Input
                placeholder="Lote"
                value={lotes[o.ordem_producao_id] ?? o.lote ?? ""}
                onChange={(e) => setLotes({ ...lotes, [o.ordem_producao_id]: e.target.value })}
                className="h-7"
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar alocação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
