import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Search, DollarSign } from "lucide-react";
import { formatarMoeda } from "@/lib/fabrica/pricing-calculator";
import { toast } from "sonner";

interface Props {
  cnpj?: string;
}

export function PortalTabelaPreco({ cnpj }: Props) {
  const [busca, setBusca] = useState("");
  const [tabelaSelecionada, setTabelaSelecionada] = useState<string>("");

  // Buscar CNPJs do usuário
  const { data: userCNPJs } = useQuery({
    queryKey: ["user-cnpjs"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("user_cnpj")
        .select("cnpj")
        .eq("user_id", user.id);

      if (error) throw error;
      return data.map((d) => d.cnpj);
    },
  });

  // Buscar tabelas aprovadas do CNPJ
  const { data: tabelas, isLoading: loadingTabelas } = useQuery({
    queryKey: ["tabelas-preco-portal", cnpj, userCNPJs],
    queryFn: async () => {
      const cnpjFiltro = cnpj || userCNPJs?.[0];
      if (!cnpjFiltro) return [];

      const { data, error } = await supabase
        .from("fabrica_tabelas_preco")
        .select("*")
        .eq("status", "approved")
        .or(`owner_cnpj.eq.${cnpjFiltro},visivel_para_cnpjs.cs.{${cnpjFiltro}}`)
        .eq("ativo", true)
        .order("ordem");

      if (error) throw error;
      return data;
    },
    enabled: !!(cnpj || userCNPJs?.length),
  });

  // Buscar preços da tabela selecionada
  const { data: precos, isLoading: loadingPrecos } = useQuery({
    queryKey: ["precos-tabela", tabelaSelecionada],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_precos_produtos")
        .select("*")
        .eq("tabela_id", tabelaSelecionada)
        .eq("ativo", true);

      if (error) throw error;

      // Buscar produtos separadamente
      if (!data || data.length === 0) return [];

      const produtoIds = [...new Set(data.map(d => d.produto_id))];
      const { data: produtos, error: produtosError } = await supabase
        .from("fabrica_produtos")
        .select("id, codigo, nome, tipo, origem")
        .in("id", produtoIds);

      if (produtosError) throw produtosError;

      // Fazer merge manual e ordenar
      return data.map(preco => ({
        ...preco,
        produto: produtos?.find(p => p.id === preco.produto_id),
      })).sort((a, b) => (a.produto?.nome || "").localeCompare(b.produto?.nome || ""));
    },
    enabled: !!tabelaSelecionada,
  });

  const precosFiltrados = precos?.filter(
    (p) =>
      p.produto?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      p.produto?.codigo?.toLowerCase().includes(busca.toLowerCase())
  );

  const handleExportarCSV = () => {
    if (!precos || precos.length === 0) {
      toast.error("Nenhum preço para exportar");
      return;
    }

    const csv = [
      ["Código", "Produto", "Custo Base", "Preço Final", "Margem (%)"],
      ...precos.map((p) => [
        p.produto?.codigo || "",
        p.produto?.nome || "",
        p.custo_base?.toFixed(2) || "0.00",
        p.preco_final?.toFixed(2) || "0.00",
        p.margem_lucro_percentual?.toFixed(2) || "0.00",
      ]),
    ]
      .map((row) => row.join(";"))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `tabela_precos_${tabelaSelecionada}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    toast.success("Tabela exportada com sucesso!");
  };

  const cnpjAtual = cnpj || userCNPJs?.[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Portal de Preços</h1>
        <p className="text-muted-foreground">
          {cnpjAtual ? `Tabelas de preço para CNPJ: ${cnpjAtual}` : "Nenhum CNPJ vinculado"}
        </p>
      </div>

      {!cnpjAtual && (
        <Card className="border-yellow-500">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Você não possui CNPJs vinculados. Entre em contato com o administrador para configurar o acesso.
            </p>
          </CardContent>
        </Card>
      )}

      {cnpjAtual && (
        <>
          {/* Seleção de Tabela */}
          <Card>
            <CardHeader>
              <CardTitle>Tabelas Disponíveis</CardTitle>
              <CardDescription>
                Selecione uma tabela de preço aprovada para visualizar
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTabelas ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando tabelas...
                </div>
              ) : !tabelas || tabelas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma tabela de preço aprovada disponível para este CNPJ
                </div>
              ) : (
                <div className="grid gap-3">
                  {tabelas.map((tabela) => (
                    <Card
                      key={tabela.id}
                      className={`cursor-pointer transition-colors ${
                        tabelaSelecionada === tabela.id
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/50"
                      }`}
                      onClick={() => setTabelaSelecionada(tabela.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">{tabela.nome}</h3>
                              <Badge variant="outline">{tabela.codigo}</Badge>
                              <Badge className="bg-green-600">Aprovada</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {tabela.descricao || "Sem descrição"}
                            </p>
                          </div>
                          {tabelaSelecionada === tabela.id && (
                            <DollarSign className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabela de Preços */}
          {tabelaSelecionada && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Preços dos Produtos</CardTitle>
                    <CardDescription>
                      Produtos e seus respectivos preços
                    </CardDescription>
                  </div>
                  <Button onClick={handleExportarCSV} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                </div>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {loadingPrecos ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando preços...
                  </div>
                ) : !precosFiltrados || precosFiltrados.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum preço cadastrado nesta tabela
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead className="text-right">Custo Base</TableHead>
                        <TableHead className="text-right">Preço Final</TableHead>
                        <TableHead className="text-right">Margem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {precosFiltrados.map((preco) => (
                        <TableRow key={preco.id}>
                          <TableCell className="font-mono">
                            {preco.produto?.codigo}
                          </TableCell>
                          <TableCell className="font-medium">
                            {preco.produto?.nome}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {preco.produto?.tipo === "ACABADO" ? "Acabado" : 
                               preco.produto?.tipo === "INTER" ? "Intermediário" : "MP"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={preco.produto?.origem === 'importado' ? 'destructive' : 'secondary'}>
                              {preco.produto?.origem === 'importado' ? 'Importado' : 'Nacional'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatarMoeda(preco.custo_base || 0)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatarMoeda(preco.preco_final || 0)}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {preco.margem_lucro_percentual?.toFixed(2)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
