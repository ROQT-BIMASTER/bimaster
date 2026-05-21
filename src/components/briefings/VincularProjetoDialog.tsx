import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  briefingId: string;
  projetoIdAtual: string | null;
  onVinculado: (projetoId: string | null, nome: string | null) => void;
}

interface Projeto {
  id: string;
  nome: string;
  status?: string | null;
}

export function VincularProjetoDialog({
  open,
  onOpenChange,
  briefingId,
  projetoIdAtual,
  onVinculado,
}: Props) {
  const [busca, setBusca] = useState("");
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecionado, setSelecionado] = useState<string | null>(projetoIdAtual);

  useEffect(() => {
    if (!open) return;
    setSelecionado(projetoIdAtual);
    setBusca("");
  }, [open, projetoIdAtual]);

  useEffect(() => {
    if (!open) return;
    let canceled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      let q = supabase.from("projetos").select("id, nome, status").order("nome").limit(30);
      if (busca.trim()) q = q.ilike("nome", `%${busca.trim()}%`);
      const { data, error } = await q;
      if (!canceled) {
        if (error) toast.error("Erro ao buscar projetos");
        setProjetos((data ?? []) as Projeto[]);
        setLoading(false);
      }
    }, 250);
    return () => {
      canceled = true;
      clearTimeout(t);
    };
  }, [busca, open]);

  const salvar = async () => {
    const escolhido = projetos.find((p) => p.id === selecionado);
    const { error } = await supabase
      .from("briefings")
      .update({ projeto_id: selecionado })
      .eq("id", briefingId);
    if (error) {
      toast.error("Erro ao vincular projeto");
      return;
    }
    toast.success(selecionado ? "Projeto vinculado" : "Vínculo removido");
    onVinculado(selecionado, escolhido?.nome ?? null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular a projeto</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Buscar projeto pelo nome…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8"
            autoFocus
          />
        </div>

        <ScrollArea className="h-64 -mx-2 px-2">
          {loading ? (
            <div className="text-xs text-muted-foreground py-6 text-center">Buscando…</div>
          ) : projetos.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">
              Nenhum projeto encontrado.
            </div>
          ) : (
            <div className="space-y-1">
              {projetos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelecionado(p.id === selecionado ? null : p.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selecionado === p.id
                      ? "bg-primary/10 ring-1 ring-primary/40"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="font-medium truncate">{p.nome}</div>
                  {p.status && (
                    <div className="text-[11px] text-muted-foreground capitalize">
                      {p.status.replace(/_/g, " ")}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2">
          {projetoIdAtual && (
            <Button
              variant="ghost"
              onClick={() => {
                setSelecionado(null);
              }}
            >
              Remover vínculo
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={selecionado === projetoIdAtual}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
