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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Factory, ShoppingBag, Package, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCriarVinculo } from "@/hooks/useComprasInternacionalVinculos";
import { useSubmissaoProjetosOPs } from "@/hooks/useSubmissaoProjetosOPs";
import { useEffect } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ocId: string;
  numeroOC: string;
  itemId?: string;
  itemDescricao?: string;
  qtyDisponivel: number;
  submissaoId?: string;
}

export function VincularBrasilDialog({
  open,
  onOpenChange,
  ocId,
  numeroOC,
  itemId,
  itemDescricao,
  qtyDisponivel,
  submissaoId,
}: Props) {
  const [tipo, setTipo] = useState<"op" | "compra" | "mp">("op");
  const [opId, setOpId] = useState<string>("");
  const [compraId, setCompraId] = useState<string>("");
  const [mpId, setMpId] = useState<string>("");
  const [qty, setQty] = useState<number>(qtyDisponivel);
  const [obs, setObs] = useState("");
  const criar = useCriarVinculo();

  const { data: sugestoes = [] } = useSubmissaoProjetosOPs(open ? submissaoId : undefined);
  const sugestaoFlat = sugestoes.flatMap((s) => s.ops);

  // Auto-preenche quando há exatamente uma OP sugerida e o usuário ainda não escolheu nada
  useEffect(() => {
    if (open && tipo === "op" && !opId && sugestaoFlat.length === 1) {
      setOpId(sugestaoFlat[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sugestaoFlat.length]);

  const { data: ops = [] } = useQuery({
    queryKey: ["fabrica-ops-aberto"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("fabrica_ordens_producao" as any)
        .select("id, numero, status, quantidade_planejada")
        .in("status", ["pendente", "em_andamento", "planejada"])
        .order("created_at", { ascending: false })
        .limit(100);
      return (data || []) as any[];
    },
  });

  const { data: compras = [] } = useQuery({
    queryKey: ["fabrica-compras-aberto"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("fabrica_compras" as any)
        .select("id, nota_fiscal, data_pedido, status")
        .neq("status", "recebido_total")
        .order("data_pedido", { ascending: false })
        .limit(100);
      return (data || []) as any[];
    },
  });

  const { data: mps = [] } = useQuery({
    queryKey: ["fabrica-mps-list"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("fabrica_materias_primas" as any)
        .select("id, nome, codigo")
        .order("nome")
        .limit(200);
      return (data || []) as any[];
    },
  });

  const handleSubmit = async () => {
    await criar.mutateAsync({
      china_ordem_compra_id: ocId,
      china_ordem_item_id: itemId,
      fabrica_op_id: tipo === "op" ? opId || undefined : undefined,
      fabrica_compra_id: tipo === "compra" ? compraId || undefined : undefined,
      fabrica_mp_id: tipo === "mp" ? mpId || undefined : undefined,
      qty_alocada: qty,
      observacoes: obs,
    });
    onOpenChange(false);
    setOpId(""); setCompraId(""); setMpId(""); setObs("");
  };

  const podeSubmeter =
    qty > 0 && ((tipo === "op" && opId) || (tipo === "compra" && compraId) || (tipo === "mp" && mpId));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Vincular ao Brasil
          </DialogTitle>
          <DialogDescription>
            OC <strong>{numeroOC}</strong>
            {itemDescricao && <> · {itemDescricao}</>} · Disponível:{" "}
            <strong className="text-primary">{qtyDisponivel}</strong>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tipo} onValueChange={(v) => setTipo(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="op"><Factory className="h-3.5 w-3.5 mr-1" /> OP Brasil</TabsTrigger>
            <TabsTrigger value="compra"><ShoppingBag className="h-3.5 w-3.5 mr-1" /> Compra</TabsTrigger>
            <TabsTrigger value="mp"><Package className="h-3.5 w-3.5 mr-1" /> Estoque</TabsTrigger>
          </TabsList>

          <TabsContent value="op" className="space-y-2 pt-3">
            <Label className="text-xs">Selecione a Ordem de Produção</Label>
            <Select value={opId} onValueChange={setOpId}>
              <SelectTrigger><SelectValue placeholder="Escolha uma OP em aberto" /></SelectTrigger>
              <SelectContent>
                {ops.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.numero} · {op.status} · {op.quantidade_planejada}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TabsContent>

          <TabsContent value="compra" className="space-y-2 pt-3">
            <Label className="text-xs">Selecione a Compra Nacional</Label>
            <Select value={compraId} onValueChange={setCompraId}>
              <SelectTrigger><SelectValue placeholder="Escolha uma compra" /></SelectTrigger>
              <SelectContent>
                {compras.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    NF {c.nota_fiscal || "—"} · {c.data_pedido} · {c.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TabsContent>

          <TabsContent value="mp" className="space-y-2 pt-3">
            <Label className="text-xs">Selecione a Matéria-prima</Label>
            <Select value={mpId} onValueChange={setMpId}>
              <SelectTrigger><SelectValue placeholder="Escolha uma matéria-prima" /></SelectTrigger>
              <SelectContent>
                {mps.map((mp) => (
                  <SelectItem key={mp.id} value={mp.id}>
                    {mp.codigo ? `${mp.codigo} · ` : ""}{mp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Quantidade alocada</Label>
            <Input
              type="number"
              min={0}
              max={qtyDisponivel}
              value={qty}
              onChange={(e) =>
                setQty(Math.min(qtyDisponivel, Math.max(0, Number(e.target.value) || 0)))
              }
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Observações</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={criar.isPending || !podeSubmeter}>
            {criar.isPending ? "Vinculando..." : "Criar vínculo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
