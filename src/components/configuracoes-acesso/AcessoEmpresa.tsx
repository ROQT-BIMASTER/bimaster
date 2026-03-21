import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSystemProfiles } from "@/hooks/useSystemProfiles";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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

interface DimEmpresa {
  id_empresa: number;
  nome_empresa: string;
}

interface UserEmpresaAccess {
  id: string;
  user_id: string;
  id_empresa: number;
}

const AcessoEmpresa = () => {
  const [selectedUser, setSelectedUser] = useState<Record<number, string>>({});
  const [confirmAdd, setConfirmAdd] = useState<{ empresa: DimEmpresa; userId: string; userName: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ accessId: string; userName: string; empresaNome: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: empresas, isLoading: loadingEmpresas } = useQuery({
    queryKey: ["dim-empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dim_empresa")
        .select("id_empresa, nome_empresa")
        .order("nome_empresa");
      if (error) throw error;
      return data as DimEmpresa[];
    },
  });

  const { data: accesses, isLoading: loadingAccesses } = useQuery({
    queryKey: ["user-empresa-access-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_empresa_access")
        .select("id, user_id, id_empresa");
      if (error) throw error;
      return data as UserEmpresaAccess[];
    },
  });

  const { data: profiles } = useSystemProfiles();

  const addMutation = useMutation({
    mutationFn: async ({ userId, idEmpresa }: { userId: string; idEmpresa: number }) => {
      const { error } = await supabase
        .from("user_empresa_access")
        .insert({ user_id: userId, id_empresa: idEmpresa });
      if (error) throw error;
    },
    onSuccess: (_, { idEmpresa }) => {
      toast.success("Acesso concedido com sucesso!");
      setSelectedUser((prev) => {
        const next = { ...prev };
        delete next[idEmpresa];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["user-empresa-access-all"] });
    },
    onError: (err: Error) => {
      if (err.message.includes("duplicate")) {
        toast.error("Este usuário já tem acesso a esta empresa.");
      } else {
        toast.error(`Erro: ${err.message}`);
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (accessId: string) => {
      const { error } = await supabase
        .from("user_empresa_access")
        .delete()
        .eq("id", accessId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acesso removido com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["user-empresa-access-all"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover: ${err.message}`);
    },
  });

  const getAccessesForEmpresa = (idEmpresa: number) =>
    accesses?.filter((a) => a.id_empresa === idEmpresa) || [];

  const getProfileName = (userId: string) => {
    const p = profiles?.find((pr) => pr.id === userId);
    return p?.nome || p?.email || userId.slice(0, 8);
  };

  const handleAddClick = (empresa: DimEmpresa) => {
    const userId = selectedUser[empresa.id_empresa];
    if (!userId) return;
    const userName = getProfileName(userId);
    setConfirmAdd({ empresa, userId, userName });
  };

  const isLoading = loadingEmpresas || loadingAccesses;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Acesso por Empresa
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando empresas...</p>
        ) : (
          <div className="space-y-6">
            {empresas?.map((empresa) => {
              const empresaAccesses = getAccessesForEmpresa(empresa.id_empresa);
              return (
                <div key={empresa.id_empresa} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      {empresa.nome_empresa}
                      <Badge variant="secondary" className="ml-2">{empresaAccesses.length} usuários</Badge>
                    </h3>
                  </div>

                  {empresaAccesses.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {empresaAccesses.map((access) => (
                        <div key={access.id} className="flex items-center gap-1 bg-muted rounded-full px-3 py-1 text-sm">
                          <Users className="h-3 w-3" />
                          <span>{getProfileName(access.user_id)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 ml-1 hover:bg-destructive/20 hover:text-destructive"
                            onClick={() => setConfirmRemove({ accessId: access.id, userName: getProfileName(access.user_id), empresaNome: empresa.nome_empresa })}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedUser[empresa.id_empresa] || ""}
                      onValueChange={(val) => setSelectedUser((prev) => ({ ...prev, [empresa.id_empresa]: val }))}
                    >
                      <SelectTrigger className="h-8 flex-1 max-w-xs">
                        <SelectValue placeholder="Selecionar usuário..." />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles?.filter((p) => !empresaAccesses.some((a) => a.user_id === p.id)).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome || p.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={!selectedUser[empresa.id_empresa] || addMutation.isPending}
                      onClick={() => handleAddClick(empresa)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!confirmAdd} onOpenChange={() => setConfirmAdd(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conceder acesso</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja conceder acesso de <strong>{confirmAdd?.userName}</strong> à empresa <strong>{confirmAdd?.empresa.nome_empresa}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmAdd) { addMutation.mutate({ userId: confirmAdd.userId, idEmpresa: confirmAdd.empresa.id_empresa }); setConfirmAdd(null); } }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmRemove} onOpenChange={() => setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover o acesso de <strong>{confirmRemove?.userName}</strong> da empresa <strong>{confirmRemove?.empresaNome}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (confirmRemove) { removeMutation.mutate(confirmRemove.accessId); setConfirmRemove(null); } }}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default AcessoEmpresa;
