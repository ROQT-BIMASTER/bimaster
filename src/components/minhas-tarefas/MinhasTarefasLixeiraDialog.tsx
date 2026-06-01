import { useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Trash2, RotateCcw, CalendarClock } from "lucide-react";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface LixeiraItem {
  id: string;
  titulo: string;
  projeto_id: string | null;
  excluida_em: string;
  parent_tarefa_id: string | null;
  criador_id: string | null;
  projeto: { nome: string | null; cor: string | null } | null;
}

const RETENTION_DAYS = 30;

function thirtyDaysAgoIso() {
  return new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function useMinhasTarefasLixeiraCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["minhas-tarefas-lixeira-count", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const cutoff = thirtyDaysAgoIso();
      const { count, error } = await supabase
        .from("projeto_tarefas")
        .select("id", { count: "exact", head: true })
        .not("excluida_em", "is", null)
        .gte("excluida_em", cutoff)
        .or(`criador_id.eq.${user!.id},excluida_por.eq.${user!.id}`);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function MinhasTarefasLixeiraDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["minhas-tarefas-lixeira", user?.id],
    enabled: open && !!user?.id,
    queryFn: async () => {
      const cutoff = thirtyDaysAgoIso();
      const { data, error } = await supabase
        .from("projeto_tarefas")
        .select("id, titulo, projeto_id, excluida_em, parent_tarefa_id, criador_id, projeto:projetos(nome, cor)")
        .not("excluida_em", "is", null)
        .gte("excluida_em", cutoff)
        .or(`criador_id.eq.${user!.id},excluida_por.eq.${user!.id}`)
        .order("excluida_em" as any, { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as LixeiraItem[];
    },
  });

  const restaurar = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("Sem sessão.");
      const { error } = await supabase
        .from("projeto_tarefas")
        .update({ excluida_em: null, excluida_por: null } as any)
        .eq("id", id)
        .eq("criador_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["minhas-tarefas-lixeira", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["minhas-tarefas-lixeira-count", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2"] });
      queryClient.invalidateQueries({ queryKey: ["meus-projetos-recentes"] });
      toast.success("Tarefa restaurada");
    },
    onError: (err: Error) => toast.error(err.message || "Não foi possível restaurar a tarefa."),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, { nome: string; cor: string | null; itens: LixeiraItem[] }>();
    for (const it of items) {
      const key = it.projeto_id ?? "__sem_projeto__";
      const nome = it.projeto?.nome ?? "Sem projeto";
      const cor = it.projeto?.cor ?? null;
      if (!map.has(key)) map.set(key, { nome, cor, itens: [] });
      map.get(key)!.itens.push(it);
    }
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [items]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            Lixeira pessoal
          </DialogTitle>
          <DialogDescription>
            Tarefas excluídas por você nos últimos {RETENTION_DAYS} dias. Após esse prazo, são removidas definitivamente.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Trash2}
            title="Lixeira vazia"
            description={`Nenhuma tarefa excluída por você nos últimos ${RETENTION_DAYS} dias.`}
          />
        ) : (
          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="space-y-4">
              {grouped.map((g) => (
                <div key={g.nome}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    {g.cor && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.cor }} />}
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.nome}
                    </span>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1">{g.itens.length}</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {g.itens.map((t) => {
                      const expiraEmDias = Math.max(0, RETENTION_DAYS - differenceInDays(new Date(), new Date(t.excluida_em)));
                      const podeRestaurar = !!user?.id && t.criador_id === user.id;
                      return (
                        <div
                          key={t.id}
                          className="flex items-center gap-3 rounded-md border border-border/40 bg-card px-3 py-2"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {t.titulo}
                              {t.parent_tarefa_id && (
                                <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1">subtarefa</Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <CalendarClock className="h-3 w-3" />
                              Excluída {formatDistanceToNow(new Date(t.excluida_em), { addSuffix: true, locale: ptBR })}
                              <span className="opacity-60">·</span>
                              <span>expira em {expiraEmDias}d</span>
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 shrink-0"
                            disabled={!podeRestaurar || restaurar.isPending}
                            onClick={() => restaurar.mutate(t.id)}
                            title={podeRestaurar ? "Restaurar tarefa" : "Apenas o criador pode restaurar"}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Restaurar
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
