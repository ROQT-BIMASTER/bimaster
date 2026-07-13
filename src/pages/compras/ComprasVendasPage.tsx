import { useMemo, useState } from "react";
import { format, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Info,
  Layers,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { formatCurrency } from "@/lib/formatters";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  useComprasVendasMensal,
  EMPRESA_RESULT_NOME,
  nomeEmpresaResult,
} from "@/hooks/compras/useEntradasResult";

const EMPRESAS = Object.entries(EMPRESA_RESULT_NOME).map(([id, nome]) => ({
  id: Number(id),
  nome,
}));

function fmtMesLabel(mes: string): string {
  const d = parseLocalDate(mes);
  return d ? format(d, "MMM/yy", { locale: ptBR }) : mes;
}

function fmtCurrencyShort(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000)
    return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })}mi`;
  if (abs >= 1_000)
    return `R$ ${(v / 1_000).toLocaleString("pt-BR", {
      maximumFractionDigits: 0,
    })}k`;
  return formatCurrency(v);
}

export default function ComprasVendasPage() {
  const now = new Date();
  const [empresa, setEmpresa] = useState<string>("grupo");
  const [from, setFrom] = useState<string>(
    format(startOfMonth(subMonths(now, 11)), "yyyy-MM-dd"),
  );
  const [to, setTo] = useState<string>(format(now, "yyyy-MM-dd"));

  const empresasFiltro = useMemo(
    () => (empresa === "grupo" ? [] : [Number(empresa)]),
    [empresa],
  );

  const { data, isLoading } = useComprasVendasMensal({
    empresas: empresasFiltro,
    from,
    to,
  });

  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Agrega por mês (grupo soma todas as filiais)
  const chartRows = useMemo(() => {
    const rows = data ?? [];
    const byMes = new Map<
      string,
      {
        mes: string;
        compras_revenda: number;
        compras_uso_consumo: number;
        devolucoes_venda: number;
        transferencias: number;
        vendas_preco: number;
        vendas_ultimo_custo: number;
        vendas_custo_familia: number;
      }
    >();
    for (const r of rows) {
      const cur = byMes.get(r.mes) ?? {
        mes: r.mes,
        compras_revenda: 0,
        compras_uso_consumo: 0,
        devolucoes_venda: 0,
        transferencias: 0,
        vendas_preco: 0,
        vendas_ultimo_custo: 0,
        vendas_custo_familia: 0,
      };
      cur.compras_revenda += r.compras_revenda;
      cur.compras_uso_consumo += r.compras_uso_consumo;
      cur.devolucoes_venda += r.devolucoes_venda;
      cur.transferencias += r.transferencias;
      cur.vendas_preco += r.vendas_preco;
      cur.vendas_ultimo_custo += r.vendas_ultimo_custo;
      cur.vendas_custo_familia += r.vendas_custo_familia;
      byMes.set(r.mes, cur);
    }
    return Array.from(byMes.values())
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((r) => {
        const ym = r.mes.slice(0, 7);
        const parcial = ym === currentYM;
        return {
          ...r,
          mesLabel: fmtMesLabel(r.mes) + (parcial ? " *" : ""),
          parcial,
          // banda de custo verdadeiro (piso→teto)
          banda_piso: r.vendas_ultimo_custo,
          banda_faixa: Math.max(
            0,
            r.vendas_custo_familia - r.vendas_ultimo_custo,
          ),
        };
      });
  }, [data, currentYM]);

  const hasParcial = chartRows.some((r) => r.parcial);

  const kpis = useMemo(() => {
    let compras = 0;
    let vendasCustoBaixo = 0;
    let vendasCustoAlto = 0;
    for (const r of chartRows) {
      compras += r.compras_revenda;
      vendasCustoBaixo += r.vendas_ultimo_custo;
      vendasCustoAlto += r.vendas_custo_familia;
    }
    // Régua principal = PISO (vendas_ultimo_custo); teto é apenas referência
    const razao = vendasCustoBaixo > 0 ? compras / vendasCustoBaixo : 0;
    const cobertura = compras - vendasCustoBaixo;
    return {
      compras,
      vendasCustoBaixo,
      vendasCustoAlto,
      razao,
      cobertura,
    };
  }, [chartRows]);


  return (
    <DashboardLayout>
      <div className="w-full px-4 md:px-6 py-6 space-y-4">
        <PageHeader
          title="Compras × Vendas"
          description="Confronto mensal entre compras de revenda e vendas a custo — leitura de cobertura de estoque"
          icon={Layers}
          breadcrumbs={[
            { label: "Compras", href: "/dashboard/compras" },
            { label: "Compras × Vendas" },
          ]}
        />

        <Card className="p-3 border-l-4 border-l-sky-500 bg-sky-500/5">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 text-sky-600 mt-0.5" />
            <div className="space-y-1">
              <p>
                A régua principal de <strong>vendas a custo</strong> é o{" "}
                <strong>último custo de compra</strong> (piso). O{" "}
                <strong>custo médio da família</strong> (teto) aparece apenas
                como referência na banda do gráfico — o campo de custo médio do
                ERP não é confiável. A linha tracejada mostra o faturamento a
                preço (eixo direito).
              </p>
              <p>
                Painel considera apenas operações com terceiros — movimentos
                entre empresas do grupo aparecem como transferência.
              </p>
            </div>
          </div>
        </Card>


        {/* Filtros */}
        <Card className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Empresa
              </label>
              <Select value={empresa} onValueChange={setEmpresa}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grupo">
                    Grupo (soma todas as filiais)
                  </SelectItem>
                  {EMPRESAS.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.nome} ({e.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                De
              </label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Até
              </label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-[160px]"
              />
            </div>
          </div>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4 bg-card/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShoppingCart className="h-3.5 w-3.5" /> Compras (revenda)
            </div>
            <div className="text-2xl font-semibold mt-1">
              {formatCurrency(kpis.compras)}
            </div>
          </Card>
          <Card className="p-4 bg-card/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> Vendas a custo (banda)
            </div>
            <div className="text-lg font-semibold mt-1 leading-tight">
              {formatCurrency(kpis.vendasCustoBaixo)}
              <span className="text-muted-foreground text-sm"> — </span>
              {formatCurrency(kpis.vendasCustoAlto)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              piso (último custo) → teto (custo família)
            </div>
          </Card>
          <Card className="p-4 bg-card/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Layers className="h-3.5 w-3.5" /> Razão compra ÷ venda-custo
            </div>
            <div className="text-2xl font-semibold mt-1">
              {kpis.razao > 0
                ? kpis.razao.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : "—"}
              <span className="text-sm text-muted-foreground">×</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              vs. piso (último custo)
              {kpis.vendasCustoAlto > 0 && (
                <>
                  {" · ref. teto: "}
                  {(kpis.compras / kpis.vendasCustoAlto).toLocaleString(
                    "pt-BR",
                    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                  )}
                  ×
                </>
              )}
            </div>
          </Card>
          <Card className="p-4 bg-card/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {kpis.cobertura >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-600" />
              )}
              Cobertura (compra − venda-custo piso)
            </div>
            <div
              className={`text-2xl font-semibold mt-1 ${
                kpis.cobertura >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {formatCurrency(kpis.cobertura)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {kpis.cobertura >= 0 ? "estoque subindo" : "estoque caindo"}
              {kpis.vendasCustoAlto > 0 && (
                <>
                  {" · ref. vs. teto: "}
                  {formatCurrency(kpis.compras - kpis.vendasCustoAlto)}
                </>
              )}
            </div>

          </Card>
        </div>

        {/* Gráfico */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">
            Compras vs vendas a custo — {" "}
            {empresa === "grupo"
              ? "Grupo"
              : nomeEmpresaResult(Number(empresa))}
          </h3>
          {isLoading ? (
            <Skeleton className="h-[380px] w-full" />
          ) : chartRows.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
              Sem dados no período.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={380}>
              <ComposedChart
                data={chartRows}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="mesLabel" tick={{ fontSize: 12 }} />
                <YAxis
                  yAxisId="left"
                  tickFormatter={fmtCurrencyShort}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={fmtCurrencyShort}
                  tick={{ fontSize: 11 }}
                />
                <RTooltip
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === "banda_piso" || name === "banda_faixa")
                      return null as any;
                    return [formatCurrency(Number(value)), name];
                  }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(v) => {
                    if (v === "banda_piso") return "Custo (piso — último)";
                    if (v === "banda_faixa") return "Banda até custo família";
                    if (v === "compras_revenda") return "Compras (revenda)";
                    if (v === "vendas_preco")
                      return "Vendas a preço (eixo →)";
                    return v;
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="compras_revenda"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                {/* Banda: base transparente + faixa colorida empilhada */}
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="banda_piso"
                  stackId="banda"
                  stroke="none"
                  fill="transparent"
                  legendType="none"
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="banda_faixa"
                  stackId="banda"
                  stroke="hsl(var(--module-fabrica, 25 90% 55%))"
                  fill="hsl(var(--module-fabrica, 25 90% 55%))"
                  fillOpacity={0.25}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="vendas_preco"
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 3"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Tabela mensal */}
        <Card className="overflow-hidden">
          <div className="p-3 border-b">
            <h3 className="text-sm font-semibold">Detalhe mensal</h3>
            <p className="text-xs text-muted-foreground">
              Devoluções e transferências são exibidas mas <strong>não</strong>{" "}
              somadas à compra.
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Compras revenda</TableHead>
                  <TableHead className="text-right">Uso/consumo</TableHead>
                  <TableHead className="text-right">
                    Vendas — custo piso
                  </TableHead>
                  <TableHead className="text-right">
                    Vendas — custo teto
                  </TableHead>
                  <TableHead className="text-right">Vendas a preço</TableHead>
                  <TableHead className="text-right">Devoluções</TableHead>
                  <TableHead className="text-right">Transferências</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : chartRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      Sem dados no período.
                    </TableCell>
                  </TableRow>
                ) : (
                  chartRows
                    .slice()
                    .reverse()
                    .map((r) => (
                      <TableRow key={r.mes}>
                        <TableCell className="font-medium">
                          {r.mesLabel}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(r.compras_revenda)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(r.compras_uso_consumo)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(r.vendas_ultimo_custo)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(r.vendas_custo_familia)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(r.vendas_preco)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(r.devolucoes_venda)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(r.transferencias)}
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
