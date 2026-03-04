import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Search, TrendingUp, TrendingDown, Minus, Download, Filter, Eye, Calendar, User, DollarSign, Tag, ClipboardList, Building2, Users } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { exportArrayToExcel } from "@/lib/excel-utils";

interface Lancamento {
  id: string;
  cliente: string;
  campanha: string;
  valorPedido: number;
  valorPago: number | null;
  status: string;
  roi: number | null;
  data: string;
  campaign_id?: string;
  customer_id?: string;
  evidencias?: string[];
  sell_out_anterior?: number;
  sell_out_atual?: number;
  tipo_brinde?: string;
  acoes_manuais?: string;
  source?: 'campaign' | 'financial_entry';
  description?: string;
  supplier_name?: string;
  entry_type?: string;
}

interface TradeLancamentosTableProps {
  lancamentos: Lancamento[];
}

type TabKey = "consolidada" | "clientes" | "fornecedores";

export function TradeLancamentosTable({ lancamentos }: TradeLancamentosTableProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("consolidada");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLancamento, setSelectedLancamento] = useState<Lancamento | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pendente", variant: "outline" },
      approved: { label: "Aprovado", variant: "default" },
      pending_financial: { label: "Aprovado - Pendente Financeiro", variant: "secondary" },
      sent_financial: { label: "Enviado Financeiro", variant: "secondary" },
      rejected: { label: "Rejeitado", variant: "destructive" },
      completed: { label: "Concluído", variant: "secondary" },
      paid: { label: "Pago", variant: "default" },
    };

    const config = statusMap[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getRoiBadge = (roi: number | null) => {
    if (roi === null) {
      return (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Minus className="h-4 w-4" />
          N/A
        </span>
      );
    }

    if (roi > 0) {
      return (
        <span className="flex items-center gap-1 text-emerald-500 font-medium">
          <TrendingUp className="h-4 w-4" />
          +{roi.toFixed(1)}%
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 text-destructive font-medium">
        <TrendingDown className="h-4 w-4" />
        {roi.toFixed(1)}%
      </span>
    );
  };

  const getSourceBadge = (source?: string) => {
    if (source === 'campaign') {
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800">Cliente</Badge>;
    }
    if (source === 'financial_entry') {
      return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 border-orange-200 dark:border-orange-800">Fornecedor</Badge>;
    }
    return <Badge variant="outline">-</Badge>;
  };

  // Filter by tab
  const tabFiltered = lancamentos.filter(l => {
    if (activeTab === "clientes") return l.source === 'campaign';
    if (activeTab === "fornecedores") return l.source === 'financial_entry';
    return true; // consolidada
  });

  // Then apply search & status filters
  const filteredLancamentos = tabFiltered.filter(l => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      l.cliente.toLowerCase().includes(searchLower) ||
      l.campanha.toLowerCase().includes(searchLower) ||
      (l.supplier_name || '').toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === "all" || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const tabLabels: Record<TabKey, string> = {
    consolidada: "Consolidada",
    clientes: "Clientes",
    fornecedores: "Fornecedores",
  };

  const handleExport = async () => {
    const exportData = filteredLancamentos.map(l => ({
      ...(activeTab === "consolidada" ? { Tipo: l.source === 'campaign' ? 'Cliente' : 'Fornecedor' } : {}),
      ...(activeTab === "clientes" ? { Cliente: l.cliente } : {}),
      ...(activeTab === "fornecedores" ? { Fornecedor: l.supplier_name || l.cliente } : {}),
      ...(activeTab === "consolidada" ? { 'Cliente/Fornecedor': l.source === 'campaign' ? l.cliente : (l.supplier_name || l.cliente) } : {}),
      Campanha: l.campanha,
      'Valor Pedido': l.valorPedido,
      'Valor Pago': l.valorPago !== null ? l.valorPago : 0,
      Status: l.status,
      ROI: l.roi !== null ? `${l.roi.toFixed(1)}%` : 'N/A',
      Data: l.data ? format(new Date(l.data), "dd/MM/yyyy", { locale: ptBR }) : '',
    }));

    await exportArrayToExcel(exportData, tabLabels[activeTab], `lancamentos-${activeTab}-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const totalPedido = filteredLancamentos.reduce((sum, l) => sum + l.valorPedido, 0);
  const totalPago = filteredLancamentos.reduce((sum, l) => sum + (l.valorPago ?? 0), 0);

  const clienteCount = lancamentos.filter(l => l.source === 'campaign').length;
  const fornecedorCount = lancamentos.filter(l => l.source === 'financial_entry').length;

  const renderTable = () => (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {activeTab === "consolidada" && <TableHead>Tipo</TableHead>}
              <TableHead>
                {activeTab === "fornecedores" ? "Fornecedor" : activeTab === "clientes" ? "Cliente" : "Cliente/Fornecedor"}
              </TableHead>
              <TableHead>Campanha</TableHead>
              <TableHead className="text-right">Valor Pago</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">ROI</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLancamentos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={activeTab === "consolidada" ? 7 : 6} className="text-center py-8 text-muted-foreground">
                  Nenhum lançamento encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredLancamentos.map((lancamento) => (
                <TableRow
                  key={lancamento.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedLancamento(lancamento)}
                >
                  {activeTab === "consolidada" && (
                    <TableCell>{getSourceBadge(lancamento.source)}</TableCell>
                  )}
                  <TableCell className="font-medium">
                    {activeTab === "fornecedores"
                      ? (lancamento.supplier_name || lancamento.cliente)
                      : activeTab === "clientes"
                        ? lancamento.cliente
                        : (lancamento.source === 'financial_entry'
                          ? (lancamento.supplier_name || lancamento.cliente)
                          : lancamento.cliente)}
                  </TableCell>
                  <TableCell>{lancamento.campanha}</TableCell>
                  <TableCell className="text-right">
                    <span className="font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded">
                      {formatCurrency(lancamento.valorPago ?? 0)}
                    </span>
                  </TableCell>
                  <TableCell>{getStatusBadge(lancamento.status)}</TableCell>
                  <TableCell className="text-right">{getRoiBadge(lancamento.roi)}</TableCell>
                  <TableCell>
                    {lancamento.data
                      ? format(new Date(lancamento.data), "dd/MM/yyyy", { locale: ptBR })
                      : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Rodapé com totais */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 pt-4 border-t gap-2">
        <p className="text-sm text-muted-foreground">
          Exibindo {filteredLancamentos.length} de {tabFiltered.length} lançamentos
        </p>
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Total Pedido: </span>
            <span className="font-bold">{formatCurrency(totalPedido)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Total Pago: </span>
            <span className="font-bold text-emerald-600">{formatCurrency(totalPago)}</span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Detalhes de Lançamentos
        </CardTitle>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as TabKey); setSearchTerm(""); setStatusFilter("all"); }}>
          <TabsList className="mb-4">
            <TabsTrigger value="consolidada" className="gap-1.5">
              <FileText className="h-4 w-4" />
              Consolidada
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">{lancamentos.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="clientes" className="gap-1.5">
              <Users className="h-4 w-4" />
              Clientes
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">{clienteCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="fornecedores" className="gap-1.5">
              <Building2 className="h-4 w-4" />
              Fornecedores
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">{fornecedorCount}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* Filtros (compartilhados entre abas) */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={
                  activeTab === "fornecedores"
                    ? "Buscar por fornecedor ou campanha..."
                    : activeTab === "clientes"
                      ? "Buscar por cliente ou campanha..."
                      : "Buscar por cliente, fornecedor ou campanha..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="pending_financial">Pendente Financeiro</SelectItem>
                <SelectItem value="sent_financial">Enviado Financeiro</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* All three tabs render the same table structure, just filtered differently */}
          <TabsContent value="consolidada">{renderTable()}</TabsContent>
          <TabsContent value="clientes">{renderTable()}</TabsContent>
          <TabsContent value="fornecedores">{renderTable()}</TabsContent>
        </Tabs>
      </CardContent>

      {/* Dialog de Detalhes */}
      <Dialog open={!!selectedLancamento} onOpenChange={(open) => !open && setSelectedLancamento(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Detalhes do Lançamento
            </DialogTitle>
          </DialogHeader>

          {selectedLancamento && (
            <div className="space-y-6">
              {/* Source badge */}
              <div>{getSourceBadge(selectedLancamento.source)}</div>

              {/* Informações do Cliente/Fornecedor e Campanha */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    {selectedLancamento.source === 'financial_entry' ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    {selectedLancamento.source === 'financial_entry' ? 'Fornecedor' : 'Cliente'}
                  </p>
                  <p className="font-medium">
                    {selectedLancamento.source === 'financial_entry'
                      ? (selectedLancamento.supplier_name || selectedLancamento.cliente)
                      : selectedLancamento.cliente}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <ClipboardList className="h-4 w-4" />
                    Campanha
                  </p>
                  <p className="font-medium">{selectedLancamento.campanha}</p>
                </div>
              </div>

              {/* Valor Pago em destaque */}
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <p className="text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-1 mb-1">
                  <DollarSign className="h-4 w-4" />
                  Valor Pago
                </p>
                <p className="font-bold text-2xl text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(selectedLancamento.valorPago ?? 0)}
                </p>
              </div>

              {/* Valor do Pedido, Status e Data */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    Valor do Pedido
                  </p>
                  <p className="font-medium">{formatCurrency(selectedLancamento.valorPedido)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedLancamento.status)}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Data
                  </p>
                  <p className="font-medium">
                    {selectedLancamento.data
                      ? format(new Date(selectedLancamento.data), "dd/MM/yyyy", { locale: ptBR })
                      : '-'}
                  </p>
                </div>
              </div>

              {/* ROI */}
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground mb-2">Retorno sobre Investimento (ROI)</p>
                <div className="flex items-center gap-2 text-xl font-bold">
                  {getRoiBadge(selectedLancamento.roi)}
                </div>
              </div>

              {/* Sell Out */}
              {(selectedLancamento.sell_out_anterior !== undefined || selectedLancamento.sell_out_atual !== undefined) && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg border bg-background">
                    <p className="text-xs text-muted-foreground mb-1">Sell Out Anterior</p>
                    <p className="font-bold text-lg">
                      {selectedLancamento.sell_out_anterior !== undefined
                        ? formatCurrency(selectedLancamento.sell_out_anterior)
                        : '-'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-background">
                    <p className="text-xs text-muted-foreground mb-1">Sell Out Atual</p>
                    <p className="font-bold text-lg">
                      {selectedLancamento.sell_out_atual !== undefined
                        ? formatCurrency(selectedLancamento.sell_out_atual)
                        : '-'}
                    </p>
                  </div>
                </div>
              )}

              {/* Tipo Brinde */}
              {selectedLancamento.tipo_brinde && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Tag className="h-4 w-4" />
                    Tipo de Brinde
                  </p>
                  <Badge variant="outline">{selectedLancamento.tipo_brinde}</Badge>
                </div>
              )}

              {/* Ações Manuais */}
              {selectedLancamento.acoes_manuais && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Ações Realizadas</p>
                  <p className="text-sm p-3 rounded-lg bg-muted/30 border">
                    {selectedLancamento.acoes_manuais}
                  </p>
                </div>
              )}

              {/* Descrição */}
              {selectedLancamento.description && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Descrição</p>
                  <p className="text-sm p-3 rounded-lg bg-muted/30 border">
                    {selectedLancamento.description}
                  </p>
                </div>
              )}

              {/* Evidências */}
              {selectedLancamento.evidencias && selectedLancamento.evidencias.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Evidências ({selectedLancamento.evidencias.length})
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedLancamento.evidencias.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block aspect-square rounded-lg border overflow-hidden hover:ring-2 ring-primary transition-all"
                      >
                        <img
                          src={url}
                          alt={`Evidência ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
