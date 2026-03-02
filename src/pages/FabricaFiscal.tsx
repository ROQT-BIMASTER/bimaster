import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Package, Receipt, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DadosFiscaisProdutoDialog } from "@/components/fabrica/DadosFiscaisProdutoDialog";
import { ConfiguracaoEmpresaDialog } from "@/components/fabrica/ConfiguracaoEmpresaDialog";
import { CadastroNCMDialog } from "@/components/fabrica/CadastroNCMDialog";
import { CadastroRegrasFiscaisNCM } from "@/components/fabrica/CadastroRegrasFiscaisNCM";
import { IVADualTab } from "@/components/fabrica/IVADualTab";
import { useIVADualEnabled } from "@/hooks/fabrica/useIVADualEnabled";
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
  const { enabled: ivaEnabled } = useIVADualEnabled();

  const { data: produtos, isLoading } = useQuery({
    queryKey: ["produtos-fiscal", searchTerm],
    queryFn: async () => {
      // Buscar PRODUTOS ACABADOS
      let queryProdutos = supabase
        .from("fabrica_produtos")
        .select(`
          id,
          codigo,
          nome,
          tipo,
          ativo
        `)
        .order("nome");

      if (searchTerm) {
        queryProdutos = queryProdutos.or(`codigo.ilike.%${searchTerm}%,nome.ilike.%${searchTerm}%`);
      }

      // Buscar MATÉRIAS-PRIMAS
      let queryMPs = supabase
        .from("fabrica_materias_primas")
        .select(`
          id,
          codigo,
          nome,
          status
        `)
        .order("nome");

      if (searchTerm) {
        queryMPs = queryMPs.or(`codigo.ilike.%${searchTerm}%,nome.ilike.%${searchTerm}%`);
      }

      const [resProdutos, resMPs] = await Promise.all([
        queryProdutos,
        queryMPs
      ]);

      if (resProdutos.error) throw resProdutos.error;
      if (resMPs.error) throw resMPs.error;

      // Buscar dados fiscais para todos
      const todosProdutoIds = [
        ...(resProdutos.data || []).map(p => p.id),
        ...(resMPs.data || []).map(m => m.id)
      ];

      const { data: dadosFiscais } = await supabase
        .from("fabrica_dados_fiscais_produto")
        .select("produto_id, ncm, cfop_padrao, cst_icms")
        .in("produto_id", todosProdutoIds);

      const dadosFiscaisMap = new Map(
        (dadosFiscais || []).map(d => [d.produto_id, d])
      );

      // Combinar produtos e MPs
      const produtosFormatados = (resProdutos.data || []).map(p => ({
        id: p.id,
        codigo: p.codigo,
        nome: p.nome,
        status: p.ativo ? "ativo" : "inativo",
        tipo: p.tipo || "ACABADO",
        categoria: { nome: p.tipo || "Produto" },
        unidade_medida: { sigla: "-" },
        dados_fiscais: dadosFiscaisMap.get(p.id) || null
      }));

      const mpsFormatadas = (resMPs.data || []).map(m => ({
        id: m.id,
        codigo: m.codigo,
        nome: m.nome,
        status: m.status || "disponivel",
        tipo: "MP",
        categoria: { nome: "Matéria-Prima" },
        unidade_medida: { sigla: "-" },
        dados_fiscais: dadosFiscaisMap.get(m.id) || null
      }));

      return [...produtosFormatados, ...mpsFormatadas] as unknown as Produto[];
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
          <div className="flex gap-2">
            <ConfiguracaoEmpresaDialog />
            <CadastroNCMDialog />
            <CadastroRegrasFiscaisNCM />
            <Button 
              onClick={() => window.location.href = '/dashboard/fabrica/tabela-impostos'}
              variant="outline"
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Tabela de Impostos
            </Button>
          </div>
        </div>

        <Tabs defaultValue="produtos" className="w-full">
          <TabsList>
            <TabsTrigger value="produtos">Produtos</TabsTrigger>
            {ivaEnabled && <TabsTrigger value="iva">IVA Dual (CBS/IBS)</TabsTrigger>}
          </TabsList>

          <TabsContent value="produtos" className="space-y-6">
            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{produtos?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">Produtos cadastrados</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Com Dados Fiscais</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{produtos?.filter(p => p.dados_fiscais).length || 0}</div>
                  <p className="text-xs text-muted-foreground">Produtos configurados</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{produtos?.filter(p => !p.dados_fiscais).length || 0}</div>
                  <p className="text-xs text-muted-foreground">Sem configuração fiscal</p>
                </CardContent>
              </Card>
            </div>

            {/* Pesquisa e Tabela */}
            <Card>
              <CardHeader>
                <CardTitle>Produtos Cadastrados</CardTitle>
                <CardDescription>Clique em um produto para configurar os dados fiscais</CardDescription>
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
                    <div className="text-center py-8 text-muted-foreground">Carregando produtos...</div>
                  ) : !produtos || produtos.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">Nenhum produto encontrado</div>
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
                                <TableCell className="font-medium">{produto.codigo}</TableCell>
                                <TableCell>{produto.nome}</TableCell>
                                <TableCell>{produto.categoria?.nome || "-"}</TableCell>
                                <TableCell>{produto.unidade_medida?.sigla || "-"}</TableCell>
                                <TableCell>{dadosFiscais?.ncm || "-"}</TableCell>
                                <TableCell>{dadosFiscais?.cfop_padrao || "-"}</TableCell>
                                <TableCell>
                                  {temDadosFiscais ? (
                                    <Badge variant="default" className="bg-green-500">Configurado</Badge>
                                  ) : (
                                    <Badge variant="destructive">Pendente</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button variant="outline" size="sm" onClick={() => handleConfigFiscal(produto)}>
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
          </TabsContent>

          {ivaEnabled && (
            <TabsContent value="iva">
              <IVADualTab />
            </TabsContent>
          )}
        </Tabs>
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
