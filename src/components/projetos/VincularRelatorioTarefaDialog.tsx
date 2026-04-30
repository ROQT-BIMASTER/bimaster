import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projetoId: string;
  onConfirm: (tarefaId: string) => Promise<boolean>;
}

interface Tarefa { id: string; titulo: string; estagio?: string | null }

export function VincularRelatorioTarefaDialog({ open, onOpenChange, projetoId, onConfirm }: Props) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !projetoId) return;
    setLoading(true);
    setSelected(null);
    setQuery("");
    (async () => {
      const { data } = await supabase
        .from("projeto_tarefas")
        .select("id, titulo, estagio")
        .eq("projeto_id", projetoId)
        .order("updated_at", { ascending: false })
        .limit(200);
      setTarefas((data as Tarefa[]) ?? []);
      setLoading(false);
    })();
  }, [open, projetoId]);

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tarefas;
    return tarefas.filter((t) => t.titulo?.toLowerCase().includes(q));
  }, [tarefas, query]);

  const handleConfirm = async () => {
    if (!selected) return;
    setBusy(true);
    const ok = await onConfirm(selected);
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ListChecks className="size-4 text-primary" /> Vincular relatório a uma tarefa
          </DialogTitle>
          <DialogDescription>
            O arquivo será anexado à tarefa escolhida e o relatório fica salvo (não expira).
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar tarefa por título..."
            className="pl-7 h-9"
          />
        </div>

        <ScrollArea className="h-64 border rounded-md">
          {loading ? (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground gap-2">
              <Loader2 className="size-3 animate-spin" /> Carregando tarefas...
            </div>
          ) : filtradas.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-8">
              Nenhuma tarefa encontrada.
            </div>
          ) : (
            <ul className="divide-y">
              {filtradas.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => setSelected(t.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors",
                      selected === t.id && "bg-primary/10",
                    )}
                  >
                    <div className="font-medium line-clamp-1">{t.titulo}</div>
                    {t.estagio && <div className="text-[11px] text-muted-foreground">{t.estagio}</div>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!selected || busy}>
            {busy && <Loader2 className="size-3 animate-spin mr-1" />}
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
