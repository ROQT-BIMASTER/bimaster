import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDelegarItem, type KanbanItem } from "@/hooks/useKanbanAprovacoes";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: KanbanItem | null;
}

export function DelegarDialog({ open, onOpenChange, item }: Props) {
  const [paraId, setParaId] = useState<string>("");
  const [comentario, setComentario] = useState("");
  const delegar = useDelegarItem();

  useEffect(() => { if (!open) { setParaId(""); setComentario(""); } }, [open]);

  const { data: membros = [] } = useQuery({
    queryKey: ["projeto-membros-delegar", item?.projeto_id],
    enabled: !!item?.projeto_id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("projeto_membros")
        .select("user_id, profiles!projeto_membros_user_id_fkey(nome, email)")
        .eq("projeto_id", item!.projeto_id!);
      return ((data || []) as any[])
        .filter((m) => m.user_id !== item?.responsavel_atual_id)
        .map((m) => ({ id: m.user_id, nome: m.profiles?.nome || m.profiles?.email || "—" }));
    },
  });

  if (!item) return null;

  async function confirmar() {
    if (!item || !paraId) return;
    await delegar.mutateAsync({ itemId: item.id, paraUserId: paraId, comentario: comentario || undefined });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Delegar aprovação</DialogTitle>
          <DialogDescription className="text-xs">
            A responsabilidade será transferida. Você poderá acompanhar em "Deleguei".
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Select value={paraId} onValueChange={setParaId}>
            <SelectTrigger className="text-xs"><SelectValue placeholder="Selecione um membro" /></SelectTrigger>
            <SelectContent>
              {membros.map((m: any) => (
                <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Mensagem para o destinatário (opcional)"
            className="text-xs min-h-[64px]"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirmar} disabled={!paraId || delegar.isPending}>
            {delegar.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Delegar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
