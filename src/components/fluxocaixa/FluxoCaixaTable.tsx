import { memo, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown, FileDown, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO, isToday, isPast, isFuture } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { exportToExcel } from "@/utils/excelExport";
import { toast } from "sonner";

interface FluxoCaixaTableProps {
  projections: {
    date: string;
    entradas: number;
    saidas: number;
    saldo: number;
    saldoAcumulado: number;
  }[];
  period: "daily" | "weekly" | "monthly";
}

export const FluxoCaixaTable = memo(({ projections, period }: FluxoCaixaTableProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 15;
  
  const totalPages = Math.ceil(projections.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return projections.slice(start, start + itemsPerPage);
  }, [projections, currentPage]);

  const totals = useMemo(() => ({
    entradas: projections.reduce((sum, p) => sum + p.entradas, 0),
    saidas: projections.reduce((sum, p) => sum + p.saidas, 0),
    saldo: projections.reduce((sum, p) => sum + p.saldo, 0),
  }), [projections]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2
    }).format(value);
  };

  const handleExportToExcel = async () => {
    const dataWithTotal = [
      ...projections.map(p => ({
        Data: p.date,
        Entradas: p.entradas,
        Saídas: p.saidas,
        "Saldo Diário": p.saldo,
        "Saldo Acumulado": p.saldoAcumulado,
      })),
    ];

    await exportToExcel(dataWithTotal, {
      filename: `FluxoCaixa_${format(new Date(), 'yyyy-MM-dd_HHmmss')}`,
      sheetName: "Fluxo de Caixa",
      columns: [
        { header: "Data", key: "Data", width: 15 },
        { header: "Entradas", key: "Entradas", width: 15 },
        { header: "Saídas", key: "Saídas", width: 15 },
        { header: "Saldo Diário", key: "Saldo Diário", width: 15 },
        { header: "Saldo Acumulado", key: "Saldo Acumulado", width: 18 },
      ],
    });
    toast.success("Exportado com sucesso!");
  };

  const getPeriodLabel = () => {
    switch (period) {
      case "daily": return "Dia";
      case "weekly": return "Semana";
      case "monthly": return "Mês";
      default: return "Período";
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Grade de Detalhamento - Fluxo de Caixa
        </CardTitle>
        <Button variant="outline" size="sm" onClick={handleExportToExcel}>
          <FileDown className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">{getPeriodLabel()}</TableHead>
                <TableHead className="text-right font-semibold">
                  <div className="flex items-center justify-end gap-1">
                    <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
                    Receber
                  </div>
                </TableHead>
                <TableHead className="text-right font-semibold">
                  <div className="flex items-center justify-end gap-1">
                    <ArrowDownCircle className="h-4 w-4 text-rose-500" />
                    Pagar
                  </div>
                </TableHead>
                <TableHead className="text-right font-semibold">Saldo {getPeriodLabel()}</TableHead>
                <TableHead className="text-right font-semibold">Saldo Acumulado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((row, index) => {
                const actualIndex = currentPage * itemsPerPage + index;
                const isNegativeSaldo = row.saldo < 0;
                const isNegativeAcumulado = row.saldoAcumulado < 0;
                
                return (
                  <TableRow 
                    key={actualIndex}
                    className={cn(
                      "hover:bg-muted/30 transition-colors",
                      index === 0 && "border-l-4 border-l-primary"
                    )}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{row.date}</span>
                        {actualIndex === 0 && (
                          <Badge variant="outline" className="text-[10px]">Hoje</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-emerald-600 font-medium">
                        {formatCurrency(row.entradas)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-rose-600 font-medium">
                        {formatCurrency(row.saidas)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        "font-semibold",
                        isNegativeSaldo ? "text-rose-600" : "text-emerald-600"
                      )}>
                        {formatCurrency(row.saldo)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant={isNegativeAcumulado ? "destructive" : "default"}
                        className={cn(
                          "font-semibold",
                          !isNegativeAcumulado && "bg-emerald-500 hover:bg-emerald-600"
                        )}
                      >
                        {formatCurrency(row.saldoAcumulado)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* Totals Row */}
              <TableRow className="bg-muted/80 font-semibold border-t-2">
                <TableCell className="font-bold">TOTAL DO PERÍODO</TableCell>
                <TableCell className="text-right">
                  <span className="text-emerald-600 font-bold">
                    {formatCurrency(totals.entradas)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-rose-600 font-bold">
                    {formatCurrency(totals.saidas)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className={cn(
                    "font-bold",
                    totals.saldo < 0 ? "text-rose-600" : "text-emerald-600"
                  )}>
                    {formatCurrency(totals.saldo)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className={cn(
                    "font-bold",
                    (projections[projections.length - 1]?.saldoAcumulado || 0) < 0 
                      ? "text-rose-600" 
                      : "text-emerald-600"
                  )}>
                    {formatCurrency(projections[projections.length - 1]?.saldoAcumulado || 0)}
                  </span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted-foreground">
              Página {currentPage + 1} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage === totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

FluxoCaixaTable.displayName = "FluxoCaixaTable";
