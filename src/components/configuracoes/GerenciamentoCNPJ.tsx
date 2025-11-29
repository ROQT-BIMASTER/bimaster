import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function GerenciamentoCNPJ() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [cnpjInput, setCnpjInput] = useState("");

  const { data: usuarios, isLoading: loadingUsers } = useQuery({
    queryKey: ["usuarios-para-cnpj"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .eq("status", "ativo")
        .order("nome");

      if (error) throw error;
      return data;
    },
  });

  const { data: vinculos, isLoading: loadingVinculos, refetch } = useQuery({
    queryKey: ["user-cnpj-vinculos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_cnpj")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Buscar perfis separadamente
      if (!data || data.length === 0) return [];

      const userIds = [...new Set(data.map(d => d.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Fazer merge manual
      return data.map(vinculo => ({
        ...vinculo,
        profile: profiles?.find(p => p.id === vinculo.user_id),
      }));
    },
  });

  const adicionarMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId || !cnpjInput) {
        throw new Error("Selecione um usuário e informe o CNPJ");
      }

      const cnpjLimpo = cnpjInput.replace(/\D/g, "");
      if (cnpjLimpo.length !== 14) {
        throw new Error("CNPJ inválido. Deve conter 14 dígitos");
      }

      const { error } = await supabase
        .from("user_cnpj")
        .insert({
          user_id: selectedUserId,
          cnpj: cnpjLimpo,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("CNPJ vinculado com sucesso!");
      refetch();
      setDialogOpen(false);
      setSelectedUserId("");
      setCnpjInput("");
    },
    onError: (error: any) => {
      toast.error("Erro ao vincular CNPJ: " + error.message);
    },
  });

  const removerMutation = useMutation({
    mutationFn: async (vinculo: any) => {
      const { error } = await supabase
        .from("user_cnpj")
        .delete()
        .eq("user_id", vinculo.user_id)
        .eq("cnpj", vinculo.cnpj);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vínculo removido!");
      refetch();
    },
    onError: (error: any) => {
      toast.error("Erro ao remover: " + error.message);
    },
  });

  const formatarCNPJ = (cnpj: string) => {
    const limpo = cnpj.replace(/\D/g, "");
    return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gerenciamento de CNPJs</CardTitle>
            <CardDescription>
              Vincule usuários aos CNPJs para controlar acesso às tabelas de preço
            </CardDescription>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Vincular CNPJ
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loadingVinculos ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando vínculos...
          </div>
        ) : !vinculos || vinculos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum vínculo cadastrado
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vinculos.map((vinculo) => (
                <TableRow key={`${vinculo.user_id}-${vinculo.cnpj}`}>
                  <TableCell className="font-medium">
                    {vinculo.profile?.nome}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {vinculo.profile?.email}
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatarCNPJ(vinculo.cnpj)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removerMutation.mutate(vinculo)}
                      disabled={removerMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular CNPJ a Usuário</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="usuario">Usuário *</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o usuário..." />
                </SelectTrigger>
                <SelectContent>
                  {loadingUsers ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      Carregando...
                    </div>
                  ) : (
                    usuarios?.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.nome} - {user.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="cnpj">CNPJ *</Label>
              <Input
                id="cnpj"
                value={cnpjInput}
                onChange={(e) => setCnpjInput(e.target.value)}
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Digite apenas os números ou use formatação completa
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => adicionarMutation.mutate()}
              disabled={adicionarMutation.isPending}
            >
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
