import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSystemProfiles } from "@/hooks/useSystemProfiles";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Save, Users, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DimSupervisor {
  id: string;
  nome_supervisor: string;
  user_id: string | null;
}

const VincularSupervisor = () => {
  const [search, setSearch] = useState("");
  const [changes, setChanges] = useState<Record<string, string | null>>({});
  const [confirmSave, setConfirmSave] = useState<{ id: string; userId: string | null; userName: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: supervisores, isLoading } = useQuery({
    queryKey: ["dim-supervisores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dim_supervisor")
        .select("id, nome_supervisor, user_id")
        .order("nome_supervisor");
      if (error) throw error;
      return data as DimSupervisor[];
    },
  });

  const { data: profiles } = useSystemProfiles();

  const updateMutation = useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string | null }) => {
      const { error } = await supabase
        .from("dim_supervisor")
        .update({ user_id: userId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { id }) => {
      toast.success("Supervisor vinculado com sucesso!");
      setChanges((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["dim-supervisores"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao vincular: ${err.message}`);
    },
  });

  const filtered = supervisores?.filter((s) =>
    s.nome_supervisor.toLowerCase().includes(search.toLowerCase())
  );

  const getCurrentValue = (s: DimSupervisor) => {
    if (s.id in changes) return changes[s.id] || "__none__";
    return s.user_id || "__none__";
  };

  const hasChange = (s: DimSupervisor) => {
    return s.id in changes && changes[s.id] !== s.user_id;
  };

  const handleSave = (s: DimSupervisor) => {
    const userId = changes[s.id] ?? null;
    const userName = userId
      ? profiles?.find((p) => p.id === userId)?.nome || "Usuário"
      : "Nenhum";
    setConfirmSave({ id: s.id, userId, userName });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Vincular Supervisores a Usuários
        </CardTitle>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar supervisor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando supervisores...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Supervisor</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground min-w-[250px]">Usuário do Sistema</th>
                  <th className="text-center py-2 px-3 font-medium text-muted-foreground">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered?.map((s) => (
                  <tr key={s.id} className={`border-b hover:bg-muted/50 ${hasChange(s) ? "bg-accent/20" : ""}`}>
                    <td className="py-2 px-3 font-medium">{s.nome_supervisor}</td>
                    <td className="py-2 px-3">
                      <Select value={getCurrentValue(s)} onValueChange={(val) => setChanges((prev) => ({ ...prev, [s.id]: val === "__none__" ? null : val }))}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Selecionar usuário..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <X className="h-3 w-3" /> Sem vínculo
                            </span>
                          </SelectItem>
                          {profiles?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nome || p.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <Button
                        size="sm"
                        variant={hasChange(s) ? "default" : "ghost"}
                        disabled={!hasChange(s) || updateMutation.isPending}
                        onClick={() => handleSave(s)}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Salvar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered?.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">Nenhum supervisor encontrado.</p>
            )}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!confirmSave} onOpenChange={() => setConfirmSave(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar vinculação</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja vincular o supervisor ao usuário <strong>{confirmSave?.userName}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmSave) { updateMutation.mutate({ id: confirmSave.id, userId: confirmSave.userId }); setConfirmSave(null); } }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default VincularSupervisor;
