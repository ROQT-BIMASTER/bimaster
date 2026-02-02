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
import { FileText, Search, TrendingUp, TrendingDown, Minus, Download, Filter } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";

interface Lancamento {
  id: string;
  cliente: string;
  campanha: string;
  valor: number;
  status: string;
  roi: number | null;
  data: string;
}

interface TradeLancamentosTableProps {
  lancamentos: Lancamento[];
}

export function TradeLancamentosTable({ lancamentos }: TradeLancamentosTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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
      rejected: { label: "Rejeitado", variant: "destructive" },
      completed: { label: "Concluído", variant: "secondary" },
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

  const filteredLancamentos = lancamentos.filter(l => {
    const matchesSearch = 
      l.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.campanha.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExport = () => {
    const exportData = filteredLancamentos.map(l => ({
      Cliente: l.cliente,
      Campanha: l.campanha,
      Valor: l.valor,
      Status: l.status,
      ROI: l.roi !== null ? `${l.roi.toFixed(1)}%` : 'N/A',
      Data: l.data ? format(new Date(l.data), "dd/MM/yyyy", { locale: ptBR }) : '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lançamentos");
    XLSX.writeFile(wb, `lancamentos-trade-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Detalhes de Lançamentos por Cliente
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
              placeholder="Buscar por cliente ou campanha..."
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
              <SelectItem value="rejected">Rejeitado</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabela */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">ROI</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLancamentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum lançamento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredLancamentos.map((lancamento) => (
                  <TableRow key={lancamento.id}>
                    <TableCell className="font-medium">{lancamento.cliente}</TableCell>
                    <TableCell>{lancamento.campanha}</TableCell>
                    <TableCell className="text-right">{formatCurrency(lancamento.valor)}</TableCell>
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
        <div className="flex justify-between items-center mt-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Exibindo {filteredLancamentos.length} de {lancamentos.length} lançamentos
          </p>
          <div className="text-sm">
            <span className="text-muted-foreground">Total: </span>
            <span className="font-bold">
              {formatCurrency(filteredLancamentos.reduce((sum, l) => sum + l.valor, 0))}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
