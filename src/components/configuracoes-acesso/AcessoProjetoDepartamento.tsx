import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllDepartments } from "@/hooks/useUserDepartments";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Loader2, FolderKanban } from "lucide-react";
import { toast } from "sonner";

interface ProjetoDept {
  projeto_id: string;
  departamento_id: string;
}

export default function AcessoProjetoDepartamento() {
  const [busca, setBusca] = useState("");
  const queryClient = useQueryClient();

  const { data: allDepts = [], isLoading: loadingDepts } = useAllDepartments();

  const { data: projetos = [], isLoading: loadingProjetos } = useQuery({
    queryKey: ["admin-projetos-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, nome, cor, icone, status")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: vinculos = [], isLoading: loadingVinculos } = useQuery({
    queryKey: ["projeto-departamentos-vinculos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_departamentos")
        .select("projeto_id, departamento_id");
      if (error) throw error;
      return data as ProjetoDept[];
    },
  });

  const vinculoSet = useMemo(() => {
    const set = new Set<string>();
    vinculos.forEach(v => set.add(`${v.projeto_id}::${v.departamento_id}`));
    return set;
  }, [vinculos]);

  const toggleMutation = useMutation({
    mutationFn: async ({ projetoId, departamentoId, checked }: { projetoId: string; departamentoId: string; checked: boolean }) => {
      if (checked) {
        const { error } = await supabase
          .from("projeto_departamentos")
          .insert({ projeto_id: projetoId, departamento_id: departamentoId } as any);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("projeto_departamentos")
          .delete()
          .eq("projeto_id", projetoId)
          .eq("departamento_id", departamentoId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-departamentos-vinculos"] });
    },
    onError: (err: Error) => {
      toast.error("Erro ao atualizar vínculo: " + err.message);
    },
  });

  const projetosFiltrados = useMemo(() => {
    if (!busca.trim()) return projetos;
    const termo = busca.toLowerCase();
    return projetos.filter(p => p.nome.toLowerCase().includes(termo));
  }, [projetos, busca]);

  const isLoading = loadingDepts || loadingProjetos || loadingVinculos;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Acesso por Departamento</h2>
        <p className="text-sm text-muted-foreground">
          Defina quais departamentos podem visualizar cada projeto. Projetos sem departamentos vinculados ficam visíveis apenas para membros e criador.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar projeto..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-3">
        {projetosFiltrados.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum projeto encontrado.</p>
        )}

        {projetosFiltrados.map(projeto => (
          <div key={projeto.id} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: projeto.cor || "#6366f1" }}
              >
                <FolderKanban className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{projeto.nome}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{projeto.status}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {allDepts.map(dept => {
                const key = `${projeto.id}::${dept.id}`;
                const isChecked = vinculoSet.has(key);
                return (
                  <label key={dept.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        toggleMutation.mutate({
                          projetoId: projeto.id,
                          departamentoId: dept.id,
                          checked: !!checked,
                        });
                      }}
                    />
                    <span className="text-sm">{dept.nome}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
