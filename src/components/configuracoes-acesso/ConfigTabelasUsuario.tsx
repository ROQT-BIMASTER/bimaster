import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useSystemProfiles } from "@/hooks/useSystemProfiles";
import { Table, X, Search } from "lucide-react";

export default function ConfigTabelasUsuario() {
  const queryClient = useQueryClient();
  const { data: profiles, isLoading: profilesLoading } = useSystemProfiles();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const { data: tabelas } = useQuery({
    queryKey: ["distinct-tabelas-preco"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendas_union")
        .select("tabela")
        .not("tabela", "is", null)
        .limit(1000);
      return [...new Set((data || []).map((d: any) => d.tabela).filter(Boolean))].sort() as string[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: userTabelas, isLoading } = useQuery({
    queryKey: ["config-tabelas-usuario"],
    queryFn: async () => {
      const { data, error } = await supabase.from("config_tabelas_usuario").select("*");
      if (error) throw error;
      return data as { id: string; user_id: string; tabela_preco: string }[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async ({ userId, tabela }: { userId: string; tabela: string }) => {
      const { error } = await supabase
        .from("config_tabelas_usuario")
        .insert({ user_id: userId, tabela_preco: tabela });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config-tabelas-usuario"] });
      toast.success("Tabela de preço adicionada!");
    },
    onError: () => toast.error("Erro ao adicionar tabela"),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("config_tabelas_usuario").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config-tabelas-usuario"] });
      toast.success("Acesso removido!");
    },
    onError: () => toast.error("Erro ao remover acesso"),
  });

  const filteredProfiles = (profiles || []).filter(
    (p) => p.nome?.toLowerCase().includes(search.toLowerCase()) || p.email?.toLowerCase().includes(search.toLowerCase())
  );

  const getUserTabelas = (userId: string) =>
    (userTabelas || []).filter((t) => t.user_id === userId);

  const getAvailableTabelas = (userId: string) => {
    const assigned = new Set(getUserTabelas(userId).map((t) => t.tabela_preco));
    return (tabelas || []).filter((t) => !assigned.has(t));
  };

  if (isLoading || profilesLoading) {
    return <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Table className="h-4 w-4" />
          Tabelas de Preço por Usuário
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xs text-muted-foreground mb-2">
          Defina quais tabelas de preço cada usuário pode visualizar nos dashboards. Admins veem tudo automaticamente.
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {filteredProfiles.map((profile) => {
            const assigned = getUserTabelas(profile.id);
            const available = getAvailableTabelas(profile.id);
            const isExpanded = selectedUser === profile.id;

            return (
              <div key={profile.id} className="border border-border rounded-lg p-3">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setSelectedUser(isExpanded ? null : profile.id)}
                >
                  <div>
                    <span className="text-sm font-medium">{profile.nome || "Sem nome"}</span>
                    <span className="text-xs text-muted-foreground ml-2">{profile.email}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {assigned.length} tabela{assigned.length !== 1 ? "s" : ""}
                  </Badge>
                </div>

                {isExpanded && (
                  <div className="mt-3 space-y-2">
                    {/* Assigned */}
                    <div className="flex flex-wrap gap-1.5">
                      {assigned.map((t) => (
                        <Badge key={t.id} variant="default" className="text-xs gap-1">
                          {t.tabela_preco}
                          <button onClick={() => removeMutation.mutate(t.id)} className="cursor-pointer">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      {assigned.length === 0 && (
                        <span className="text-xs text-muted-foreground italic">Nenhuma tabela atribuída (sem restrição se admin)</span>
                      )}
                    </div>

                    {/* Add */}
                    {available.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-2 border-t border-border">
                        <span className="text-xs text-muted-foreground w-full mb-1">Adicionar:</span>
                        {available.slice(0, 20).map((t) => (
                          <Button
                            key={t}
                            variant="outline"
                            size="sm"
                            className="text-xs h-6 px-2"
                            onClick={() => addMutation.mutate({ userId: profile.id, tabela: t })}
                          >
                            + {t}
                          </Button>
                        ))}
                        {available.length > 20 && (
                          <span className="text-xs text-muted-foreground">...e mais {available.length - 20}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
