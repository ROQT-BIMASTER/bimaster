import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, Plus, Search, Edit, Trash2, Building2, Package } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { VincularProdutoDialog } from "@/components/estoque/VincularProdutoDialog";
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

export default function EstoqueVinculacoes() {
  const [search, setSearch] = useState("");
  const [distribuidoraFilter, setDistribuidoraFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: distribuidoras } = useQuery({
    queryKey: ['estoque-distribuidoras-select'],
    queryFn: async () => {
      const { data } = await supabase
        .from('estoque_distribuidoras')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      return data || [];
    }
  });

  const { data: vinculacoes, isLoading } = useQuery({
    queryKey: ['estoque-vinculacoes', search, distribuidoraFilter],
    queryFn: async () => {
      let query = supabase
        .from('estoque_produtos_distribuidora')
        .select(`
          *,
          estoque_produtos_master (id, nome, sku_master, unidade_medida),
          estoque_distribuidoras (id, nome, cnpj)
        `)
        .order('created_at', { ascending: false });
      
      if (search) {
        query = query.or(`codigo_produto_distribuidora.ilike.%${search}%,nome_exibicao.ilike.%${search}%`);
      }
      
      if (distribuidoraFilter && distribuidoraFilter !== "all") {
        query = query.eq('distribuidora_id', distribuidoraFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('estoque_produtos_distribuidora')
        .update({ ativo: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-vinculacoes'] });
      toast({ title: "Vinculação desativada com sucesso" });
      setDeletingId(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao desativar", description: error.message, variant: "destructive" });
    }
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Link className="h-6 w-6 text-primary" />
              Vinculações de Produtos
            </h1>
            <p className="text-muted-foreground">Relacione produtos master com códigos das distribuidoras</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Vinculação
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código ou nome..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={distribuidoraFilter} onValueChange={setDistribuidoraFilter}>
                <SelectTrigger className="w-[220px]">
                  <Building2 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Distribuidora" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas distribuidoras</SelectItem>
                  {distribuidoras?.map((dist) => (
                    <SelectItem key={dist.id} value={dist.id}>{dist.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto Master</TableHead>
                    <TableHead>Distribuidora</TableHead>
                    <TableHead>Código Distribuidora</TableHead>
                    <TableHead>Nome Exibição</TableHead>
                    <TableHead>Fator Conversão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vinculacoes?.map((vinc: any) => (
                    <TableRow key={vinc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{vinc.estoque_produtos_master?.nome}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {vinc.estoque_produtos_master?.sku_master}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {vinc.estoque_distribuidoras?.nome}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{vinc.codigo_produto_distribuidora}</TableCell>
                      <TableCell>{vinc.nome_exibicao || '-'}</TableCell>
                      <TableCell>{vinc.fator_conversao}x</TableCell>
                      <TableCell>
                        <Badge variant={vinc.ativo ? "default" : "secondary"}>
                          {vinc.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => {
                              setEditingItem(vinc);
                              setDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setDeletingId(vinc.id)}
                            disabled={!vinc.ativo}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {vinculacoes?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhuma vinculação encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <VincularProdutoDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditingItem(null);
          }}
          editingItem={editingItem}
        />

        <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desativar vinculação?</AlertDialogTitle>
              <AlertDialogDescription>
                A vinculação será desativada. Esta ação pode ser revertida.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingId && deleteMutation.mutate(deletingId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Desativar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
