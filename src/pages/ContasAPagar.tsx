import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Receipt, AlertCircle, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from 'xlsx';
import { toast } from "sonner";

interface ContaPagar {
  id: string;
  erp_id: string;
  empresa_id: number;
  empresa_nome: string;
  tipo_documento: string;
  numero_documento: string;
  parcela: number;
  fornecedor_codigo: string;
  fornecedor_nome: string;
  valor_original: number;
  valor_aberto: number;
  valor_pago: number;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento: string | null;
  categoria_nome: string;
  status: string;
  portador: string;
  conta: string;
}

export default function ContasAPagar() {
  const [searchFornecedor, setSearchFornecedor] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterEmpresa, setFilterEmpresa] = useState<string>("all");

  // Query contas a pagar
  const { data: contas, isLoading } = useQuery({
    queryKey: ['contas-pagar', searchFornecedor, filterStatus, filterEmpresa],
    queryFn: async () => {
      let query = supabase
        .from('contas_pagar')
        .select('*')
        .order('data_vencimento', { ascending: false });

      if (searchFornecedor) {
        query = query.ilike('fornecedor_nome', `%${searchFornecedor}%`);
      }

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      if (filterEmpresa !== 'all') {
        query = query.eq('empresa_id', parseInt(filterEmpresa));
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ContaPagar[];
    }
  });

  // Calcular KPIs
  const kpis = {
    totalAPagar: contas?.filter(c => ['pendente', 'vencido', 'parcial'].includes(c.status))
      .reduce((sum, c) => sum + (c.valor_aberto || 0), 0) || 0,
    vencendoHoje: contas?.filter(c => c.data_vencimento === format(new Date(), 'yyyy-MM-dd'))
      .reduce((sum, c) => sum + (c.valor_aberto || 0), 0) || 0,
    vencidas: contas?.filter(c => c.status === 'vencido')
      .reduce((sum, c) => sum + (c.valor_aberto || 0), 0) || 0,
    pagasNoMes: contas?.filter(c => {
      if (!c.data_pagamento) return false;
      const pagamento = new Date(c.data_pagamento);
      const hoje = new Date();
      return pagamento.getMonth() === hoje.getMonth() && pagamento.getFullYear() === hoje.getFullYear();
    }).reduce((sum, c) => sum + (c.valor_pago || 0), 0) || 0
  };

  // Empresas únicas para filtro
  const empresas = Array.from(new Set(contas?.map(c => ({ id: c.empresa_id, nome: c.empresa_nome })) || []))
    .reduce((acc, curr) => {
      if (!acc.find(e => e.id === curr.id)) acc.push(curr);
      return acc;
    }, [] as { id: number; nome: string }[]);

  // Exportar para Excel
  const handleExport = () => {
    if (!contas || contas.length === 0) {
      toast.error("Não há dados para exportar");
      return;
    }

    const dataToExport = contas.map(c => ({
      'Empresa': c.empresa_nome,
      'Documento': `${c.numero_documento}/${c.parcela}`,
      'Fornecedor': c.fornecedor_nome,
      'Categoria': c.categoria_nome,
      'Emissão': c.data_emissao ? format(new Date(c.data_emissao), 'dd/MM/yyyy', { locale: ptBR }) : '',
      'Vencimento': c.data_vencimento ? format(new Date(c.data_vencimento), 'dd/MM/yyyy', { locale: ptBR }) : '',
      'Valor Original': c.valor_original,
      'Valor Aberto': c.valor_aberto,
      'Valor Pago': c.valor_pago,
      'Status': c.status,
      'Portador': c.portador,
      'Conta': c.conta
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contas a Pagar");
    XLSX.writeFile(wb, `contas-pagar-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success("Exportação concluída!");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
      pago: { variant: "default", icon: CheckCircle },
      parcial: { variant: "secondary", icon: Clock },
      vencido: { variant: "destructive", icon: AlertCircle },
      pendente: { variant: "outline", icon: Clock }
    };

    const config = variants[status] || variants.pendente;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Receipt className="h-8 w-8" />
              Contas a Pagar
            </h1>
            <p className="text-muted-foreground">Gestão de contas e fornecedores</p>
          </div>
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total a Pagar</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpis.totalAPagar)}
              </div>
              <p className="text-xs text-muted-foreground">Pendente + Vencido + Parcial</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencendo Hoje</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpis.vencendoHoje)}
              </div>
              <p className="text-xs text-muted-foreground">Vencimento hoje</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencidas</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpis.vencidas)}
              </div>
              <p className="text-xs text-muted-foreground">Contas vencidas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pagas no Mês</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpis.pagasNoMes)}
              </div>
              <p className="text-xs text-muted-foreground">Pagamentos realizados</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Empresa</label>
                <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {empresas.map(emp => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>
                        {emp.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                    <SelectItem value="parcial">Parcial</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-2 block">Buscar Fornecedor</label>
                <Input
                  placeholder="Digite o nome do fornecedor..."
                  value={searchFornecedor}
                  onChange={(e) => setSearchFornecedor(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : contas && contas.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor Original</TableHead>
                      <TableHead className="text-right">Valor Aberto</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contas.map((conta) => (
                      <TableRow key={conta.id}>
                        <TableCell className="font-medium">{conta.empresa_nome}</TableCell>
                        <TableCell>{conta.numero_documento}/{conta.parcela}</TableCell>
                        <TableCell>{conta.fornecedor_nome}</TableCell>
                        <TableCell>{conta.categoria_nome}</TableCell>
                        <TableCell>
                          {conta.data_vencimento ? format(new Date(conta.data_vencimento), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(conta.valor_original)}
                        </TableCell>
                        <TableCell className="text-right">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(conta.valor_aberto)}
                        </TableCell>
                        <TableCell>{getStatusBadge(conta.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma conta encontrada
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
