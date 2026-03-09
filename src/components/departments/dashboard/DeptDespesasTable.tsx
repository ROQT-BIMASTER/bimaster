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
import { FileText, Search, Download, Filter, Tag, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { exportArrayToExcel } from "@/lib/excel-utils";
import { useExpenseFinancialStatus } from "@/hooks/useExpenseFinancialStatus";
import { FinancialRejectionBanner } from "@/components/shared/FinancialRejectionBanner";

interface Despesa {
  id: string;
  categoria: string;
  descricao: string;
  valorPrevisto: number;
  valorRealizado: number;
  status: string;
  data: string;
  payment_queue_id?: string | null;
}

interface DeptDespesasTableProps {
  despesas: Despesa[];
  departmentName: string;
}

export function DeptDespesasTable({ despesas, departmentName }: DeptDespesasTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Fetch financial rejection status
  const paymentQueueIds = despesas.map(d => d.payment_queue_id);
  const { data: financialStatusMap } = useExpenseFinancialStatus(paymentQueueIds);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getFinancialInfo = (despesa: Despesa) => {
    if (!despesa.payment_queue_id || !financialStatusMap) return null;
    return financialStatusMap.get(despesa.payment_queue_id) || null;
  };

  const getStatusBadge = (despesa: Despesa) => {
    const financialInfo = getFinancialInfo(despesa);
    
    if (financialInfo?.financial_status === "rejected") {
      return <Badge variant="destructive">Rejeitado Financeiro</Badge>;
    }

    const status = despesa.status;
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pendente", variant: "outline" },
      pending_financial: { label: "No Financeiro", variant: "secondary" },
      approved: { label: "Aprovado", variant: "default" },
      rejected: { label: "Rejeitado", variant: "destructive" },
      completed: { label: "Concluído", variant: "secondary" },
      paid: { label: "Pago", variant: "default" },
      pago: { label: "Pago", variant: "default" },
    };

    const config = statusMap[status?.toLowerCase()] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredDespesas = despesas.filter(d => {
    const matchesSearch = 
      d.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.descricao.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || d.status?.toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExport = async () => {
    const exportData = filteredDespesas.map(d => ({
      Categoria: d.categoria,
      Descrição: d.descricao,
      'Valor Previsto': d.valorPrevisto,
      'Valor Realizado': d.valorRealizado,
      Status: d.status,
      Data: d.data ? format(new Date(d.data), "dd/MM/yyyy", { locale: ptBR }) : '',
    }));

    await exportArrayToExcel(exportData, `Despesas ${departmentName}`, `despesas-${departmentName.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Despesas do Departamento
        </CardTitle>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por categoria ou descrição..."
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
              <SelectItem value="pending_financial">No Financeiro</SelectItem>
              <SelectItem value="approved">Aprovado</SelectItem>
              <SelectItem value="rejected">Rejeitado</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabela */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor Realizado</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDespesas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma despesa encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredDespesas.map((despesa) => {
                  const financialInfo = getFinancialInfo(despesa);
                  const isRejected = financialInfo?.financial_status === "rejected";
                  const isExpanded = expandedRows.has(despesa.id);

                  return (
                    <>
                      <TableRow 
                        key={despesa.id}
                        className={isRejected ? "bg-destructive/5 border-l-2 border-l-destructive" : ""}
                      >
                        <TableCell className="w-8 p-1">
                          {isRejected && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => toggleRow(despesa.id)}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            <Tag className="h-3 w-3" />
                            {despesa.categoria}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{despesa.descricao}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded">
                            {formatCurrency(despesa.valorRealizado)}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(despesa)}</TableCell>
                        <TableCell>
                          {despesa.data 
                            ? format(new Date(despesa.data), "dd/MM/yyyy", { locale: ptBR }) 
                            : '-'}
                        </TableCell>
                      </TableRow>
                      {isRejected && isExpanded && (
                        <TableRow key={`${despesa.id}-rejection`}>
                          <TableCell colSpan={6} className="p-3 bg-destructive/5">
                            <FinancialRejectionBanner info={financialInfo} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Rodapé com totais */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Exibindo {filteredDespesas.length} de {despesas.length} despesas
          </p>
          <div className="text-sm">
            <span className="text-muted-foreground">Total Realizado: </span>
            <span className="font-bold text-emerald-600">
              {formatCurrency(filteredDespesas.reduce((sum, d) => sum + d.valorRealizado, 0))}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
