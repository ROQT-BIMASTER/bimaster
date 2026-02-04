import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, Search, TrendingUp, TrendingDown, Minus, Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { exportArrayToExcel } from "@/lib/excel-utils";

interface Lancamento {
  id: string;
  customer_id: string;
  valor_pedido: number;
  status: string;
  roi_percentual: number | null;
  crescimento_percentual: number | null;
  data_lancamento: string;
  prospect: { nome_empresa: string; categoria: string | null } | null;
  campaign: { name: string } | null;
}

interface CurvaDistribuicao {
  curva: string;
  count: number;
  valor: number;
}

interface TradeExecutiveLancamentosTableProps {
  data?: Lancamento[];
  isLoading: boolean;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  approved: { label: "Aprovado", variant: "default" },
  pending: { label: "Pendente", variant: "secondary" },
  rejected: { label: "Rejeitado", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "outline" },
};

export function TradeExecutiveLancamentosTable({ data, isLoading }: TradeExecutiveLancamentosTableProps) {
  const [search, setSearch] = useState("");

  const filteredData = data?.filter((l) => {
    const searchLower = search.toLowerCase();
    const cliente = (l.prospect as any)?.nome_empresa?.toLowerCase() || "";
    const campanha = (l.campaign as any)?.name?.toLowerCase() || "";
    return cliente.includes(searchLower) || campanha.includes(searchLower);
  });

  const handleExport = async () => {
    if (!filteredData?.length) return;

    const exportData = filteredData.map((l) => ({
      Cliente: (l.prospect as any)?.nome_empresa || "-",
      Curva: (l.prospect as any)?.categoria || "-",
      Campanha: (l.campaign as any)?.name || "-",
      Valor: parseFloat(String(l.valor_pedido)) || 0,
      Status: statusConfig[l.status]?.label || l.status,
      ROI: l.roi_percentual ? `${parseFloat(String(l.roi_percentual)).toFixed(1)}%` : "-",
      Crescimento: l.crescimento_percentual
        ? `${parseFloat(String(l.crescimento_percentual)).toFixed(1)}%`
        : "-",
      Data: l.data_lancamento
        ? format(parseISO(l.data_lancamento), "dd/MM/yyyy", { locale: ptBR })
        : "-",
    }));

    await exportArrayToExcel(exportData, "Lançamentos", `lancamentos_trade_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  if (isLoading) {
    return <Skeleton className="h-[500px]" />;
  }

  const getRoiIcon = (roi: number | null) => {
    if (roi === null) return <Minus className="h-3 w-3 text-muted-foreground" />;
    if (roi > 0) return <TrendingUp className="h-3 w-3 text-emerald-500" />;
    if (roi < 0) return <TrendingDown className="h-3 w-3 text-destructive" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const getCurvaBadgeVariant = (curva: string | null): "default" | "secondary" | "outline" => {
    switch (curva) {
      case 'A': return 'default';
      case 'B': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Lançamentos de Campanhas
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente ou campanha..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!filteredData?.length}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredData && filteredData.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Curva</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                  <TableHead className="text-right">Crescimento</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.slice(0, 20).map((l) => {
                  const status = statusConfig[l.status] || statusConfig.pending;
                  const roi = l.roi_percentual ? parseFloat(String(l.roi_percentual)) : null;
                  const crescimento = l.crescimento_percentual
                    ? parseFloat(String(l.crescimento_percentual))
                    : null;
                  const curva = (l.prospect as any)?.categoria || null;

                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium max-w-[180px] truncate">
                        {(l.prospect as any)?.nome_empresa || "-"}
                      </TableCell>
                      <TableCell>
                        {curva ? (
                          <Badge variant={getCurvaBadgeVariant(curva)}>{curva}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[150px] truncate">
                        {(l.campaign as any)?.name || "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {(parseFloat(String(l.valor_pedido)) || 0).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-1">
                          {getRoiIcon(roi)}
                          {roi !== null ? `${roi.toFixed(1)}%` : "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-1">
                          {getRoiIcon(crescimento)}
                          {crescimento !== null ? `${crescimento.toFixed(1)}%` : "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {l.data_lancamento
                          ? format(parseISO(l.data_lancamento), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {filteredData.length > 20 && (
              <p className="text-sm text-muted-foreground text-center mt-4">
                Mostrando 20 de {filteredData.length} registros
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            {search ? "Nenhum lançamento encontrado para esta busca" : "Nenhum lançamento encontrado"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
