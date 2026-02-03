import { memo, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, FileDown, Search, Filter, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { exportToExcel } from "@/utils/excelExport";
import { toast } from "sonner";
import { format } from "date-fns";

interface CashGapAlert {
  date: string;
  gap: number;
  severity: "critical" | "warning" | "info";
}

interface CashGapAlertsDialogProps {
  alerts: CashGapAlert[];
  trigger?: React.ReactNode;
}

export const CashGapAlertsDialog = memo(({ alerts, trigger }: CashGapAlertsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredAlerts = useMemo(() => {
    let filtered = [...alerts];
    
    if (filterSeverity !== "all") {
      filtered = filtered.filter(a => a.severity === filterSeverity);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(a => 
        a.date.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered.sort((a, b) => b.gap - a.gap);
  }, [alerts, filterSeverity, searchTerm]);

  const stats = useMemo(() => ({
    total: alerts.length,
    critical: alerts.filter(a => a.severity === "critical").length,
    warning: alerts.filter(a => a.severity === "warning").length,
    info: alerts.filter(a => a.severity === "info").length,
    totalGap: alerts.reduce((sum, a) => sum + a.gap, 0),
    maxGap: Math.max(...alerts.map(a => a.gap), 0),
  }), [alerts]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2
    }).format(value);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Crítico</Badge>;
      case "warning":
        return <Badge className="bg-amber-500 hover:bg-amber-600">Atenção</Badge>;
      default:
        return <Badge variant="secondary">Informativo</Badge>;
    }
  };

  const handleExportToExcel = async () => {
    const data = filteredAlerts.map(a => ({
      Data: a.date,
      "Gap (R$)": a.gap,
      Severidade: a.severity === "critical" ? "Crítico" : a.severity === "warning" ? "Atenção" : "Informativo",
      "Ação Sugerida": a.severity === "critical" 
        ? "Ação imediata necessária" 
        : a.severity === "warning" 
          ? "Monitorar de perto" 
          : "Acompanhar"
    }));

    await exportToExcel(data, {
      filename: `AlertasGap_${format(new Date(), 'yyyy-MM-dd_HHmmss')}`,
      sheetName: "Alertas Gap",
      columns: [
        { header: "Data", key: "Data", width: 15 },
        { header: "Gap (R$)", key: "Gap (R$)", width: 15 },
        { header: "Severidade", key: "Severidade", width: 15 },
        { header: "Ação Sugerida", key: "Ação Sugerida", width: 25 },
      ],
    });
    toast.success("Alertas exportados com sucesso!");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            Ver Todos os Alertas
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Alertas de Gap de Caixa ({stats.total})
          </DialogTitle>
        </DialogHeader>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <div className="text-xs text-red-600 dark:text-red-400">Críticos</div>
            <div className="text-xl font-bold text-red-700 dark:text-red-300">{stats.critical}</div>
          </div>
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <div className="text-xs text-amber-600 dark:text-amber-400">Atenção</div>
            <div className="text-xl font-bold text-amber-700 dark:text-amber-300">{stats.warning}</div>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <div className="text-xs text-blue-600 dark:text-blue-400">Informativos</div>
            <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{stats.info}</div>
          </div>
          <div className="p-3 rounded-lg bg-muted border">
            <div className="text-xs text-muted-foreground">Maior Gap</div>
            <div className="text-xl font-bold text-foreground">{formatCurrency(stats.maxGap)}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por data..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Severidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="critical">Críticos</SelectItem>
              <SelectItem value="warning">Atenção</SelectItem>
              <SelectItem value="info">Informativos</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExportToExcel}>
            <FileDown className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Data</TableHead>
                <TableHead className="text-right font-semibold">Gap (Déficit)</TableHead>
                <TableHead className="text-center font-semibold">Severidade</TableHead>
                <TableHead className="font-semibold">Ação Sugerida</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAlerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhum alerta encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredAlerts.map((alert, index) => (
                  <TableRow 
                    key={index}
                    className={cn(
                      "hover:bg-muted/30 transition-colors",
                      alert.severity === "critical" && "bg-red-50/50 dark:bg-red-950/20"
                    )}
                  >
                    <TableCell className="font-medium">{alert.date}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-rose-600 font-semibold">
                        {formatCurrency(alert.gap)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {getSeverityBadge(alert.severity)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {alert.severity === "critical" 
                        ? "Ação imediata necessária - considere antecipação de recebíveis"
                        : alert.severity === "warning"
                          ? "Monitorar de perto - revisar programação de pagamentos"
                          : "Acompanhar evolução do fluxo"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {filteredAlerts.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50 border">
            <div className="text-sm font-medium mb-1">Resumo</div>
            <div className="text-xs text-muted-foreground">
              Gap total no período: <span className="font-semibold text-rose-600">{formatCurrency(stats.totalGap)}</span>
              {" • "}
              Dias com déficit: <span className="font-semibold">{stats.total}</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});

CashGapAlertsDialog.displayName = "CashGapAlertsDialog";
