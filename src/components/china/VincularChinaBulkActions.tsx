import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  submissoes: Array<{ id: string; produto_codigo: string; produto_nome: string; isLinked?: boolean }>;
  onComplete: () => void;
}

export function VincularChinaBulkActions({ open, onOpenChange, selectedIds, submissoes, onComplete }: Props) {
  const [loading, setLoading] = useState(false);

  const selected = submissoes.filter(s => selectedIds.includes(s.id));
  const unlinked = selected.filter(s => !s.isLinked);
  const linked = selected.filter(s => s.isLinked);

  const handleDespachar = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("nome").eq("id", user!.id).maybeSingle();

      for (const sub of selected) {
        // Create process event for each
        const { data: process } = await (supabase
          .from("product_process" as any)
          .select("id")
          .eq("produto_tipo", "china")
          .eq("produto_ref_id", sub.id)
          .maybeSingle() as any);

        if (process?.id) {
          await (supabase.from("process_events" as any).insert({
            process_id: process.id,
            tipo_evento: "despacho_lote",
            descricao: `Despacho em lote de ${selected.length} submissões`,
            modulo_origem: "china",
            usuario_id: user?.id,
            usuario_nome: profile?.nome || user?.email,
            metadata: { batch_size: selected.length },
          }) as any);
        }
      }

      toast.success(`${selected.length} submissão(ões) despachada(s)`);
      onComplete();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao despachar em lote");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Despachar Selecionados
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Confirma o despacho de <span className="font-semibold text-foreground">{selected.length}</span> submissão(ões)?
          </p>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {selected.map(s => (
              <div key={s.id} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded border">
                <span className="font-mono font-bold text-primary">{s.produto_codigo}</span>
                <span className="truncate">{s.produto_nome}</span>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleDespachar} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Confirmar Despacho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
