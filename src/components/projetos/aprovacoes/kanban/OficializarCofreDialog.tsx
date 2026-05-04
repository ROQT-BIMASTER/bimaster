import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOficializarCofre, type KanbanItem } from "@/hooks/useKanbanAprovacoes";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: KanbanItem | null;
}

export function OficializarCofreDialog({ open, onOpenChange, item }: Props) {
  const [destino, setDestino] = useState<"produto" | "generico">("produto");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const oficializar = useOficializarCofre();

  useEffect(() => {
    if (!open) { setDestino("produto"); setCategoriaId(""); }
  }, [open]);

  const { data: categorias = [] } = useQuery({
    queryKey: ["cofre-generico-categorias"],
    enabled: open && destino === "generico",
    queryFn: async () => {
      const { data } = await supabase
        .from("cofre_generico_categorias" as any)
        .select("id, nome")
        .order("nome");
      return (data || []) as any[];
    },
  });

  if (!item) return null;

  async function confirmar() {
    if (!item) return;
    if (destino === "generico" && !categoriaId) return;
    await oficializar.mutateAsync({
      itemId: item.id,
      destino,
      categoriaId: destino === "generico" ? categoriaId : undefined,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Tornar oficial no Cofre
          </DialogTitle>
          <DialogDescription className="text-xs">
            Documento aprovado será arquivado como versão oficial.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={destino} onValueChange={(v) => setDestino(v as any)} className="space-y-2">
          <div className="flex items-start gap-2 rounded border p-2">
            <RadioGroupItem value="produto" id="dest-prod" className="mt-0.5" />
            <Label htmlFor="dest-prod" className="text-xs cursor-pointer">
              <div className="font-medium">Cofre do Produto</div>
              <div className="text-muted-foreground">Vincula ao produto referenciado pelo documento.</div>
            </Label>
          </div>
          <div className="flex items-start gap-2 rounded border p-2">
            <RadioGroupItem value="generico" id="dest-gen" className="mt-0.5" />
            <Label htmlFor="dest-gen" className="text-xs cursor-pointer">
              <div className="font-medium">Cofre Genérico</div>
              <div className="text-muted-foreground">Para contratos, políticas e manuais sem produto.</div>
            </Label>
          </div>
        </RadioGroup>
        {destino === "generico" && (
          <Select value={categoriaId} onValueChange={setCategoriaId}>
            <SelectTrigger className="text-xs"><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
            <SelectContent>
              {categorias.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={confirmar}
            disabled={oficializar.isPending || (destino === "generico" && !categoriaId)}
          >
            {oficializar.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Tornar oficial
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
