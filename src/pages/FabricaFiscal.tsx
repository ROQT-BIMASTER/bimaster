import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Package, Receipt, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DadosFiscaisProdutoDialog } from "@/components/fabrica/DadosFiscaisProdutoDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Produto {
  id: string;
  codigo: string;
  nome: string;
  status: string;
  categoria?: {
    nome: string;
  };
  unidade_medida?: {
    sigla: string;
  };
  dados_fiscais?: {
    ncm?: string;
    cfop_padrao?: string;
    cst_icms?: string;
  } | null;
}

export default function FabricaFiscal() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProdutoId, setSelectedProdutoId] = useState<string | null>(null);
  const [selectedProdutoNome, setSelectedProdutoNome] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: produtos, isLoading } = useQuery({
    queryKey: ["produtos-fiscal", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("fabrica_materias_primas")
        .select(`
          id,
          codigo,
          nome,
          status,
          categoria:fabrica_categorias_mp(nome),
          unidade_medida:fabrica_unidades_medida(sigla),
          dados_fiscais:fabrica_dados_fiscais_produto(
            ncm,
            cfop_padrao,
            cst_icms
          )
        `)
        .order("nome");

      if (searchTerm) {
        query = query.or(`codigo.ilike.%${searchTerm}%,nome.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as unknown as Produto[];
    },
  });

  const handleConfigFiscal = (produto: Produto) => {
    setSelectedProdutoId(produto.id);
    setSelectedProdutoNome(produto.nome);
    setDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Receipt className="h-8 w-8" />
              Gestão Fiscal
            </h1>
            <p className="text-muted-foreground">
              Configure os dados fiscais e tributários dos produtos
            </p>
          </div>
          <Button 
            onClick={() => window.location.href = '/dashboard/fabrica/tabela-impostos'}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Tabela de Impostos
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Produtos
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{produtos?.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                Produtos cadastrados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Com Dados Fiscais
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {produtos?.filter(p => p.dados_fiscais).length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Produtos configurados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pendentes
              </CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {produtos?.filter(p => !p.dados_fiscais).length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Sem configuração fiscal
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pesquisa e Tabela */}
        <Card>
          <CardHeader>
            <CardTitle>Produtos Cadastrados</CardTitle>
            <CardDescription>
              Clique em um produto para configurar os dados fiscais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código ou nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando produtos...
                </div>
              ) : !produtos || produtos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum produto encontrado
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>UN</TableHead>
                        <TableHead>NCM</TableHead>
                        <TableHead>CFOP</TableHead>
                        <TableHead>Status Fiscal</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {produtos.map((produto) => {
                        const temDadosFiscais = !!produto.dados_fiscais;
                        const dadosFiscais = produto.dados_fiscais;

                        return (
                          <TableRow key={produto.id}>
                            <TableCell className="font-medium">
                              {produto.codigo}
                            </TableCell>
                            <TableCell>{produto.nome}</TableCell>
                            <TableCell>
                              {produto.categoria?.nome || "-"}
                            </TableCell>
                            <TableCell>
                              {produto.unidade_medida?.sigla || "-"}
                            </TableCell>
                            <TableCell>
                              {dadosFiscais?.ncm || "-"}
                            </TableCell>
                            <TableCell>
                              {dadosFiscais?.cfop_padrao || "-"}
                            </TableCell>
                            <TableCell>
                              {temDadosFiscais ? (
                                <Badge variant="default" className="bg-green-500">
                                  Configurado
                                </Badge>
                              ) : (
                                <Badge variant="destructive">
                                  Pendente
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleConfigFiscal(produto)}
                              >
                                {temDadosFiscais ? "Editar" : "Configurar"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <DadosFiscaisProdutoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        produtoId={selectedProdutoId || ""}
        produtoNome={selectedProdutoNome}
      />
    </DashboardLayout>
  );
}
