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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  briefingId: string;
  projetoIdAtual: string | null;
  tarefaIdAtual?: string | null;
  onVinculado: (projetoId: string | null, nome: string | null, tarefaId?: string | null) => void;
}

interface Projeto {
  id: string;
  nome: string;
  status?: string | null;
}

interface Tarefa {
  id: string;
  titulo: string;
}

export function VincularProjetoDialog({
  open,
  onOpenChange,
  briefingId,
  projetoIdAtual,
  tarefaIdAtual = null,
  onVinculado,
}: Props) {
  const [busca, setBusca] = useState("");
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecionado, setSelecionado] = useState<string | null>(projetoIdAtual);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [tarefaSel, setTarefaSel] = useState<string | null>(tarefaIdAtual);
  const [loadingTarefas, setLoadingTarefas] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelecionado(projetoIdAtual);
    setTarefaSel(tarefaIdAtual);
    setBusca("");
  }, [open, projetoIdAtual, tarefaIdAtual]);

  useEffect(() => {
    if (!open) return;
    let canceled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        if (!canceled) {
          setProjetos([]);
          setLoading(false);
        }
        return;
      }

      const termo = busca.trim();
      const baseSelect = "id, nome, status";

      let q1 = supabase
        .from("projetos")
        .select(baseSelect)
        .eq("criador_id", uid)
        .order("nome")
        .limit(30);
      if (termo) q1 = q1.ilike("nome", `%${termo}%`);

      const { data: membros } = await supabase
        .from("projeto_membros")
        .select("projeto_id")
        .eq("user_id", uid);
      const ids = (membros ?? []).map((m: any) => m.projeto_id).filter(Boolean);

      let q2Promise: any = Promise.resolve({ data: [] as Projeto[], error: null });
      if (ids.length > 0) {
        let q2 = supabase
          .from("projetos")
          .select(baseSelect)
          .in("id", ids)
          .order("nome")
          .limit(30);
        if (termo) q2 = q2.ilike("nome", `%${termo}%`);
        q2Promise = q2;
      }

      const [r1, r2] = await Promise.all([q1, q2Promise]);
      if (canceled) return;

      if (r1.error || r2.error) {
        toast.error("Erro ao buscar projetos");
      }

      const map = new Map<string, Projeto>();
      [...(r1.data ?? []), ...(r2.data ?? [])].forEach((p: any) => {
        if (p?.id) map.set(p.id, p as Projeto);
      });
      const merged = Array.from(map.values())
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .slice(0, 30);

      setProjetos(merged);
      setLoading(false);
    }, 250);
    return () => {
      canceled = true;
      clearTimeout(t);
    };
  }, [busca, open]);

  // Carregar tarefas do projeto selecionado
  useEffect(() => {
    if (!open || !selecionado) {
      setTarefas([]);
      return;
    }
    let canceled = false;
    setLoadingTarefas(true);
    (async () => {
      const { data, error } = await supabase
        .from("projeto_tarefas")
        .select("id, titulo")
        .eq("projeto_id", selecionado)
        .order("titulo")
        .limit(200);
      if (canceled) return;
      if (error) {
        toast.error("Erro ao carregar tarefas");
        setTarefas([]);
      } else {
        setTarefas((data ?? []) as Tarefa[]);
      }
      setLoadingTarefas(false);
    })();
    return () => {
      canceled = true;
    };
  }, [open, selecionado]);

  // Reset tarefa se trocou o projeto
  useEffect(() => {
    if (selecionado !== projetoIdAtual) {
      setTarefaSel(null);
    }
  }, [selecionado, projetoIdAtual]);

  const salvar = async () => {
    const escolhido = projetos.find((p) => p.id === selecionado);
    const payload: Record<string, any> = {
      projeto_id: selecionado,
      tarefa_id: selecionado ? tarefaSel : null,
    };
    const { error } = await supabase
      .from("briefings")
      .update(payload)
      .eq("id", briefingId);
    if (error) {
      toast.error(error.message || "Erro ao vincular projeto");
      return;
    }
    toast.success(selecionado ? "Vínculo salvo" : "Vínculo removido");
    onVinculado(selecionado, escolhido?.nome ?? null, selecionado ? tarefaSel : null);
    onOpenChange(false);
  };

  const semMudanca =
    selecionado === projetoIdAtual && (tarefaSel ?? null) === (tarefaIdAtual ?? null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular a projeto e tarefa</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Projeto
            </Label>
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

            <ScrollArea className="h-48 -mx-2 px-2 border rounded-md">
              {loading ? (
                <div className="text-xs text-muted-foreground py-6 text-center">
                  Buscando…
                </div>
              ) : projetos.length === 0 ? (
                <div className="text-xs text-muted-foreground py-6 text-center">
                  Nenhum projeto encontrado.
                </div>
              ) : (
                <div className="space-y-1 p-1">
                  {projetos.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setSelecionado(p.id === selecionado ? null : p.id)
                      }
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
          </div>

          {selecionado && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Tarefa (opcional)
              </Label>
              <Select
                value={tarefaSel ?? "__none"}
                onValueChange={(v) => setTarefaSel(v === "__none" ? null : v)}
                disabled={loadingTarefas}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingTarefas ? "Carregando tarefas…" : "Sem tarefa específica"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sem tarefa específica</SelectItem>
                  {tarefas.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {projetoIdAtual && (
            <Button
              variant="ghost"
              onClick={() => {
                setSelecionado(null);
                setTarefaSel(null);
              }}
            >
              Remover vínculo
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={semMudanca}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
