import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useVendasSerieMensal, type VendasFilters } from "@/hooks/useVendasAnalise";
import { formatMi, formatVarPct, variacaoTone } from "@/lib/vendas/format";
import { formatCurrency } from "@/lib/formatters";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface Props {
  ano: number;
  mes?: number | null;
  empresa: number | null;
  tabelaPrecoId?: number | null;
  uf?: string | null;
  clienteId?: number | null;
  vendedorId?: number | null;
  source?: "futura" | "rubysp";
}

export function BlocoMensalYoY({ ano, mes, empresa, tabelaPrecoId, uf, clienteId, vendedorId, source = "futura" }: Props) {
  const anoAnterior = ano - 1;

  const pad = (n: number) => String(n).padStart(2, "0");
  const rangeFor = (y: number): { de: string; ate: string } => {
    if (mes != null) {
      const lastDay = new Date(y, mes, 0).getDate();
      return { de: `${y}-${pad(mes)}-01`, ate: `${y}-${pad(mes)}-${pad(lastDay)}` };
    }
    return { de: `${y}-01-01`, ate: `${y}-12-31` };
  };
  const rAtual = rangeFor(ano);
  const rAnt = rangeFor(anoAnterior);

  const filtroAtual: VendasFilters = {
    de: rAtual.de, ate: rAtual.ate,
    empresa, vendedor: null, coordenador: null,
    tabelaPrecoId: tabelaPrecoId ?? null, uf: uf ?? null,
    clienteId: clienteId ?? null, vendedorId: vendedorId ?? null,
  };
  const filtroAnt: VendasFilters = {
    de: rAnt.de, ate: rAnt.ate,
    empresa, vendedor: null, coordenador: null,
    tabelaPrecoId: tabelaPrecoId ?? null, uf: uf ?? null,
    clienteId: clienteId ?? null, vendedorId: vendedorId ?? null,
  };

  const atual = useVendasSerieMensal(filtroAtual, source);
  const anterior = useVendasSerieMensal(filtroAnt, source);

  const today = new Date();
  const currentY = today.getFullYear();
  const currentM = today.getMonth() + 1;
  const isCurrentYear = ano === currentY;

  const rows = useMemo(() => {
    const mapAtual = new Map<number, number>();
    (atual.data ?? []).forEach((d) => {
      const m = parseLocalDate(d.mes).getMonth() + 1;
      mapAtual.set(m, (mapAtual.get(m) ?? 0) + d.faturamento);
    });
    const mapAnt = new Map<number, number>();
    (anterior.data ?? []).forEach((d) => {
      const m = parseLocalDate(d.mes).getMonth() + 1;
      mapAnt.set(m, (mapAnt.get(m) ?? 0) + d.faturamento);
    });
    const all = Array.from({ length: 12 }, (_, i) => {
      const mm = i + 1;
      const future = isCurrentYear && mm > currentM;
      const at = future ? null : (mapAtual.get(mm) ?? 0);
      const an = mapAnt.get(mm) ?? 0;
      const varr = at != null && an > 0 ? at / an - 1 : null;
      return {
        mesIdx: mm,
        label: MESES[i],
        atual: at,
        anterior: an,
        varr,
        varrLabel: varr == null ? "" : formatVarPct(varr),
      };
    });
    return mes != null ? all.filter((r) => r.mesIdx === mes) : all;
  }, [atual.data, anterior.data, isCurrentYear, currentM, mes]);

  const varPeriodo = useMemo(() => {
    const upto = isCurrentYear ? currentM : 12;
    let a = 0, b = 0;
    for (let i = 0; i < upto; i++) {
      if (rows[i].atual != null) a += rows[i].atual as number;
      b += rows[i].anterior;
    }
    return b > 0 ? a / b - 1 : null;
  }, [rows, isCurrentYear, currentM]);

  const isLoading = atual.isLoading || anterior.isLoading;
  const empty = !isLoading && rows.every((r) => (r.atual ?? 0) === 0 && r.anterior === 0);

  const toneClass =
    variacaoTone(varPeriodo) === "positivo" ? "text-rv-positivo"
    : variacaoTone(varPeriodo) === "negativo" ? "text-rv-negativo"
    : "text-rv-text-suave";

  return (
    <section className="pt-14">
      <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl text-rv-ink">Receita mensal · {ano} vs {anoAnterior}</h2>
          <p className={`text-xs mt-1 ${toneClass}`}>
            Variação do período (jan..{isCurrentYear ? MESES[currentM - 1].toLowerCase() : "dez"}):{" "}
            <span className="font-medium tabular-nums">{formatVarPct(varPeriodo)}</span>
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-rv-text-suave">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "hsl(var(--rv-sage))" }} />
            {ano}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "hsl(var(--rv-cinza-barra))" }} />
            {anoAnterior}
          </div>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-[320px] w-full" />
      ) : empty ? (
        <div className="h-[320px] flex items-center justify-center text-sm text-rv-text-suave border-t border-rv-linha">
          Sem vendas no período.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={rows} margin={{ top: 40, right: 8, left: 0, bottom: 8 }} barGap={2}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "hsl(var(--rv-text-suave))" }}
              axisLine={{ stroke: "hsl(var(--rv-linha))" }}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: "hsl(var(--rv-faixa-verde))" }}
              contentStyle={{
                borderRadius: 4,
                border: "1px solid hsl(var(--rv-linha))",
                background: "hsl(var(--rv-bg))",
                color: "hsl(var(--rv-ink))",
                fontSize: 12,
                padding: "8px 10px",
                boxShadow: "0 6px 24px -12px hsl(var(--rv-ink) / 0.25)",
              }}
              labelStyle={{ color: "hsl(var(--rv-ink))", fontWeight: 600, fontSize: 12, marginBottom: 4 }}
              itemStyle={{ color: "hsl(var(--rv-ink))", fontSize: 12, padding: 0 }}
              formatter={(v: any, k: string) => [
                v == null ? "—" : formatCurrency(Number(v)),
                k === "atual" ? String(ano) : String(anoAnterior),
              ]}
            />
            <Bar dataKey="anterior" fill="hsl(var(--rv-cinza-barra))" radius={[10, 10, 0, 0]} maxBarSize={22} />
            <Bar dataKey="atual" fill="hsl(var(--rv-sage))" radius={[10, 10, 0, 0]} maxBarSize={22}>
              <LabelList
                dataKey="varrLabel"
                position="top"
                content={(props: any) => {
                  const { x, y, width, value, index } = props;
                  const row = rows[index];
                  if (!value || row?.varr == null) return null;
                  const tone = variacaoTone(row.varr);
                  const color =
                    tone === "positivo" ? "hsl(var(--rv-positivo))"
                    : tone === "negativo" ? "hsl(var(--rv-negativo))"
                    : "hsl(var(--rv-text-suave))";
                  return (
                    <text
                      x={Number(x) + Number(width) / 2}
                      y={Number(y) - 6}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight={500}
                      fill={color}
                    >
                      {value}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
