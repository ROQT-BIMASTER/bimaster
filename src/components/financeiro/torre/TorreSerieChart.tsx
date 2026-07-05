// Série mensal com banda de normalidade (média 12m ± 2σ) da Torre de Despesas.
// ComposedChart recharts: Area (range) para a banda + Line para a série do
// departamento selecionado (ou dos totais). Tokens de chart-colors — nunca hex.
import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { chartColors } from "@/lib/chart-colors";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import type { TorreDepartamentosPayload, TorreSelecao } from "@/types/financeiro/torre-despesas";

interface Props {
  payload: TorreDepartamentosPayload | undefined;
  isLoading: boolean;
  selecao: TorreSelecao | null;
}

interface Ponto {
  mes: string;
  mesLabel: string;
  valor: number;
  banda: [number, number] | null;
}

interface SerieTooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number | [number, number] }>;
  label?: string;
}

function SerieTooltip({ active, payload, label }: SerieTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const valorEntry = payload.find((p) => p.dataKey === "valor");
  const bandaEntry = payload.find((p) => p.dataKey === "banda");
  const banda = Array.isArray(bandaEntry?.value) ? (bandaEntry.value as [number, number]) : null;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[180px]">
      <p className="text-sm font-medium text-foreground mb-1">{label}</p>
      {typeof valorEntry?.value === "number" && (
        <p className="text-sm font-semibold tabular-nums">{formatCurrency(valorEntry.value)}</p>
      )}
      {banda && (
        <p className="text-xs text-muted-foreground mt-1 tabular-nums">
          Banda: {formatCurrency(banda[0])} – {formatCurrency(banda[1])}
        </p>
      )}
    </div>
  );
}

export function TorreSerieChart({ payload, isLoading, selecao }: Props) {
  const { dados, titulo } = useMemo((): { dados: Ponto[]; titulo: string } => {
    if (!payload) return { dados: [], titulo: "Evolução mensal" };

    const deptSelecionado = selecao
      ? payload.departamentos.find(
          (d) => d.departamento_id === selecao.departamentoId && (d.departamento_id !== null || selecao.semDepto),
        )
      : undefined;

    const serie = deptSelecionado ? deptSelecionado.serie : payload.totais.serie;

    // Banda: departamento traz média/desvio 12m do servidor; para os totais o
    // contrato não expõe média/desvio — calculamos no cliente sobre a própria
    // série (excluindo o mês de referência), com o mesmo corte n>=6 do backend.
    let media: number | null = null;
    let desvio: number | null = null;
    if (deptSelecionado) {
      media = deptSelecionado.media_12m;
      desvio = deptSelecionado.desvio_12m;
    } else {
      const historico = payload.totais.serie.filter((p) => p.mes !== payload.meta.mes_ref).map((p) => p.valor);
      if (historico.length >= 6) {
        const m = historico.reduce((s, v) => s + v, 0) / historico.length;
        const variancia = historico.reduce((s, v) => s + (v - m) ** 2, 0) / (historico.length - 1);
        media = m;
        desvio = Math.sqrt(variancia);
      }
    }

    const banda: [number, number] | null =
      media !== null && desvio !== null && desvio > 0 ? [Math.max(0, media - 2 * desvio), media + 2 * desvio] : null;

    return {
      dados: serie.map((p) => ({
        mes: p.mes,
        mesLabel: format(parseISO(p.mes), "MMM/yy", { locale: ptBR }),
        valor: p.valor,
        banda,
      })),
      titulo: deptSelecionado ? `Evolução mensal — ${deptSelecionado.departamento_nome}` : "Evolução mensal — total",
    };
  }, [payload, selecao]);

  if (isLoading || !payload) {
    return <div className="h-72 rounded-2xl border border-border bg-card animate-pulse" />;
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-4 flex flex-col">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
        <p className="text-[11px] text-muted-foreground">Faixa translúcida = média 12m ± 2 desvios</p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dados} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis
              dataKey="mesLabel"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => formatCurrencyCompact(v)}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <Tooltip content={<SerieTooltip />} />
            <Area
              dataKey="banda"
              name="Banda de normalidade"
              stroke="none"
              fill={chartColors.accent}
              fillOpacity={0.12}
              isAnimationActive={false}
              activeDot={false}
            />
            <Line
              type="monotone"
              dataKey="valor"
              name="Despesa"
              stroke={chartColors.primary}
              strokeWidth={2}
              dot={{ fill: chartColors.primary, strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
