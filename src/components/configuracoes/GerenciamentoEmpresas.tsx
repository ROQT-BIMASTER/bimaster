import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Star, StarOff, Building2, Search } from "lucide-react";
import { toast } from "sonner";

interface VinculoEmpresa {
  id: string;
  user_id: string;
  empresa_id: number;
  is_primary: boolean;
  profile?: { id: string; nome: string; email: string } | null;
  empresa?: { id: number; nome: string; cnpj: string | null; uf: string | null; ativa: boolean } | null;
}

export function GerenciamentoEmpresas() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedEmpresaId, setSelectedEmpresaId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: usuarios, isLoading: loadingUsers } = useQuery({
    queryKey: ["usuarios-para-empresa"],
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

  const { data: empresas, isLoading: loadingEmpresas } = useQuery({
    queryKey: ["empresas-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, cnpj, uf, ativa")
        .eq("ativa", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: vinculos, isLoading: loadingVinculos } = useQuery({
    queryKey: ["user-empresa-vinculos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_empresas")
        .select(`
          id,
          user_id,
          empresa_id,
          is_primary,
          empresa:empresas(id, nome, cnpj, uf, ativa)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const userIds = [...new Set(data.map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", userIds);

      return data.map(v => ({
        ...v,
        empresa: v.empresa as unknown as VinculoEmpresa["empresa"],
        profile: profiles?.find(p => p.id === v.user_id) || null,
      })) as VinculoEmpresa[];
    },
  });

  const adicionarMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId || !selectedEmpresaId) {
        throw new Error("Selecione um usuário e uma empresa");
      }

      // Check if first empresa for this user → make primary
      const existingCount = vinculos?.filter(v => v.user_id === selectedUserId).length || 0;

      const { error } = await supabase
        .from("user_empresas")
        .insert({
          user_id: selectedUserId,
          empresa_id: parseInt(selectedEmpresaId, 10),
          is_primary: existingCount === 0,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empresa vinculada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["user-empresa-vinculos"] });
      queryClient.invalidateQueries({ queryKey: ["user-empresas"] });
      setDialogOpen(false);
      setSelectedUserId("");
      setSelectedEmpresaId("");
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate") || error.code === "23505") {
        toast.error("Este usuário já está vinculado a esta empresa");
      } else {
        toast.error("Erro ao vincular: " + error.message);
      }
    },
  });

  const removerMutation = useMutation({
    mutationFn: async (vinculo: VinculoEmpresa) => {
      const { error } = await supabase
        .from("user_empresas")
        .delete()
        .eq("id", vinculo.id);
      if (error) throw error;

      // If removing primary, set another as primary
      if (vinculo.is_primary) {
        const remaining = vinculos?.filter(
          v => v.user_id === vinculo.user_id && v.id !== vinculo.id
        );
        if (remaining && remaining.length > 0) {
          await supabase
            .from("user_empresas")
            .update({ is_primary: true })
            .eq("id", remaining[0].id);
        }
      }
    },
    onSuccess: () => {
      toast.success("Vínculo removido!");
      queryClient.invalidateQueries({ queryKey: ["user-empresa-vinculos"] });
      queryClient.invalidateQueries({ queryKey: ["user-empresas"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao remover: " + error.message);
    },
  });

  const togglePrimaryMutation = useMutation({
    mutationFn: async (vinculo: VinculoEmpresa) => {
      // Remove primary from all of this user's empresas
      const userVinculos = vinculos?.filter(v => v.user_id === vinculo.user_id) || [];
      for (const v of userVinculos) {
        if (v.is_primary) {
          await supabase
            .from("user_empresas")
            .update({ is_primary: false })
            .eq("id", v.id);
        }
      }
      // Set this one as primary
      const { error } = await supabase
        .from("user_empresas")
        .update({ is_primary: true })
        .eq("id", vinculo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empresa primária atualizada!");
      queryClient.invalidateQueries({ queryKey: ["user-empresa-vinculos"] });
      queryClient.invalidateQueries({ queryKey: ["user-empresas"] });
    },
    onError: (error: any) => {
      toast.error("Erro: " + error.message);
    },
  });

  const formatarCNPJ = (cnpj: string | null) => {
    if (!cnpj) return "—";
    const limpo = cnpj.replace(/\D/g, "");
    return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  const filteredVinculos = vinculos?.filter(v => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      v.profile?.nome?.toLowerCase().includes(term) ||
      v.profile?.email?.toLowerCase().includes(term) ||
      v.empresa?.nome?.toLowerCase().includes(term) ||
      v.empresa?.cnpj?.includes(searchTerm.replace(/\D/g, ""))
    );
  });

  // For the dialog: filter out empresas the selected user already has
  const empresasDisponiveis = empresas?.filter(emp => {
    if (!selectedUserId) return true;
    return !vinculos?.some(v => v.user_id === selectedUserId && v.empresa_id === emp.id);
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Gerenciamento de Empresas por Usuário
            </CardTitle>
            <CardDescription>
              Vincule usuários às empresas/filiais para controlar acesso aos dados
            </CardDescription>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Vincular Empresa
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuário, empresa ou CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {loadingVinculos ? (
          <div className="text-center py-8 text-muted-foreground">Carregando vínculos...</div>
        ) : !filteredVinculos || filteredVinculos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? "Nenhum resultado encontrado" : "Nenhum vínculo cadastrado"}
          </div>
        ) : (
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>UF</TableHead>
                  <TableHead className="text-center">Primária</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVinculos.map((vinculo) => (
                  <TableRow key={vinculo.id}>
                    <TableCell className="font-medium">{vinculo.profile?.nome || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{vinculo.profile?.email || "—"}</TableCell>
                    <TableCell>{vinculo.empresa?.nome || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{formatarCNPJ(vinculo.empresa?.cnpj || null)}</TableCell>
                    <TableCell>
                      {vinculo.empresa?.uf && (
                        <Badge variant="outline">{vinculo.empresa.uf}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {vinculo.is_primary ? (
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                          <Star className="h-3 w-3 mr-1 fill-current" />
                          Principal
                        </Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePrimaryMutation.mutate(vinculo)}
                          disabled={togglePrimaryMutation.isPending}
                          title="Definir como primária"
                        >
                          <StarOff className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
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
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Empresa a Usuário</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Usuário *</Label>
              <Select value={selectedUserId} onValueChange={(val) => { setSelectedUserId(val); setSelectedEmpresaId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o usuário..." />
                </SelectTrigger>
                <SelectContent>
                  {loadingUsers ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">Carregando...</div>
                  ) : (
                    usuarios?.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.nome} — {user.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Empresa *</Label>
              <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa..." />
                </SelectTrigger>
                <SelectContent>
                  {loadingEmpresas ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">Carregando...</div>
                  ) : empresasDisponiveis?.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      {selectedUserId 
                        ? "Este usuário já está vinculado a todas as empresas disponíveis" 
                        : "Selecione um usuário primeiro para ver as empresas disponíveis"}
                    </div>
                  ) : (
                    empresasDisponiveis?.map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.nome} {emp.cnpj ? `— ${formatarCNPJ(emp.cnpj)}` : ""} {emp.uf ? `(${emp.uf})` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => adicionarMutation.mutate()}
              disabled={adicionarMutation.isPending || !selectedUserId || !selectedEmpresaId}
            >
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
