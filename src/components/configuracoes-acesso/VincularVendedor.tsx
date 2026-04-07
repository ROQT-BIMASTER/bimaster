import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSystemProfiles } from "@/hooks/useSystemProfiles";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Save, UserCheck, X } from "lucide-react";
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

interface DimVendedor {
  cod_vend: number;
  nome_vendedor: string;
  cod_equipe: number | null;
  nome_equipe: string | null;
  supervisor: string | null;
  user_id: string | null;
}

const VincularVendedor = () => {
  const [search, setSearch] = useState("");
  const [changes, setChanges] = useState<Record<number, string | null>>({});
  const [confirmSave, setConfirmSave] = useState<{ codVend: number; userId: string | null; userName: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: vendedores, isLoading } = useQuery({
    queryKey: ["dim-vendedores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dim_vendedor")
        .select("cod_vend, nome_vendedor, cod_equipe, nome_equipe, supervisor, user_id")
        .order("nome_vendedor");
      if (error) throw error;
      return data as DimVendedor[];
    },
  });

  const { data: profiles } = useSystemProfiles();

  const updateMutation = useMutation({
    mutationFn: async ({ codVend, userId }: { codVend: number; userId: string | null }) => {
      const { data, error } = await supabase
        .from("dim_vendedor")
        .update({ user_id: userId })
        .eq("cod_vend", codVend)
        .select("cod_vend");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Não foi possível salvar. Verifique suas permissões de administrador.");
      }
    },
    onSuccess: (_, { codVend }) => {
      toast.success("Vendedor vinculado com sucesso!");
      setChanges((prev) => {
        const next = { ...prev };
        delete next[codVend];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["dim-vendedores"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao vincular: ${err.message}`);
    },
  });

  const filtered = vendedores?.filter((v) =>
    v.nome_vendedor.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectChange = (codVend: number, value: string) => {
    setChanges((prev) => ({
      ...prev,
      [codVend]: value === "__none__" ? null : value,
    }));
  };

  const handleSave = (v: DimVendedor) => {
    const userId = changes[v.cod_vend] ?? null;
    const userName = userId
      ? profiles?.find((p) => p.id === userId)?.nome || "Usuário"
      : "Nenhum";
    setConfirmSave({ codVend: v.cod_vend, userId, userName });
  };

  const confirmAction = () => {
    if (confirmSave) {
      updateMutation.mutate({ codVend: confirmSave.codVend, userId: confirmSave.userId });
      setConfirmSave(null);
    }
  };

  const getCurrentValue = (v: DimVendedor) => {
    if (v.cod_vend in changes) return changes[v.cod_vend] || "__none__";
    return v.user_id || "__none__";
  };

  const hasChange = (v: DimVendedor) => {
    return v.cod_vend in changes && changes[v.cod_vend] !== v.user_id;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          Vincular Vendedores a Usuários
        </CardTitle>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar vendedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando vendedores...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Cód.</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Vendedor</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Equipe</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Supervisor</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground min-w-[250px]">Usuário do Sistema</th>
                  <th className="text-center py-2 px-3 font-medium text-muted-foreground">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered?.map((v) => (
                  <tr key={v.cod_vend} className={`border-b hover:bg-muted/50 ${hasChange(v) ? "bg-accent/20" : ""}`}>
                    <td className="py-2 px-3">{v.cod_vend}</td>
                    <td className="py-2 px-3 font-medium">{v.nome_vendedor}</td>
                    <td className="py-2 px-3">{v.nome_equipe || "—"}</td>
                    <td className="py-2 px-3">{v.supervisor || "—"}</td>
                    <td className="py-2 px-3">
                      <Select value={getCurrentValue(v)} onValueChange={(val) => handleSelectChange(v.cod_vend, val)}>
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
                        variant={hasChange(v) ? "default" : "ghost"}
                        disabled={!hasChange(v) || updateMutation.isPending}
                        onClick={() => handleSave(v)}
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
              <p className="text-center py-8 text-muted-foreground">Nenhum vendedor encontrado.</p>
            )}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!confirmSave} onOpenChange={() => setConfirmSave(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar vinculação</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja vincular o vendedor ao usuário <strong>{confirmSave?.userName}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default VincularVendedor;
