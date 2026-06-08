/**
 * PromoverAnexoCofreDialog — diálogo enxuto para promover um anexo da
 * conversa (chat de tarefa) para o Cofre do produto vinculado à tarefa.
 *
 * Reusa `sendToCofre` de `useProjetoTarefaDetalhe`, com mesma validação
 * de papel (`admin_cofre` / `coordenador`) e mesma lista de categorias
 * exibida na aba "Fora do Cofre" da tarefa.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

export const COFRE_CATEGORIAS = [
  "briefing",
  "arte_final",
  "rotulo",
  "ficha_tecnica",
  "laudo",
  "certificado",
  "orcamento",
  "nota_fiscal",
  "art",
  "outro",
] as const;

export const COFRE_CATEGORIA_LABELS: Record<string, string> = {
  briefing: "Briefing",
  arte_final: "Arte Final",
  rotulo: "Rótulo",
  ficha_tecnica: "Ficha Técnica",
  laudo: "Laudo",
  certificado: "Certificado",
  orcamento: "Orçamento",
  nota_fiscal: "Nota Fiscal",
  art: "ART",
  outro: "Outro",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anexoId: string;
  anexoNome: string;
  produtoId: string;
  projetoId?: string | null;
  sendToCofre: {
    mutateAsync: (args: {
      anexoIds: string[];
      produtoId: string;
      categoriasPorAnexo: Record<string, string>;
      projetoId?: string;
    }) => Promise<unknown>;
    isPending?: boolean;
  };
  onPromoted?: (categoria: string) => void;
}

export function PromoverAnexoCofreDialog({
  open,
  onOpenChange,
  anexoId,
  anexoNome,
  produtoId,
  projetoId,
  sendToCofre,
  onPromoted,
}: Props) {
  const [categoria, setCategoria] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!categoria) {
      toast.error("Selecione a categoria do Cofre.");
      return;
    }
    setSubmitting(true);
    try {
      await sendToCofre.mutateAsync({
        anexoIds: [anexoId],
        produtoId,
        categoriasPorAnexo: { [anexoId]: categoria },
        projetoId: projetoId || undefined,
      });
      toast.success("Documento promovido ao Cofre.");
      onPromoted?.(categoria);
      onOpenChange(false);
      setCategoria("");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao promover ao Cofre.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Promover ao Cofre
          </DialogTitle>
          <DialogDescription>
            O arquivo bruto permanece nos anexos da tarefa. Uma cópia
            categorizada será publicada no Cofre do produto vinculado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Documento:</span>{" "}
            <span className="font-medium">{anexoNome}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cofre-categoria" className="text-xs">
              Categoria do Cofre
            </Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger id="cofre-categoria" className="h-9 text-sm">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {COFRE_CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {COFRE_CATEGORIA_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || !categoria}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Promovendo…
              </>
            ) : (
              "Promover ao Cofre"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
