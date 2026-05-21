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

      // 1) projetos criados pelo usuário
      let q1 = supabase
        .from("projetos")
        .select(baseSelect)
        .eq("criado_por", uid)
        .order("nome")
        .limit(30);
      if (termo) q1 = q1.ilike("nome", `%${termo}%`);

      // 2) projetos onde o usuário é membro
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
