import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BilingualLabel } from "./BilingualLabel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShoppingCart, CalendarDays } from "lucide-react";

interface EmitirOCDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissao: any;
  onSuccess: () => void;
}

export function EmitirOCDialog({ open, onOpenChange, submissao, onSuccess }: EmitirOCDialogProps) {
  const [dataEntrega, setDataEntrega] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [loading, setLoading] = useState(false);

  const qtyTotal = submissao?.qty_total || 0;

  const handleEmitir = async () => {
    if (!dataEntrega) {
      toast.error("Informe a data de entrega prevista");
      return;
    }
    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      
      // Generate OC number
      const year = new Date().getFullYear();
      const { count } = await supabase
        .from("china_ordens_compra" as any)
        .select("*", { count: "exact", head: true });
      const seq = (count || 0) + 1;
      const numeroOC = `OC-${year}-${String(seq).padStart(3, "0")}`;

      const { error } = await supabase
        .from("china_ordens_compra" as any)
        .insert({
          numero_oc: numeroOC,
          submissao_id: submissao.id,
          produto_codigo: submissao.produto_codigo,
          produto_nome: submissao.produto_nome,
          qty_total: qtyTotal,
          data_entrega_prevista: dataEntrega,
          observacoes,
          created_by: user?.id,
        } as any);

      if (error) throw error;

      toast.success(`Ordem ${numeroOC} emitida com sucesso! 采购单已发出！`);
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao emitir OC");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <BilingualLabel pt="Emitir Ordem de Compra" cn="下采购单" size="md" />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-secondary/50 rounded-xl">
            <p className="font-bold text-foreground">{submissao?.produto_codigo}</p>
            <p className="text-sm text-muted-foreground">{submissao?.produto_nome}</p>
            <p className="text-lg font-bold text-primary mt-2">
              {qtyTotal.toLocaleString()} unidades 单位
            </p>
          </div>

          <div className="space-y-2">
            <BilingualLabel pt="Data de Entrega Prevista" cn="预计交货日期" size="sm" />
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={dataEntrega}
                onChange={(e) => setDataEntrega(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <BilingualLabel pt="Observações" cn="备注" size="sm" />
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Instruções especiais... 特殊说明..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar 取消
            </Button>
            <Button onClick={handleEmitir} disabled={loading}>
              {loading ? "Emitindo..." : "Emitir OC 下单"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
