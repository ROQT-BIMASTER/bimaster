import { useMemo } from "react";
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip,
  ReferenceArea, LabelList, CartesianGrid,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useVendasRankingCliente } from "@/hooks/vendas/useVendasRankingCliente";
import { formatMi } from "@/lib/vendas/format";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  de: string;
  ate: string;
  empresa: number | null;
  tabelaPrecoId?: number | null;
  uf?: string | null;
  clienteId?: number | null;
  vendedorId?: number | null;
  source?: "futura" | "rubysp";
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function BlocoScatterClientes({ de, ate, empresa, tabelaPrecoId, uf, clienteId, vendedorId, source = "futura" }: Props) {
  const { data, isLoading } = useVendasRankingCliente({ de, ate, empresa, tabelaPrecoId, uf, clienteId, vendedorId, source });
  const rows = data ?? [];

  const { pontos, proximos, destaques, aside, maxY } = useMemo(() => {
    const ordenados = [...rows].sort((a, b) => b.faturamento - a.faturamento);
    const top = ordenados.slice(0, 6);
    const near = ordenados.slice(6, 14);
    const restante = ordenados.slice(14);
    return {
      destaques: top.map((r) => ({
        x: r.notas,
        y: r.faturamento,
        nome: truncate(r.cliente_nome, 20),
        nomeCompleto: r.cliente_nome,
      })),
      proximos: near.map((r) => ({
        x: r.notas,
        y: r.faturamento,
        nome: r.cliente_nome,
        nomeCompleto: r.cliente_nome,
      })),
      aside: near,
      pontos: restante.map((r) => ({
        x: r.notas,
        y: r.faturamento,
        nome: r.cliente_nome,
        nomeCompleto: r.cliente_nome,
      })),
      maxY: ordenados[0]?.faturamento ?? 0,
    };
  }, [rows]);

  return (
    <section className="pt-14">
      <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl text-rv-ink">Clientes · valor × recorrência</h2>
          <p className="text-xs text-rv-text-suave mt-1">
            Cada ponto é um cliente. Faixa verde marca os clientes-chave (metade superior).
          </p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-[380px] w-full" />
      ) : rows.length === 0 ? (
        <div className="h-[380px] flex items-center justify-center text-sm text-rv-text-suave border-t border-rv-linha">
          Sem clientes com vendas no período.
        </div>
      ) : (
        <div className="grid md:grid-cols-4 gap-6 border-t border-rv-linha pt-6">
          <div className="md:col-span-3">
            <ResponsiveContainer width="100%" height={380}>
              <ScatterChart margin={{ top: 16, right: 24, bottom: 32, left: 8 }}>
                <CartesianGrid stroke="hsl(var(--rv-muted) / 0.4)" strokeDasharray="2 4" />
                <ReferenceArea
                  y1={maxY * 0.5}
                  y2={maxY * 1.05}
                  fill="hsl(var(--rv-faixa-verde))"
                  fillOpacity={0.55}
                  stroke="none"
                  label={{
                    value: "Clientes-chave",
                    position: "insideTopLeft",
                    fill: "hsl(var(--rv-positivo))",
                    fontSize: 10,
                    fontWeight: 600,
                    style: { textTransform: "uppercase", letterSpacing: "0.14em" },
                  }}
                />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Notas"
                  tick={{ fontSize: 10, fill: "hsl(var(--rv-ink) / 0.85)" }}
                  axisLine={{ stroke: "hsl(var(--rv-linha))" }}
                  tickLine={false}
                  label={{ value: "Nº de notas", position: "insideBottom", offset: -12, fontSize: 10, fill: "hsl(var(--rv-ink) / 0.85)" }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Faturamento"
                  tick={{ fontSize: 10, fill: "hsl(var(--rv-ink) / 0.85)" }}
                  tickFormatter={(v: number) => formatMi(v)}
                  axisLine={{ stroke: "hsl(var(--rv-linha))" }}
                  tickLine={false}
                  width={72}
                />
                <ZAxis range={[26, 26]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3", stroke: "hsl(var(--rv-ink) / 0.4)" }}
                  contentStyle={{
                    borderRadius: 4,
                    border: "1px solid hsl(var(--rv-linha))",
                    background: "hsl(var(--rv-bg))",
                    fontSize: 12,
                  }}
                  formatter={(v: number, k: string) =>
                    k === "y" ? [formatCurrency(v), "Faturamento"] : [Number(v).toLocaleString("pt-BR"), "Notas"]
                  }
                  labelFormatter={(_l, p) => (p?.[0]?.payload as any)?.nomeCompleto ?? ""}
                />
                {/* Cauda: pontos menores e um pouco mais definidos */}
                <Scatter
                  data={pontos}
                  fill="hsl(var(--rv-ink))"
                  fillOpacity={0.45}
                />
                {/* Próximos destaques: médio, cor firme */}
                <Scatter
                  data={proximos}
                  fill="hsl(var(--rv-ink) / 0.85)"
                  shape={(props: any) => {
                    const { cx, cy } = props;
                    return <circle cx={cx} cy={cy} r={5} fill="hsl(var(--rv-ink) / 0.85)" />;
                  }}
                />
                {/* Top destaques: verde-oliva com stroke, maior, rótulo com halo */}
                <Scatter
                  data={destaques}
                  fill="hsl(var(--rv-positivo))"
                  shape={(props: any) => {
                    const { cx, cy } = props;
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={7}
                        fill="hsl(var(--rv-positivo))"
                        stroke="hsl(var(--rv-ink))"
                        strokeWidth={1.5}
                      />
                    );
                  }}
                >
                  <LabelList
                    dataKey="nome"
                    position="right"
                    style={{
                      fill: "hsl(var(--rv-ink))",
                      fontSize: 11,
                      fontWeight: 600,
                      paintOrder: "stroke",
                      stroke: "hsl(var(--rv-bg))",
                      strokeWidth: 3,
                      strokeLinejoin: "round",
                    }}
                  />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <aside className="md:col-span-1">
            <div className="text-[10px] uppercase tracking-wider text-rv-text-suave mb-3">
              Próximos destaques
            </div>
            <ul className="space-y-2">
              {aside.map((c) => (
                <li key={`${c.cliente_id ?? c.cliente_nome}`} className="text-xs text-rv-ink">
                  <span className="text-rv-positivo mr-1.5">•</span>
                  <span className="truncate inline-block max-w-[85%] align-middle" title={c.cliente_nome}>
                    {c.cliente_nome}
                  </span>
                  <div className="text-[11px] tabular-nums mt-0.5 ml-3" style={{ color: "hsl(var(--rv-ink) / 0.75)" }}>
                    {formatMi(c.faturamento)} · {c.notas} nt
                  </div>
                </li>
              ))}
              {aside.length === 0 && (
                <li className="text-xs text-rv-text-suave">Sem outros destaques.</li>
              )}
            </ul>
          </aside>
        </div>
      )}
    </section>
  );
}
