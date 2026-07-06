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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filaId: string;
  filaNome: string;
  onDeleted?: () => void;
}

export function ExcluirDepartamentoDialog({
  open,
  onOpenChange,
  filaId,
  filaNome,
  onDeleted,
}: Props) {
  const qc = useQueryClient();
  const [confirmacao, setConfirmacao] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  // Conta chamados do departamento para decidir soft vs hard delete.
  const { data: totalTickets, isLoading: contando } = useQuery({
    queryKey: ["suporte", "fila-tickets-count", filaId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("suporte_tickets" as any)
        .select("id", { count: "exact", head: true })
        .eq("fila_id", filaId);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: open,
  });

  const podeExcluirDefinitivo = (totalTickets ?? 0) === 0;

  const handleExcluir = async (hard: boolean) => {
    if (confirmacao.trim() !== filaNome.trim()) {
      toast.error(`Digite exatamente o nome "${filaNome}" para confirmar.`);
      return;
    }
    setExcluindo(true);
    try {
      const { error } = await supabase.rpc("rpc_suporte_fila_excluir" as any, {
        p_fila_id: filaId,
        p_hard: hard,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["suporte", "filas"] });
      qc.invalidateQueries({ queryKey: ["suporte", "minhas-filas"] });
      toast.success(
        hard
          ? "Departamento excluído em definitivo."
          : "Departamento desativado. Histórico de chamados preservado.",
      );
      onDeleted?.();
      onOpenChange(false);
      setConfirmacao("");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao excluir departamento.");
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setConfirmacao("");
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-destructive" />
            Excluir departamento
          </DialogTitle>
          <DialogDescription>
            Você está prestes a excluir o departamento{" "}
            <span className="font-semibold text-foreground">{filaNome}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {contando ? (
            <div className="text-sm text-muted-foreground">
              Verificando chamados vinculados...
            </div>
          ) : podeExcluirDefinitivo ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Nenhum chamado está vinculado a este departamento. A exclusão pode
                ser <strong>definitiva</strong>.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Existem <strong>{totalTickets}</strong> chamado(s) vinculado(s). O
                departamento será <strong>desativado</strong> — não recebe mais
                chamados e some das listas, mas o histórico é preservado para
                auditoria.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Digite <span className="font-mono">{filaNome}</span> para confirmar
            </label>
            <input
              type="text"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={filaNome}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={excluindo}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleExcluir(podeExcluirDefinitivo)}
            disabled={
              excluindo || contando || confirmacao.trim() !== filaNome.trim()
            }
          >
            {excluindo
              ? "Excluindo..."
              : podeExcluirDefinitivo
                ? "Excluir definitivamente"
                : "Desativar departamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
