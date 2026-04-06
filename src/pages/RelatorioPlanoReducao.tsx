import React, { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartContainer } from "@/components/ui/chart-container";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, Target, TrendingDown, CheckCircle2, Clock, Ban,
  RefreshCw, Eye, FileDown, BarChart3, PieChart, Activity,
  Building2, AlertTriangle, Percent
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  PieChart as RechartsPie, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--accent))",
  "hsl(210, 70%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(30, 80%, 55%)",
];

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em Andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const tipoLabels: Record<string, string> = {
  eliminar: "Eliminar",
  reduzir: "Reduzir",
  renegociar: "Renegociar",
  monitorar: "Monitorar",
};

const prioridadeLabels: Record<string, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function RelatorioPlanoReducao() {
  const { planoId } = useParams<{ planoId: string }>();
  const navigate = useNavigate();

  const { data: plano, isLoading: planoLoading } = useQuery({
    queryKey: ["plano-reducao", planoId],
    enabled: !!planoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planos_reducao")
        .select("*")
        .eq("id", planoId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: revisoes, isLoading: revisoesLoading } = useQuery({
    queryKey: ["relatorio-revisoes", planoId],
    enabled: !!planoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_pagar_revisao")
        .select("*")
        .eq("plano_id", planoId!);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch supplier metrics
  const fornecedorCodigos = useMemo(
    () => [...new Set(revisoes?.map((r) => r.fornecedor_codigo).filter(Boolean) || [])] as string[],
    [revisoes]
  );

  const { data: metricasMap } = useQuery({
    queryKey: ["fornecedor-metricas-relatorio", fornecedorCodigos],
    enabled: fornecedorCodigos.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_fornecedor_metricas_reducao", {
        p_codigos: fornecedorCodigos,
      });
      if (error) throw error;
      const map: Record<string, any> = {};
      data?.forEach((m: any) => { map[m.fornecedor_codigo] = m; });
      return map;
    },
  });

  // KPIs
  const totalItens = revisoes?.length || 0;
  const valorTotal = revisoes?.reduce((acc, r) => acc + (r.valor_atual || 0), 0) || 0;
  const metaTotal = revisoes?.reduce((acc, r) => acc + (r.meta_reducao_valor || 0), 0) || 0;
  const economiaRealizada =
    revisoes?.filter((r) => r.status === "concluido").reduce((acc, r) => acc + (r.resultado_obtido || 0), 0) || 0;
  const progressoPct = metaTotal > 0 ? (economiaRealizada / metaTotal) * 100 : 0;

  // Ativos/Inativos from metrics
  const ativos = fornecedorCodigos.filter((c) => {
    const m = metricasMap?.[c];
    if (!m?.ultimo_pagamento) return false;
    return differenceInDays(new Date(), new Date(m.ultimo_pagamento)) <= 60;
  }).length;
  const inativos = fornecedorCodigos.length - ativos;

  // Charts data
  const statusData = useMemo(() => {
    if (!revisoes) return [];
    const counts: Record<string, number> = {};
    revisoes.forEach((r) => {
      const s = r.status || "pendente";
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([k, v]) => ({ name: statusLabels[k] || k, value: v }));
  }, [revisoes]);

  const tipoData = useMemo(() => {
    if (!revisoes) return [];
    const counts: Record<string, number> = {};
    revisoes.forEach((r) => {
      const t = r.tipo_revisao || "monitorar";
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts).map(([k, v]) => ({ name: tipoLabels[k] || k, value: v }));
  }, [revisoes]);

  const topFornecedores = useMemo(() => {
    if (!revisoes) return [];
    const sums: Record<string, number> = {};
    revisoes.forEach((r) => {
      const f = r.fornecedor_nome || "Sem fornecedor";
      sums[f] = (sums[f] || 0) + (r.valor_atual || 0);
    });
    return Object.entries(sums)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, valor]) => ({ name: name.length > 20 ? name.slice(0, 20) + "…" : name, valor }));
  }, [revisoes]);

  const prioridadeData = useMemo(() => {
    if (!revisoes) return [];
    const sums: Record<string, number> = {};
    revisoes.forEach((r) => {
      const p = r.prioridade || "media";
      sums[p] = (sums[p] || 0) + (r.valor_atual || 0);
    });
    return Object.entries(sums).map(([k, v]) => ({ name: prioridadeLabels[k] || k, valor: v }));
  }, [revisoes]);

  // Supplier summary table
  const fornecedorSummary = useMemo(() => {
    if (!revisoes) return [];
    const map: Record<string, { nome: string; codigo: string; valorTotal: number; count: number; substituto: string | null; statuses: string[] }> = {};
    revisoes.forEach((r) => {
      const key = r.fornecedor_codigo || r.fornecedor_nome || "unknown";
      if (!map[key]) {
        map[key] = { nome: r.fornecedor_nome || "", codigo: r.fornecedor_codigo || "", valorTotal: 0, count: 0, substituto: null, statuses: [] };
      }
      map[key].valorTotal += r.valor_atual || 0;
      map[key].count += 1;
      if (r.substituto_sugerido) map[key].substituto = r.substituto_sugerido;
      map[key].statuses.push(r.status || "pendente");
    });
    return Object.values(map).sort((a, b) => b.valorTotal - a.valorTotal);
  }, [revisoes]);

  const isLoading = planoLoading || revisoesLoading;

  const renderCustomLabel = ({ name, percent }: any) =>
    percent > 0.05 ? `${name} (${(percent * 100).toFixed(0)}%)` : "";

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{plano?.nome || "Relatório do Plano"}</h1>
          {plano?.descricao && <p className="text-sm text-muted-foreground mt-1">{plano.descricao}</p>}
        </div>
        <div className="flex items-center gap-2">
          {plano?.created_at && (
            <span className="text-xs text-muted-foreground">
              Criado em {format(parseISO(plano.created_at), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          )}
          <Badge variant={plano?.status === "ativo" ? "default" : "secondary"}>
            {plano?.status === "ativo" ? "Ativo" : "Arquivado"}
          </Badge>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          title="Total de Itens"
          value={totalItens}
          icon={Target}
          variant="info"
          loading={isLoading}
        />
        <KpiCard
          title="Valor sob Análise"
          value={fmtCurrency(valorTotal)}
          icon={TrendingDown}
          variant="warning"
          loading={isLoading}
        />
        <KpiCard
          title="Meta de Economia"
          value={fmtCurrency(metaTotal)}
          icon={Target}
          variant="default"
          loading={isLoading}
        />
        <KpiCard
          title="Economia Realizada"
          value={fmtCurrency(economiaRealizada)}
          icon={CheckCircle2}
          variant="success"
          loading={isLoading}
        />
        <KpiCard
          title="Progresso"
          value={`${progressoPct.toFixed(1)}%`}
          icon={Percent}
          variant={progressoPct >= 75 ? "success" : progressoPct >= 40 ? "warning" : "destructive"}
          loading={isLoading}
        />
        <KpiCard
          title="Ativos / Inativos"
          value={`${ativos} / ${inativos}`}
          icon={Activity}
          variant="info"
          loading={isLoading}
          subtitle="Fornecedores (60 dias)"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer
          title="Distribuição por Status"
          icon={<PieChart className="h-4 w-4 text-primary" />}
          chartHeight="h-[300px]"
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={100}
                  innerRadius={50}
                  dataKey="value"
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </RechartsPie>
            </ResponsiveContainer>
          }
        />

        <ChartContainer
          title="Distribuição por Tipo de Ação"
          icon={<PieChart className="h-4 w-4 text-primary" />}
          chartHeight="h-[300px]"
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={tipoData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={100}
                  innerRadius={50}
                  dataKey="value"
                >
                  {tipoData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </RechartsPie>
            </ResponsiveContainer>
          }
        />

        <ChartContainer
          title="Top 10 Fornecedores por Valor"
          icon={<BarChart3 className="h-4 w-4 text-primary" />}
          chartHeight="h-[350px]"
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topFornecedores} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => fmtCurrency(v)} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          }
        />

        <ChartContainer
          title="Valor por Prioridade"
          icon={<AlertTriangle className="h-4 w-4 text-warning" />}
          chartHeight="h-[350px]"
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={prioridadeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => fmtCurrency(v)} />
                <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                  {prioridadeData.map((entry, i) => {
                    const color = entry.name === "Alta"
                      ? "hsl(var(--destructive))"
                      : entry.name === "Média"
                        ? "hsl(var(--warning))"
                        : "hsl(var(--success))";
                    return <Cell key={i} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          }
        />
      </div>

      {/* Supplier detail table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Resumo por Fornecedor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Média/Mês</TableHead>
                  <TableHead>Último Pgto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Substituto</TableHead>
                  <TableHead className="text-center">Itens</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fornecedorSummary.map((f) => {
                  const metricas = metricasMap?.[f.codigo];
                  const ultimoPgto = metricas?.ultimo_pagamento;
                  const diasSemPgto = ultimoPgto ? differenceInDays(new Date(), new Date(ultimoPgto)) : null;
                  const isAtivo = diasSemPgto !== null && diasSemPgto <= 60;
                  const mediaMensal = metricas?.media_mensal || 0;

                  return (
                    <TableRow key={f.codigo || f.nome}>
                      <TableCell className="font-medium max-w-[200px] truncate">{f.nome}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmtCurrency(f.valorTotal)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {mediaMensal > 0 ? fmtCurrency(mediaMensal) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {ultimoPgto ? format(new Date(ultimoPgto), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        {diasSemPgto !== null ? (
                          <Badge variant={isAtivo ? "default" : "destructive"} className="text-xs">
                            {isAtivo ? "Ativo" : `Inativo (${diasSemPgto}d)`}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm max-w-[150px] truncate">
                        {f.substituto || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-xs">{f.count}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {fornecedorSummary.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum fornecedor encontrado neste plano.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
