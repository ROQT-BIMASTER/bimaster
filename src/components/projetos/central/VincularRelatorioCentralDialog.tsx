import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, ListChecks, FolderKanban, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Receives chosen projeto+tarefa to perform the link */
  onConfirm: (projetoId: string, tarefaId: string) => Promise<boolean>;
}

interface Projeto { id: string; nome: string }
interface Tarefa { id: string; titulo: string; estagio?: string | null }

export function VincularRelatorioCentralDialog({ open, onOpenChange, onConfirm }: Props) {
  const [step, setStep] = useState<"projeto" | "tarefa">("projeto");
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [projetoSel, setProjetoSel] = useState<Projeto | null>(null);
  const [tarefaSel, setTarefaSel] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("projeto");
    setQuery("");
    setProjetoSel(null);
    setTarefaSel(null);
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("projetos")
        .select("id, nome")
        .order("nome", { ascending: true })
        .limit(200);
      setProjetos((data as Projeto[]) ?? []);
      setLoading(false);
    })();
  }, [open]);

  useEffect(() => {
    if (step !== "tarefa" || !projetoSel) return;
    setLoading(true);
    setTarefaSel(null);
    setQuery("");
    (async () => {
      const { data } = await supabase
        .from("projeto_tarefas")
        .select("id, titulo, estagio")
        .eq("projeto_id", projetoSel.id)
        .order("updated_at", { ascending: false })
        .limit(200);
      setTarefas((data as Tarefa[]) ?? []);
      setLoading(false);
    })();
  }, [step, projetoSel]);

  const filtradosProjetos = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projetos;
    return projetos.filter((p) => p.nome?.toLowerCase().includes(q));
  }, [projetos, query]);

  const filtradasTarefas = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tarefas;
    return tarefas.filter((t) => t.titulo?.toLowerCase().includes(q));
  }, [tarefas, query]);

  const handleConfirm = async () => {
    if (!projetoSel || !tarefaSel) return;
    setBusy(true);
    const ok = await onConfirm(projetoSel.id, tarefaSel);
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {step === "projeto" ? <FolderKanban className="size-4 text-primary" /> : <ListChecks className="size-4 text-primary" />}
            {step === "projeto" ? "Escolha o projeto" : "Escolha a tarefa"}
          </DialogTitle>
          <DialogDescription>
            {step === "projeto"
              ? "Selecione em qual projeto a tarefa receberá o relatório como anexo."
              : <span>Projeto: <strong>{projetoSel?.nome}</strong>. O relatório fica salvo (não expira) ao vincular.</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={step === "projeto" ? "Buscar projeto..." : "Buscar tarefa..."}
            className="pl-7 h-9"
          />
        </div>

        <ScrollArea className="h-64 border rounded-md">
          {loading ? (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground gap-2">
              <Loader2 className="size-3 animate-spin" /> Carregando...
            </div>
          ) : step === "projeto" ? (
            filtradosProjetos.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-8">Nenhum projeto encontrado.</div>
            ) : (
              <ul className="divide-y">
                {filtradosProjetos.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => { setProjetoSel(p); setStep("tarefa"); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <div className="font-medium line-clamp-1">{p.nome}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            filtradasTarefas.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-8">Nenhuma tarefa encontrada.</div>
            ) : (
              <ul className="divide-y">
                {filtradasTarefas.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => setTarefaSel(t.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors",
                        tarefaSel === t.id && "bg-primary/10",
                      )}
                    >
                      <div className="font-medium line-clamp-1">{t.titulo}</div>
                      {t.estagio && <div className="text-[11px] text-muted-foreground">{t.estagio}</div>}
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
        </ScrollArea>

        <DialogFooter>
          {step === "tarefa" && (
            <Button variant="ghost" onClick={() => setStep("projeto")} disabled={busy} className="mr-auto gap-1">
              <ArrowLeft className="size-3.5" /> Trocar projeto
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          {step === "tarefa" && (
            <Button onClick={handleConfirm} disabled={!tarefaSel || busy}>
              {busy && <Loader2 className="size-3 animate-spin mr-1" />}
              Vincular
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
