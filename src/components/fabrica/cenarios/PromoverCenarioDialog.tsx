import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Trophy, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CenarioProduto } from "@/hooks/useGrupoCenarios";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vencedor: CenarioProduto | null;
  irmaos: CenarioProduto[]; // demais do mesmo grupo
  onSuccess: () => void;
}

export function PromoverCenarioDialog({ open, onOpenChange, vencedor, irmaos, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);

  if (!vencedor) return null;

  const handlePromover = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc("rpc_promover_cenario", { p_produto_id: vencedor.id });
      if (error) throw error;
      toast.success("Cenário promovido a produto oficial");
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao promover cenário");
    } finally {
      setLoading(false);
    }
  };

  const outros = irmaos.filter((p) => p.id !== vencedor.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Promover cenário a produto oficial
          </DialogTitle>
          <DialogDescription>
            Esta ação move o cenário escolhido para o catálogo oficial de produtos acabados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Vencedor</div>
            <div className="font-medium">{vencedor.cenario_label || vencedor.nome}</div>
            <div className="text-xs text-muted-foreground">Código: {vencedor.codigo}</div>
          </div>

          {outros.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>{outros.length} cenário{outros.length > 1 ? "s" : ""}</strong> do mesmo grupo
                {outros.length > 1 ? " serão arquivados" : " será arquivado"} (soft delete) e {outros.length > 1 ? "ficarão" : "ficará"} disponíveis em "Cenários arquivados":
                <ul className="list-disc list-inside mt-2 text-xs">
                  {outros.map((p) => (
                    <li key={p.id}>{p.cenario_label || p.nome}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <p className="text-xs text-muted-foreground">
            Após a promoção, o produto entra no catálogo oficial e fica disponível para tabelas de preço, ordens de produção, NF e demais módulos.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handlePromover} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Confirmar promoção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
