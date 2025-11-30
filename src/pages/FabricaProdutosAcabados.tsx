import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Package, Edit, Trash2 } from "lucide-react";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { NovoProdutoAcabadoDialog } from "@/components/fabrica/NovoProdutoAcabadoDialog";
import { toast } from "sonner";

export default function FabricaProdutosAcabados() {
  const { hasPermission, loading: permLoading } = useScreenPermissions();
  const [dialogNovo, setDialogNovo] = useState(false);
  const [produtoEdit, setProdutoEdit] = useState<any>(null);
  const [busca, setBusca] = useState("");

  const { data: produtos, isLoading, refetch } = useQuery({
    queryKey: ["fabrica-produtos-acabados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_produtos")
        .select(`
          *,
          formula:fabrica_formulas(id, versao),
          unidade:fabrica_unidades_medida(sigla, nome)
        `)
        .in("tipo", ["ACABADO", "INTER"])
        .order("nome");

      if (error) throw error;
      return data;
    },
  });

  if (permLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!hasPermission) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const produtosFiltrados = produtos?.filter(
    (p) =>
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      p.codigo.toLowerCase().includes(busca.toLowerCase())
  );

  const handleEditar = (produto: any) => {
    setProdutoEdit(produto);
    setDialogNovo(true);
  };

  const handleExcluir = async (produto: any) => {
    if (!confirm(`Tem certeza que deseja excluir o produto "${produto.nome}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("fabrica_produtos")
        .delete()
        .eq("id", produto.id);

      if (error) throw error;

      toast.success("Produto excluído com sucesso!");
      refetch();
    } catch (error: any) {
      console.error("Erro ao excluir produto:", error);
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  const tipoLabels = {
    ACABADO: "Acabado",
    INTER: "Intermediário",
    MP: "Matéria-Prima",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Produtos Acabados</h1>
            <p className="text-muted-foreground">
              Gerencie o catálogo de produtos fabricados
            </p>
          </div>
          <Button
            onClick={() => {
              setProdutoEdit(null);
              setDialogNovo(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{produtos?.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                {produtos?.filter((p) => p.ativo).length || 0} ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Acabados</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {produtos?.filter((p) => p.tipo === "ACABADO").length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Intermediários</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {produtos?.filter((p) => p.tipo === "INTER").length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Busca */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código ou nome..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando produtos...
              </div>
            ) : produtosFiltrados?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum produto encontrado
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fórmula</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produtosFiltrados?.map((produto) => (
                    <TableRow key={produto.id}>
                      <TableCell className="font-mono">{produto.codigo}</TableCell>
                      <TableCell className="font-medium">{produto.nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {tipoLabels[produto.tipo as keyof typeof tipoLabels]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {produto.formula ? (
                          <Badge variant="secondary">v{produto.formula.versao}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {produto.unidade?.sigla || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={produto.ativo ? "default" : "secondary"}>
                          {produto.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditar(produto)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExcluir(produto)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <NovoProdutoAcabadoDialog
        open={dialogNovo}
        onOpenChange={(open) => {
          setDialogNovo(open);
          if (!open) setProdutoEdit(null);
        }}
        produtoEdit={produtoEdit}
        onSuccess={() => {
          refetch();
          setProdutoEdit(null);
        }}
      />
    </DashboardLayout>
  );
}
