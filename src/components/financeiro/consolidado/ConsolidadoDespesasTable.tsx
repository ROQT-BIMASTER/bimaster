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
import { FileText, Search, Download, Filter, Store, Calendar, Building2 } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { exportArrayToExcel } from "@/lib/excel-utils";
import type { DespesaConsolidada } from "@/hooks/useFinanceiroConsolidadoDashboard";

interface ConsolidadoDespesasTableProps {
  despesas: DespesaConsolidada[];
}

const origemBadgeConfig: Record<string, { label: string; className: string; icon: typeof Store }> = {
  trade: { label: "Trade", className: "bg-purple-500/10 text-purple-600 border-purple-500/30", icon: Store },
  eventos: { label: "Eventos", className: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: Calendar },
  departamentos: { label: "Depto", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: Building2 },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const getStatusBadge = (status: string) => {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "Pendente", variant: "outline" },
    pendente: { label: "Pendente", variant: "outline" },
    approved: { label: "Aprovado", variant: "default" },
    aprovado: { label: "Aprovado", variant: "default" },
    rejected: { label: "Rejeitado", variant: "destructive" },
    completed: { label: "Concluído", variant: "secondary" },
    pago: { label: "Pago", variant: "default" },
  };
  const cfg = map[status?.toLowerCase()] || { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
};

export function ConsolidadoDespesasTable({ despesas }: ConsolidadoDespesasTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [origemFilter, setOrigemFilter] = useState("all");

  const filtered = despesas.filter((d) => {
    const matchesSearch =
      d.origemNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.categoria.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || d.status?.toLowerCase() === statusFilter;
    const matchesOrigem = origemFilter === "all" || d.origem === origemFilter;
    return matchesSearch && matchesStatus && matchesOrigem;
  });

  const handleExport = async () => {
    const exportData = filtered.map((d) => ({
      Origem: origemBadgeConfig[d.origem]?.label || d.origem,
      "Campanha/Evento/Depto": d.origemNome,
      Categoria: d.categoria,
      Descrição: d.descricao,
      "Valor Realizado": d.valorRealizado,
      Status: d.status,
      Data: d.data ? format(new Date(d.data), "dd/MM/yyyy", { locale: ptBR }) : "",
    }));

    await exportArrayToExcel(
      exportData,
      "Despesas Consolidadas",
      `despesas-consolidadas-${format(new Date(), "yyyy-MM-dd")}.xlsx`,
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Despesas Consolidadas
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
              placeholder="Buscar por nome, categoria ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={origemFilter} onValueChange={setOrigemFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas origens</SelectItem>
              <SelectItem value="trade">Trade</SelectItem>
              <SelectItem value="eventos">Eventos</SelectItem>
              <SelectItem value="departamentos">Departamentos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="approved">Aprovado</SelectItem>
              <SelectItem value="rejected">Rejeitado</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabela */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Origem</TableHead>
                <TableHead>Campanha / Evento / Depto</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor Realizado</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma despesa encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((d) => {
                  const badgeCfg = origemBadgeConfig[d.origem];
                  const Icon = badgeCfg?.icon || Store;

                  return (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Badge variant="outline" className={`gap-1 ${badgeCfg?.className || ""}`}>
                          <Icon className="h-3 w-3" />
                          {badgeCfg?.label || d.origem}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{d.origemNome}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{d.descricao}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded">
                          {formatCurrency(d.valorRealizado)}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(d.status)}</TableCell>
                      <TableCell>
                        {d.data ? format(new Date(d.data), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Rodapé */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Exibindo {filtered.length} de {despesas.length} despesas
          </p>
          <div className="text-sm">
            <span className="text-muted-foreground">Total Realizado: </span>
            <span className="font-bold text-emerald-600">
              {formatCurrency(filtered.reduce((s, d) => s + d.valorRealizado, 0))}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
