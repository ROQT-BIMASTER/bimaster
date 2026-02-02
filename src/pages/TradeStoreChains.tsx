import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2 } from "lucide-react";
import { NovaRedeDialog } from "@/components/trade/NovaRedeDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface StoreChain {
  id: string;
  name: string;
  cnpj: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  active: boolean;
}

export default function TradeStoreChains() {
  const { toast } = useToast();
  const [chains, setChains] = useState<StoreChain[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchChains();
  }, []);

  const fetchChains = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("store_chains")
        .select("*")
        .eq("active", true)
        .order("name");

      if (error) throw error;
      setChains(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar redes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("store_chains")
        .update({ active: false })
        .eq("id", deleteId);

      if (error) throw error;

      toast({
        title: "Rede removida",
        description: "A rede foi desativada com sucesso.",
      });

      fetchChains();
      setDeleteId(null);
    } catch (error: any) {
      toast({
        title: "Erro ao remover rede",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleBreadcrumb 
          moduleName="Trade Marketing" 
          moduleHref="/dashboard/trade" 
          currentPage="Redes de Lojas" 
        />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Redes de Lojas</h1>
            <p className="text-muted-foreground">
              Gerencie redes e grupos de lojas
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Rede
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : chains.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    Nenhuma rede cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                chains.map((chain) => (
                  <TableRow key={chain.id}>
                    <TableCell className="font-medium">{chain.name}</TableCell>
                    <TableCell>{chain.cnpj || "-"}</TableCell>
                    <TableCell>{chain.contact_name || "-"}</TableCell>
                    <TableCell>{chain.contact_phone || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(chain.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <NovaRedeDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={fetchChains}
        />

        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja desativar esta rede? As lojas vinculadas não serão afetadas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Desativar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}