import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link2, Trash2, Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface Props {
  tarefaId: string;
  projetoId: string;
}

interface Dependencia {
  id: string;
  tarefa_id: string;
  depende_de_id: string;
  tipo: string | null;
  created_at: string | null;
  depende_de?: { id: string; titulo: string; codigo: string | null; status: string };
  dependente?: { id: string; titulo: string; codigo: string | null; status: string };
}

export function ProjetoTarefaDependencias({ tarefaId, projetoId }: Props) {
  const queryClient = useQueryClient();
  const [selectedTarefa, setSelectedTarefa] = useState("");
  const [tipo, setTipo] = useState("terminar_antes");
  const [adding, setAdding] = useState(false);

  // All tasks in this project (for the select)
  const { data: allTarefas = [] } = useQuery({
    queryKey: ["projeto-tarefas-select", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefas")
        .select("id, titulo, codigo, status")
        .eq("projeto_id", projetoId)
        .neq("id", tarefaId)
        .is("parent_tarefa_id", null)
        .order("codigo", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Dependencies where this task depends on others
  const { data: dependsDe = [] } = useQuery({
    queryKey: ["tarefa-depends-de", tarefaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefa_dependencias")
        .select("*")
        .eq("tarefa_id", tarefaId);
      if (error) throw error;
      // Enrich with task info
      const ids = (data || []).map((d: any) => d.depende_de_id);
      if (ids.length === 0) return [];
      const { data: tarefas } = await supabase
        .from("projeto_tarefas")
        .select("id, titulo, codigo, status")
        .in("id", ids);
      return (data || []).map((d: any) => ({
        ...d,
        depende_de: (tarefas || []).find((t: any) => t.id === d.depende_de_id),
      })) as Dependencia[];
    },
  });

  // Dependencies where other tasks depend on this one
  const { data: dependentes = [] } = useQuery({
    queryKey: ["tarefa-dependentes", tarefaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefa_dependencias")
        .select("*")
        .eq("depende_de_id", tarefaId);
      if (error) throw error;
      const ids = (data || []).map((d: any) => d.tarefa_id);
      if (ids.length === 0) return [];
      const { data: tarefas } = await supabase
        .from("projeto_tarefas")
        .select("id, titulo, codigo, status")
        .in("id", ids);
      return (data || []).map((d: any) => ({
        ...d,
        dependente: (tarefas || []).find((t: any) => t.id === d.tarefa_id),
      })) as Dependencia[];
    },
  });

  const addDep = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projeto_tarefa_dependencias").insert({
        tarefa_id: tarefaId,
        depende_de_id: selectedTarefa,
        tipo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-depends-de", tarefaId] });
      setSelectedTarefa("");
      setAdding(false);
      toast.success("Dependência adicionada");
    },
    onError: () => toast.error("Erro ao adicionar dependência"),
  });

  const removeDep = useMutation({
    mutationFn: async (depId: string) => {
      const { error } = await supabase.from("projeto_tarefa_dependencias").delete().eq("id", depId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-depends-de", tarefaId] });
      queryClient.invalidateQueries({ queryKey: ["tarefa-dependentes", tarefaId] });
      toast.success("Dependência removida");
    },
  });

  const usedIds = new Set(dependsDe.map((d) => d.depende_de_id));
  const availableTarefas = allTarefas.filter((t) => !usedIds.has(t.id));

  const tipoLabel = (t: string | null) =>
    t === "iniciar_junto" ? "Iniciar junto" : "Terminar antes";

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium flex items-center gap-1.5">
        <Link2 className="h-3.5 w-3.5" />
        Dependências
      </h3>

      {/* This task depends on */}
      {dependsDe.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] uppercase text-muted-foreground font-medium tracking-wider">
            Depende de
          </span>
          {dependsDe.map((d) => (
            <div key={d.id} className="flex items-center gap-2 group text-xs bg-muted/50 rounded px-2 py-1.5">
              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="font-mono text-muted-foreground">{d.depende_de?.codigo}</span>
              <span className="flex-1 truncate">{d.depende_de?.titulo}</span>
              <Badge variant="outline" className="text-[10px] h-4">
                {tipoLabel(d.tipo)}
              </Badge>
              <button
                onClick={() => removeDep.mutate(d.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Other tasks depend on this */}
      {dependentes.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] uppercase text-muted-foreground font-medium tracking-wider">
            Bloqueia
          </span>
          {dependentes.map((d) => (
            <div key={d.id} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1.5">
              <ArrowRight className="h-3 w-3 text-amber-500 shrink-0 rotate-180" />
              <span className="font-mono text-muted-foreground">{d.dependente?.codigo}</span>
              <span className="flex-1 truncate">{d.dependente?.titulo}</span>
              <Badge variant="outline" className="text-[10px] h-4">
                {tipoLabel(d.tipo)}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Add new */}
      {adding ? (
        <div className="space-y-2 border rounded-md p-2 bg-muted/30">
          <Select value={selectedTarefa} onValueChange={setSelectedTarefa}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecionar tarefa..." />
            </SelectTrigger>
            <SelectContent>
              {availableTarefas.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-xs">
                  <span className="font-mono text-muted-foreground mr-1">{t.codigo}</span>
                  {t.titulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="terminar_antes" className="text-xs">Terminar antes</SelectItem>
              <SelectItem value="iniciar_junto" className="text-xs">Iniciar junto</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            <Button size="sm" className="h-7 text-xs" onClick={() => addDep.mutate()} disabled={!selectedTarefa || addDep.isPending}>
              Adicionar
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setAdding(true)}>
          <Plus className="h-3 w-3" /> Adicionar dependência
        </Button>
      )}
    </div>
  );
}
