import React, { memo, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Download, 
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { parseLocalDate, formatLocalDate } from "@/utils/dateUtils";
import { cn } from "@/lib/utils";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { toast } from "sonner";

type SortColumn = "data_vencimento" | "tipo" | "nome" | "valor" | "status";
type SortDirection = "asc" | "desc";
type FilterType = "all" | "receber" | "pagar";

interface FluxoCaixaMovimentacoesTableProps {
  contasReceber: any[];
  contasPagar: any[];
}

export const FluxoCaixaMovimentacoesTable = memo(function FluxoCaixaMovimentacoesTable({
  contasReceber,
  contasPagar
}: FluxoCaixaMovimentacoesTableProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortColumn, setSortColumn] = useState<SortColumn>("data_vencimento");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  const allMovimentos = useMemo(() => {
    const receber = contasReceber.map(c => ({
      ...c,
      tipo: "receber" as const,
      nome: c.cliente_nome || "-",
      valor: c.valor_aberto || 0
    }));
    
    const pagar = contasPagar.map(c => ({
      ...c,
      tipo: "pagar" as const,
      nome: c.fornecedor_nome || "-",
      valor: c.valor_aberto || 0
    }));

    let combined = [...receber, ...pagar];
    
    // Filter by type
    if (filter !== "all") {
      combined = combined.filter(m => m.tipo === filter);
    }
    
    // Search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      combined = combined.filter(m => 
        m.nome?.toLowerCase().includes(search) ||
        m.numero_documento?.toLowerCase().includes(search) ||
        m.empresa_nome?.toLowerCase().includes(search)
      );
    }

    // Sort
    combined.sort((a, b) => {
      let comparison = 0;
      
      switch (sortColumn) {
        case "data_vencimento":
          const dateA = parseLocalDate(a.data_vencimento);
          const dateB = parseLocalDate(b.data_vencimento);
          comparison = (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
          break;
        case "tipo":
          comparison = a.tipo.localeCompare(b.tipo);
          break;
        case "nome":
          comparison = (a.nome || "").localeCompare(b.nome || "");
          break;
        case "valor":
          comparison = a.valor - b.valor;
          break;
        case "status":
          comparison = (a.status || "").localeCompare(b.status || "");
          break;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return combined;
  }, [contasReceber, contasPagar, filter, searchTerm, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(allMovimentos.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return allMovimentos.slice(start, start + pageSize);
  }, [allMovimentos, currentPage, pageSize]);

  // Totals
  const totals = useMemo(() => {
    const entradas = allMovimentos.filter(m => m.tipo === "receber").reduce((sum, m) => sum + m.valor, 0);
    const saidas = allMovimentos.filter(m => m.tipo === "pagar").reduce((sum, m) => sum + m.valor, 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [allMovimentos]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const exportToExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'BiMaster';
      const worksheet = workbook.addWorksheet('Movimentações');

      worksheet.columns = [
        { header: 'Vencimento', key: 'vencimento', width: 12 },
        { header: 'Tipo', key: 'tipo', width: 10 },
        { header: 'Empresa', key: 'empresa', width: 25 },
        { header: 'Nome', key: 'nome', width: 30 },
        { header: 'Documento', key: 'documento', width: 15 },
        { header: 'Valor', key: 'valor', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
      ];

      allMovimentos.forEach(m => {
        worksheet.addRow({
          vencimento: formatLocalDate(m.data_vencimento, "dd/MM/yyyy"),
          tipo: m.tipo === "receber" ? "Entrada" : "Saída",
          empresa: m.empresa_nome || "-",
          nome: m.nome,
          documento: m.numero_documento || "-",
          valor: m.valor,
          status: m.status || "-",
        });
      });

      // Add totals row
      worksheet.addRow({
        vencimento: 'TOTAIS',
        tipo: '',
        empresa: '',
        nome: `Entradas: ${formatCurrency(totals.entradas)}`,
        documento: `Saídas: ${formatCurrency(totals.saidas)}`,
        valor: totals.saldo,
        status: `Saldo: ${formatCurrency(totals.saldo)}`,
      });

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `fluxo_caixa_movimentacoes_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast.success(`${allMovimentos.length} registros exportados com sucesso!`);
    } catch (error) {
      toast.error("Erro ao exportar dados");
      console.error(error);
    }
  };

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <CardTitle className="text-base">Movimentações Previstas</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-8 h-9 w-[200px]"
              />
            </div>

            {/* Type filter */}
            <div className="flex gap-1">
              <Button 
                size="sm" 
                variant={filter === "all" ? "default" : "outline"}
                onClick={() => { setFilter("all"); setCurrentPage(1); }}
                className="h-9"
              >
                Todas
              </Button>
              <Button 
                size="sm" 
                variant={filter === "receber" ? "default" : "outline"}
                onClick={() => { setFilter("receber"); setCurrentPage(1); }}
                className="h-9"
              >
                Entradas
              </Button>
              <Button 
                size="sm" 
                variant={filter === "pagar" ? "default" : "outline"}
                onClick={() => { setFilter("pagar"); setCurrentPage(1); }}
                className="h-9"
              >
                Saídas
              </Button>
            </div>

            {/* Export */}
            <Button size="sm" variant="outline" onClick={exportToExcel} className="h-9">
              <Download className="h-4 w-4 mr-1" />
              Exportar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Totals Summary */}
        <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-muted/50 rounded-lg">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total Entradas</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(totals.entradas)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total Saídas</p>
            <p className="text-lg font-bold text-rose-600">{formatCurrency(totals.saidas)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className={cn("text-lg font-bold", totals.saldo >= 0 ? "text-emerald-600" : "text-rose-600")}>
              {formatCurrency(totals.saldo)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("data_vencimento")}
                >
                  <div className="flex items-center">
                    Vencimento
                    {getSortIcon("data_vencimento")}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("tipo")}
                >
                  <div className="flex items-center">
                    Tipo
                    {getSortIcon("tipo")}
                  </div>
                </TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead 
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("nome")}
                >
                  <div className="flex items-center">
                    Nome
                    {getSortIcon("nome")}
                  </div>
                </TableHead>
                <TableHead>Documento</TableHead>
                <TableHead 
                  className="cursor-pointer select-none text-right"
                  onClick={() => handleSort("valor")}
                >
                  <div className="flex items-center justify-end">
                    Valor
                    {getSortIcon("valor")}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer select-none text-center"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center justify-center">
                    Status
                    {getSortIcon("status")}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhuma movimentação encontrada
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((mov, i) => (
                  <TableRow key={`${mov.tipo}-${mov.id || i}`}>
                    <TableCell>
                      {formatLocalDate(mov.data_vencimento, "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      {mov.tipo === "receber" ? (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                          <ArrowUpCircle className="h-3 w-3 mr-1" />
                          Entrada
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-rose-600 border-rose-200">
                          <ArrowDownCircle className="h-3 w-3 mr-1" />
                          Saída
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs max-w-[120px] truncate">
                      {mov.empresa_nome || "-"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {mov.nome}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {mov.numero_documento || "-"}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-medium",
                      mov.tipo === "receber" ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {formatCurrency(mov.valor)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={mov.status === "vencido" ? "destructive" : "secondary"}>
                        {mov.status || "pendente"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {allMovimentos.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Mostrando {((currentPage - 1) * pageSize) + 1} a {Math.min(currentPage * pageSize, allMovimentos.length)} de {allMovimentos.length} registros
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <span className="text-sm px-2">
                Página {currentPage} de {totalPages || 1}
              </span>
              
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => goToPage(totalPages)}
                disabled={currentPage >= totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Por página:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="h-8 px-2 rounded border bg-background text-sm"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
              </select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
