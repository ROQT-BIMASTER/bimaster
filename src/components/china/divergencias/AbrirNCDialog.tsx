import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAbrirNCManual } from "@/hooks/useChinaNaoConformidades";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ordemCompraIdInicial?: string;
}

export function AbrirNCDialog({ open, onOpenChange, ordemCompraIdInicial }: Props) {
  const abrir = useAbrirNCManual();
  const [ocId, setOcId] = useState(ordemCompraIdInicial || "");
  const [tipo, setTipo] = useState<string>("avariado");
  const [severidade, setSeveridade] = useState<string>("media");
  const [qty, setQty] = useState<string>("");
  const [descricao, setDescricao] = useState("");

  const { data: ocs = [] } = useQuery({
    queryKey: ["china-ocs-list-min"],
    enabled: open && !ordemCompraIdInicial,
    queryFn: async () => {
      const { data } = await supabase
        .from("china_ordens_compra" as any)
        .select("id, numero_oc, produto_codigo")
        .order("created_at", { ascending: false })
        .limit(200);
      return (data || []) as any[];
    },
  });

  const reset = () => {
    setOcId(ordemCompraIdInicial || "");
    setTipo("avariado"); setSeveridade("media"); setQty(""); setDescricao("");
  };

  const submit = async () => {
    if (!ocId || !descricao.trim()) return;
    await abrir.mutateAsync({
      ordem_compra_id: ocId,
      tipo: tipo as any,
      severidade: severidade as any,
      qty_envolvida: qty ? Number(qty) : 0,
      descricao: descricao.trim(),
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nova divergência</DialogTitle></DialogHeader>

        <div className="space-y-3">
          {!ordemCompraIdInicial && (
            <div>
              <Label>Ordem de Compra</Label>
              <Select value={ocId} onValueChange={setOcId}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {ocs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.numero_oc} — {o.produto_codigo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="faltante">Faltante</SelectItem>
                  <SelectItem value="avariado">Avariado</SelectItem>
                  <SelectItem value="errado">Errado</SelectItem>
                  <SelectItem value="atraso">Atraso</SelectItem>
                  <SelectItem value="qualidade">Qualidade</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Severidade</Label>
              <Select value={severidade} onValueChange={setSeveridade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Qty envolvida</Label>
            <Input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value.slice(0, 1000))} rows={4} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!ocId || !descricao.trim() || abrir.isPending}>
            {abrir.isPending ? "Abrindo…" : "Abrir divergência"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
