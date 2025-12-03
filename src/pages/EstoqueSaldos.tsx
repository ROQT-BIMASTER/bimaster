import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Archive, Plus, Search, Building2, ArrowUpRight, ArrowDownRight, History, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { NovaMovimentacaoDialog } from "@/components/estoque/NovaMovimentacaoDialog";
import { TIPOS_MOVIMENTO } from "@/lib/validations/estoque";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function EstoqueSaldos() {
  const [search, setSearch] = useState("");
  const [distribuidoraFilter, setDistribuidoraFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEstoque, setSelectedEstoque] = useState<any>(null);

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

  const { data: saldos, isLoading: loadingSaldos } = useQuery({
    queryKey: ['estoque-saldos', search, distribuidoraFilter],
    queryFn: async () => {
      let query = supabase
        .from('estoque_saldos')
        .select(`
          *,
          estoque_distribuidoras (id, nome),
          estoque_produtos_distribuidora (
            id, 
            codigo_produto_distribuidora, 
            nome_exibicao,
            fator_conversao,
            estoque_produtos_master (id, nome, sku_master, unidade_medida)
          )
        `)
        .order('ultimo_movimento', { ascending: false });
      
      if (distribuidoraFilter && distribuidoraFilter !== "all") {
        query = query.eq('distribuidora_id', distribuidoraFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      if (search) {
        return data?.filter((s: any) => 
          s.estoque_produtos_distribuidora?.codigo_produto_distribuidora?.toLowerCase().includes(search.toLowerCase()) ||
          s.estoque_produtos_distribuidora?.estoque_produtos_master?.nome?.toLowerCase().includes(search.toLowerCase()) ||
          s.estoque_produtos_distribuidora?.estoque_produtos_master?.sku_master?.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      return data;
    }
  });

  const { data: movimentacoes, isLoading: loadingMov } = useQuery({
    queryKey: ['estoque-movimentacoes-recentes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_movimentacoes')
        .select(`
          *,
          estoque_saldos (
            distribuidora_id,
            estoque_distribuidoras (nome),
            estoque_produtos_distribuidora (
              codigo_produto_distribuidora,
              estoque_produtos_master (nome)
            )
          )
        `)
        .order('data_movimento', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    }
  });

  const handleNovaMovimentacao = (estoque: any) => {
    setSelectedEstoque(estoque);
    setDialogOpen(true);
  };

  const getMovimentoIcon = (tipo: string) => {
    if (tipo === 'entrada') return <ArrowDownRight className="h-4 w-4 text-green-500" />;
    if (tipo === 'saida') return <ArrowUpRight className="h-4 w-4 text-red-500" />;
    return <History className="h-4 w-4 text-blue-500" />;
  };

  const getMovimentoBadge = (tipo: string) => {
    const config = TIPOS_MOVIMENTO.find(t => t.value === tipo);
    return (
      <Badge variant="outline" className={`${config?.color} text-white`}>
        {config?.label || tipo}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Archive className="h-6 w-6 text-primary" />
              Saldos e Movimentações
            </h1>
            <p className="text-muted-foreground">Controle de estoque por distribuidora</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Movimentação
          </Button>
        </div>

        <Tabs defaultValue="saldos">
          <TabsList>
            <TabsTrigger value="saldos">Saldos Atuais</TabsTrigger>
            <TabsTrigger value="movimentacoes">Movimentações Recentes</TabsTrigger>
          </TabsList>

          <TabsContent value="saldos" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por produto ou SKU..."
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
                {loadingSaldos ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Distribuidora</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                        <TableHead>Lote</TableHead>
                        <TableHead>Localização</TableHead>
                        <TableHead>Validade</TableHead>
                        <TableHead>Último Mov.</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {saldos?.map((saldo: any) => (
                        <TableRow key={saldo.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {saldo.estoque_produtos_distribuidora?.estoque_produtos_master?.nome}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {saldo.estoque_produtos_distribuidora?.estoque_produtos_master?.sku_master}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{saldo.estoque_distribuidoras?.nome}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {saldo.estoque_produtos_distribuidora?.codigo_produto_distribuidora}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            <span className={saldo.quantidade_disponivel <= 0 ? 'text-destructive' : ''}>
                              {Number(saldo.quantidade_disponivel).toLocaleString('pt-BR')}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">
                              {saldo.estoque_produtos_distribuidora?.estoque_produtos_master?.unidade_medida}
                            </span>
                          </TableCell>
                          <TableCell>{saldo.lote || '-'}</TableCell>
                          <TableCell>{saldo.localizacao || '-'}</TableCell>
                          <TableCell>
                            {saldo.data_validade ? (
                              <span className={new Date(saldo.data_validade) < new Date() ? 'text-destructive flex items-center gap-1' : ''}>
                                {new Date(saldo.data_validade) < new Date() && <AlertTriangle className="h-3 w-3" />}
                                {format(new Date(saldo.data_validade), 'dd/MM/yyyy')}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {saldo.ultimo_movimento 
                              ? format(new Date(saldo.ultimo_movimento), "dd/MM HH:mm")
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleNovaMovimentacao(saldo)}
                            >
                              Movimentar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {saldos?.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            Nenhum saldo encontrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="movimentacoes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Últimas 50 Movimentações</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingMov ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Distribuidora</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                        <TableHead className="text-right">Anterior</TableHead>
                        <TableHead className="text-right">Novo</TableHead>
                        <TableHead>Documento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movimentacoes?.map((mov: any) => (
                        <TableRow key={mov.id}>
                          <TableCell className="text-sm">
                            {format(new Date(mov.data_movimento), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getMovimentoIcon(mov.tipo_movimento)}
                              {getMovimentoBadge(mov.tipo_movimento)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {mov.estoque_saldos?.estoque_produtos_distribuidora?.estoque_produtos_master?.nome}
                          </TableCell>
                          <TableCell>
                            {mov.estoque_saldos?.estoque_distribuidoras?.nome}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {Number(mov.quantidade).toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {Number(mov.quantidade_anterior).toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            {Number(mov.quantidade_nova).toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {mov.documento_referencia || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <NovaMovimentacaoDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setSelectedEstoque(null);
          }}
          selectedEstoque={selectedEstoque}
        />
      </div>
    </DashboardLayout>
  );
}
