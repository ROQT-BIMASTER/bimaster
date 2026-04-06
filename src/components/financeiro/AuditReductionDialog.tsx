import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  ShieldAlert, AlertTriangle, TrendingUp, Clock, Target,
  Ban, Users, FileDown, Minimize2, Zap, Activity
} from "lucide-react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, ComposedChart, Line, Area, Legend, Cell,
} from "recharts";
import { chartColors, chartPalette } from "@/lib/chart-colors";
import { format } from "date-fns";
import type { AuditReductionResult } from "@/hooks/useExpenseAI";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface AuditReductionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: AuditReductionResult | null;
}

const anomalyTypeLabels: Record<string, { label: string; icon: React.ElementType }> = {
  cost_spike: { label: "Custos Crescentes", icon: TrendingUp },
  stalled_item: { label: "Item Parado", icon: Clock },
  overdue: { label: "Prazo Vencido", icon: AlertTriangle },
  unrealistic_target: { label: "Meta Irrealista", icon: Target },
  duplicate: { label: "Duplicidade", icon: Ban },
  concentration: { label: "Concentração", icon: Users },
};

const severityConfig = {
  high: { label: "Alta", color: "bg-destructive/15 text-destructive border-destructive/30" },
  medium: { label: "Média", color: "bg-warning/15 text-warning border-warning/30" },
  low: { label: "Baixa", color: "bg-primary/15 text-primary border-primary/30" },
};

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function RiskGauge({ score }: { score: number }) {
  const color = score >= 70 ? "text-destructive" : score >= 40 ? "text-warning" : "text-success";
  const bg = score >= 70 ? "bg-destructive/15" : score >= 40 ? "bg-warning/15" : "bg-success/15";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative w-24 h-24 rounded-full ${bg} flex items-center justify-center`}>
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6"
            className="text-muted/20" />
          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6"
            className={color}
            strokeDasharray={`${score * 2.64} 264`}
            strokeLinecap="round" />
        </svg>
        <span className={`text-2xl font-bold ${color}`}>{score}</span>
      </div>
      <span className="text-xs text-muted-foreground font-medium">Score de Risco</span>
    </div>
  );
}

export function AuditReductionDialog({ open, onOpenChange, result }: AuditReductionDialogProps) {
  if (!result) return null;

  const radarData = useMemo(() => [
    { dimension: "Custos Crescentes", value: result.radar_dimensions.custos_crescentes, fullMark: 100 },
    { dimension: "Prazos Vencidos", value: result.radar_dimensions.prazos_vencidos, fullMark: 100 },
    { dimension: "Metas Irrealistas", value: result.radar_dimensions.metas_irrealistas, fullMark: 100 },
    { dimension: "Duplicidades", value: result.radar_dimensions.duplicidades, fullMark: 100 },
    { dimension: "Concentração", value: result.radar_dimensions.concentracao, fullMark: 100 },
    { dimension: "Itens Parados", value: result.radar_dimensions.itens_parados, fullMark: 100 },
  ], [result.radar_dimensions]);

  // Bar chart: anomalies by severity grouped by type
  const barData = useMemo(() => {
    const typeMap: Record<string, { high: number; medium: number; low: number }> = {};
    result.anomalies.forEach(a => {
      if (!typeMap[a.type]) typeMap[a.type] = { high: 0, medium: 0, low: 0 };
      typeMap[a.type][a.severity]++;
    });
    return Object.entries(typeMap).map(([type, counts]) => ({
      name: anomalyTypeLabels[type]?.label || type,
      alta: counts.high,
      media: counts.medium,
      baixa: counts.low,
      total: counts.high + counts.medium + counts.low,
    })).sort((a, b) => b.total - a.total);
  }, [result.anomalies]);

  // Trend data: group by mes, pivot by fornecedor
  const trendData = useMemo(() => {
    const mesMap: Record<string, Record<string, number>> = {};
    const fornecedores = new Set<string>();
    result.trend_data.forEach(t => {
      if (!mesMap[t.mes]) mesMap[t.mes] = {};
      mesMap[t.mes][t.fornecedor] = t.valor_real;
      mesMap[t.mes][`${t.fornecedor}_media`] = t.valor_medio;
      fornecedores.add(t.fornecedor);
    });
    const months = Object.keys(mesMap).sort();
    return { data: months.map(m => ({ mes: m, ...mesMap[m] })), fornecedores: [...fornecedores] };
  }, [result.trend_data]);

  const exportAuditExcel = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = "BiMaster";
    const ws = wb.addWorksheet("Auditoria IA");
    ws.columns = [
      { header: "Tipo", key: "tipo", width: 20 },
      { header: "Severidade", key: "severidade", width: 12 },
      { header: "Fornecedor", key: "fornecedor", width: 25 },
      { header: "Item", key: "item", width: 30 },
      { header: "Descrição", key: "descricao", width: 50 },
      { header: "Recomendação", key: "recomendacao", width: 50 },
      { header: "Impacto (R$)", key: "impacto", width: 15 },
    ];
    result.anomalies.forEach(a => {
      ws.addRow({
        tipo: anomalyTypeLabels[a.type]?.label || a.type,
        severidade: severityConfig[a.severity]?.label || a.severity,
        fornecedor: a.fornecedor || "—",
        item: a.item || "—",
        descricao: a.description,
        recomendacao: a.recommendation,
        impacto: a.impact_value || 0,
      });
    });
    const hdr = ws.getRow(1);
    hdr.font = { bold: true };
    hdr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `Auditoria_IA_${format(new Date(), "dd-MM-yyyy")}.xlsx`);
  };

  const highCount = result.anomalies.filter(a => a.severity === "high").length;
  const medCount = result.anomalies.filter(a => a.severity === "medium").length;
  const lowCount = result.anomalies.filter(a => a.severity === "low").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <ShieldAlert className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <DialogTitle className="text-lg">Auditoria IA — {result.plano_nome}</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Gerada em {format(new Date(result.audit_date), "dd/MM/yyyy 'às' HH:mm")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={exportAuditExcel} variant="outline" size="sm" className="gap-2">
                <FileDown className="h-4 w-4" /> Exportar Excel
              </Button>
              <Button onClick={() => onOpenChange(false)} variant="ghost" size="icon">
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            {/* KPIs + Risk Gauge */}
            <div className="flex items-start gap-6">
              <RiskGauge score={result.risk_score} />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
                <KpiCard
                  title="Anomalias Detectadas"
                  value={result.anomalies.length}
                  icon={AlertTriangle}
                  variant={result.anomalies.length > 5 ? "destructive" : "warning"}
                  subtitle={`${highCount} alta · ${medCount} média · ${lowCount} baixa`}
                />
                <KpiCard
                  title="Economia Não Capturada"
                  value={fmtCurrency(result.uncaptured_savings)}
                  icon={Zap}
                  variant="warning"
                />
                <KpiCard
                  title="Itens Críticos"
                  value={result.critical_items_count}
                  icon={Activity}
                  variant={result.critical_items_count > 0 ? "destructive" : "success"}
                />
                <KpiCard
                  title="Score de Risco"
                  value={`${result.risk_score}/100`}
                  icon={ShieldAlert}
                  variant={result.risk_score >= 70 ? "destructive" : result.risk_score >= 40 ? "warning" : "success"}
                />
              </div>
            </div>

            {/* Executive Summary */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-sm leading-relaxed">{result.summary}</p>
              </CardContent>
            </Card>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Radar Chart */}
              <Card>
                <CardContent className="pt-4">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                    Perfil de Risco Multidimensional
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Radar
                        name="Risco"
                        dataKey="value"
                        stroke={chartColors.destructive}
                        fill={chartColors.destructive}
                        fillOpacity={0.25}
                        strokeWidth={2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Bar Chart - Anomalies by Type */}
              <Card>
                <CardContent className="pt-4">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    Anomalias por Categoria
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                      <RechartsTooltip
                        contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      />
                      <Bar dataKey="alta" name="Alta" stackId="a" fill={chartColors.destructive} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="media" name="Média" stackId="a" fill={chartColors.warning} />
                      <Bar dataKey="baixa" name="Baixa" stackId="a" fill={chartColors.primary} radius={[0, 4, 4, 0]} />
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Trend Chart */}
            {trendData.fornecedores.length > 0 && (
              <Card>
                <CardContent className="pt-4">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    Evolução Temporal — Fornecedores Anômalos
                  </h3>
                  <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={trendData.data} margin={{ left: 10, right: 10 }}>
                      <defs>
                        {trendData.fornecedores.map((f, i) => (
                          <linearGradient key={f} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={chartPalette[i % chartPalette.length]} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={chartPalette[i % chartPalette.length]} stopOpacity={0.05} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <RechartsTooltip
                        formatter={(value: number) => fmtCurrency(value)}
                        contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      />
                      <Legend />
                      {trendData.fornecedores.map((f, i) => (
                        <React.Fragment key={f}>
                          <Area
                            type="monotone"
                            dataKey={f}
                            name={f}
                            fill={`url(#grad-${i})`}
                            stroke={chartPalette[i % chartPalette.length]}
                            strokeWidth={2}
                          />
                          <Line
                            type="monotone"
                            dataKey={`${f}_media`}
                            name={`${f} (Média)`}
                            stroke={chartPalette[i % chartPalette.length]}
                            strokeDasharray="5 5"
                            strokeWidth={1.5}
                            dot={false}
                          />
                        </React.Fragment>
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Anomalies Table */}
            <Card>
              <CardContent className="pt-4">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  Detalhamento de Anomalias ({result.anomalies.length})
                </h3>
                <div className="max-h-[400px] overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Tipo</TableHead>
                        <TableHead className="w-[90px]">Severidade</TableHead>
                        <TableHead className="w-[160px]">Fornecedor / Item</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Recomendação</TableHead>
                        <TableHead className="w-[120px] text-right">Impacto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.anomalies
                        .sort((a, b) => {
                          const sev = { high: 0, medium: 1, low: 2 };
                          return sev[a.severity] - sev[b.severity];
                        })
                        .map((anomaly, idx) => {
                          const typeInfo = anomalyTypeLabels[anomaly.type];
                          const TypeIcon = typeInfo?.icon || AlertTriangle;
                          const sevCfg = severityConfig[anomaly.severity];
                          return (
                            <TableRow key={idx}>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-xs font-medium">{typeInfo?.label || anomaly.type}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-xs ${sevCfg?.color || ""}`}>
                                  {sevCfg?.label || anomaly.severity}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="text-xs">
                                  {anomaly.fornecedor && <div className="font-medium">{anomaly.fornecedor}</div>}
                                  {anomaly.item && <div className="text-muted-foreground">{anomaly.item}</div>}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs max-w-[300px]">{anomaly.description}</TableCell>
                              <TableCell className="text-xs max-w-[300px] text-muted-foreground">{anomaly.recommendation}</TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {anomaly.impact_value ? fmtCurrency(anomaly.impact_value) : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
