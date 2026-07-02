import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, Cell,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { FuturaBackButton } from "@/components/fornecedor/FuturaBackButton";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/formatters";
import { formatMi, formatVarPct, variacaoTone } from "@/lib/vendas/format";
import { useVendasKpis, useVendasSerieMensal, type VendasFilters } from "@/hooks/useVendasAnalise";
import { useVendasYoy, type YoyDim } from "@/hooks/vendas/useVendasYoy";
import { useVendasShareTabela } from "@/hooks/vendas/useVendasShareTabela";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";

const nowY = new Date().getFullYear();

const TAB_COLORS = [
  "hsl(var(--rv-tan))",
  "hsl(var(--rv-sage))",
  "hsl(var(--rv-steel))",
  "hsl(var(--rv-khaki))",
  "hsl(var(--rv-cinza-barra))",
];

function buildFilters(ano: number, empresa: number | null): VendasFilters {
  return {
    de: `${ano}-01-01`,
    ate: format(new Date(), "yyyy-MM-dd"),
    empresa,
    vendedor: null,
    coordenador: null,
  };
}

/* ─────────────── KPIs em faixa ─────────────── */

function KpiFaixa({ ano, empresa }: { ano: number; empresa: number | null }) {
  const filters = useMemo(() => buildFilters(ano, empresa), [ano, empresa]);
  const kpis = useVendasKpis(filters);
  const yoyPrev = useVendasYoy({ dim: "cliente", ano, empresa });
  const totalAtual = kpis.data?.faturamento ?? 0;
  const totalAnt = (yoyPrev.data ?? []).reduce((s, r) => s + r.fat_anterior, 0);
  const varTot = totalAnt > 0 ? totalAtual / totalAnt - 1 : null;
  const tone = variacaoTone(varTot);
  const toneClass =
    tone === "positivo" ? "text-rv-positivo"
    : tone === "negativo" ? "text-rv-negativo"
    : "text-rv-text-suave";

  const items = [
    { label: "Faturamento", value: formatMi(totalAtual), sub: `Ano ${ano}` },
    { label: "vs. ano anterior", value: formatVarPct(varTot), sub: "mesmo período", cls: toneClass },
    { label: "Ticket médio", value: kpis.data ? formatCurrency(kpis.data.ticket_medio) : "—", sub: "por nota" },
    { label: "Notas emitidas", value: kpis.data ? kpis.data.notas.toLocaleString("pt-BR") : "—", sub: "saída faturada" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-y border-rv-linha">
      {items.map((it, i) => (
        <div
          key={it.label}
          className={`px-6 py-6 ${i > 0 ? "md:border-l border-rv-linha" : ""} ${i % 2 === 1 ? "border-l md:border-l" : ""} border-rv-linha`}
        >
          <div className="text-[10px] uppercase tracking-[0.14em] font-medium text-rv-text-suave">
            {it.label}
          </div>
          {kpis.isLoading ? (
            <Skeleton className="h-8 w-28 mt-2" />
          ) : (
            <div className={`mt-2 font-display text-3xl md:text-4xl font-medium tabular-nums tracking-tight ${it.cls ?? "text-rv-ink"}`}>
              {it.value}
            </div>
          )}
          <div className="mt-1 text-xs text-rv-text-suave">{it.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────── Evolução mensal ─────────────── */

function EvolucaoMensal({ ano, empresa }: { ano: number; empresa: number | null }) {
  const filters = useMemo(() => buildFilters(ano, empresa), [ano, empresa]);
  const serie = useVendasSerieMensal(filters);
  const today = new Date();
  const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const rows = (serie.data ?? []).map((d) => {
    const dt = parseLocalDate(d.mes);
    const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    return {
      label: format(dt, "MMM", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase()),
      faturamento: d.faturamento,
      isCurrent: ym === currentYM,
      valueLabel: formatMi(d.faturamento),
    };
  });

  return (
    <section className="pt-10">
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="font-display text-xl text-rv-ink">Evolução mensal</h2>
        <span className="text-xs text-rv-text-suave">Faturamento por mês · ano {ano}</span>
      </div>
      {serie.isLoading ? (
        <Skeleton className="h-[280px] w-full" />
      ) : rows.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center text-sm text-rv-text-suave">
          Sem vendas no período.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={rows} margin={{ top: 32, right: 8, left: 0, bottom: 8 }}>
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
                fontSize: 12,
                color: "hsl(var(--rv-ink))",
              }}
              formatter={(v: number) => [formatCurrency(v), "Faturamento"]}
            />
            <Bar dataKey="faturamento" radius={[2, 2, 0, 0]} maxBarSize={44}>
              {rows.map((r, i) => (
                <Cell key={i} fill={r.isCurrent ? "hsl(var(--rv-khaki))" : "hsl(var(--rv-sage))"} />
              ))}
              <LabelList
                dataKey="valueLabel"
                position="top"
                style={{ fill: "hsl(var(--rv-text-suave))", fontSize: 10 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

/* ─────────────── Ranking YoY ─────────────── */

function RankingYoy({ ano, empresa }: { ano: number; empresa: number | null }) {
  const [dim, setDim] = useState<YoyDim>("cliente");
  const { data, isLoading } = useVendasYoy({ dim, ano, empresa });
  const rows = (data ?? []).slice(0, 100); // top 100 — evita render pesado

  return (
    <section className="pt-14">
      <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
        <h2 className="font-display text-xl text-rv-ink">Ranking com crescimento</h2>
        <Tabs value={dim} onValueChange={(v) => setDim(v as YoyDim)}>
          <TabsList className="bg-transparent border border-rv-linha rounded-none p-0 h-auto">
            <TabsTrigger
              value="cliente"
              className="rounded-none px-4 py-1.5 text-xs uppercase tracking-wider data-[state=active]:bg-rv-ink data-[state=active]:text-rv-bg data-[state=inactive]:text-rv-text-suave"
            >
              Cliente
            </TabsTrigger>
            <TabsTrigger
              value="vendedor"
              className="rounded-none px-4 py-1.5 text-xs uppercase tracking-wider data-[state=active]:bg-rv-ink data-[state=active]:text-rv-bg data-[state=inactive]:text-rv-text-suave"
            >
              Vendedor
            </TabsTrigger>
          </TabsList>
          <TabsContent value={dim} />
        </Tabs>
      </div>

      <div className="border-t border-rv-linha">
        <div className="grid grid-cols-[36px_1fr_130px_130px_100px_70px] gap-4 py-3 text-[10px] uppercase tracking-wider text-rv-text-suave border-b border-rv-linha">
          <div>#</div>
          <div>Nome</div>
          <div className="text-right">Ano {ano}</div>
          <div className="text-right">Ano {ano - 1}</div>
          <div className="text-right">Variação</div>
          <div className="text-right">Notas</div>
        </div>

        {isLoading ? (
          <div className="py-6 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-rv-text-suave">Sem dados no período.</div>
        ) : (
          <div className="max-h-[560px] overflow-y-auto">
            {rows.map((r, i) => {
              const tone = variacaoTone(r.variacao);
              const varCls =
                tone === "positivo" ? "text-rv-positivo"
                : tone === "negativo" ? "text-rv-negativo"
                : "text-rv-text-suave";
              return (
                <div
                  key={`${r.chave ?? "na"}-${i}`}
                  className="grid grid-cols-[36px_1fr_130px_130px_100px_70px] gap-4 py-3 items-baseline border-b border-rv-linha/70 hover:bg-rv-faixa-verde/40 transition-colors"
                >
                  <div className="text-xs text-rv-muted tabular-nums">{i + 1}</div>
                  <div className="text-sm text-rv-ink truncate flex items-center gap-2" title={r.nome}>
                    <span className="truncate">{r.nome}</span>
                    {r.novo && (
                      <span className="text-[9px] uppercase tracking-wider text-rv-positivo border border-rv-positivo/40 px-1.5 py-0.5">
                        novo
                      </span>
                    )}
                  </div>
                  <div className="text-right text-sm text-rv-ink tabular-nums">{formatMi(r.fat_atual)}</div>
                  <div className="text-right text-sm text-rv-text-suave tabular-nums">
                    {r.fat_anterior > 0 ? formatMi(r.fat_anterior) : "—"}
                  </div>
                  <div className={`text-right text-sm tabular-nums font-medium ${varCls}`}>
                    {r.novo ? "novo" : formatVarPct(r.variacao)}
                  </div>
                  <div className="text-right text-sm text-rv-muted tabular-nums">
                    {r.notas_atual.toLocaleString("pt-BR")}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/* ─────────────── Share por Tabela de Preço ─────────────── */

function ShareTabela({ ano, empresa }: { ano: number; empresa: number | null }) {
  const filters = useMemo(() => buildFilters(ano, empresa), [ano, empresa]);
  const { data, isLoading } = useVendasShareTabela({ de: filters.de, ate: filters.ate, empresa });
  const rows = data ?? [];
  const max = rows.reduce((m, r) => Math.max(m, r.share_pct), 0);

  return (
    <section className="pt-14 pb-16">
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="font-display text-xl text-rv-ink">Share por tabela de preço</h2>
        <span className="text-xs text-rv-text-suave">Ano {ano}</span>
      </div>

      {isLoading ? (
        <Skeleton className="h-[240px] w-full" />
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-rv-text-suave border-t border-rv-linha">
          Sem dados de tabela de preço no período.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-10 border-t border-rv-linha pt-6">
          <div className="space-y-4">
            {rows.map((r, i) => {
              const color = TAB_COLORS[i % TAB_COLORS.length];
              const width = max > 0 ? Math.max((r.share_pct / max) * 100, 2) : 0;
              return (
                <div key={`${r.tabela_preco_id ?? "n"}-${r.tabela_preco_nome}`} className="space-y-1.5">
                  <div className="flex items-baseline justify-between text-sm text-rv-ink">
                    <span className="truncate">{r.tabela_preco_nome}</span>
                    <span className="tabular-nums font-medium ml-4">
                      {r.share_pct.toFixed(1).replace(".", ",")}%
                    </span>
                  </div>
                  <div className="h-2 bg-rv-linha/60">
                    <div className="h-full" style={{ width: `${width}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <div className="grid grid-cols-[1fr_120px_70px] gap-4 py-2 text-[10px] uppercase tracking-wider text-rv-text-suave border-b border-rv-linha">
              <div>Tabela</div>
              <div className="text-right">Faturamento</div>
              <div className="text-right">Notas</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={`t-${r.tabela_preco_id ?? "n"}-${r.tabela_preco_nome}`}
                className="grid grid-cols-[1fr_120px_70px] gap-4 py-2.5 items-baseline border-b border-rv-linha/70"
              >
                <div className="flex items-center gap-2 text-sm text-rv-ink truncate">
                  <span
                    className="inline-block h-2 w-2 shrink-0"
                    style={{ background: TAB_COLORS[i % TAB_COLORS.length] }}
                  />
                  <span className="truncate">{r.tabela_preco_nome}</span>
                </div>
                <div className="text-right text-sm text-rv-ink tabular-nums">{formatMi(r.faturamento)}</div>
                <div className="text-right text-sm text-rv-muted tabular-nums">
                  {r.notas.toLocaleString("pt-BR")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ─────────────── Página ─────────────── */

export default function ResultadosVendas() {
  const [ano, setAno] = useState<number>(nowY);
  const [empresa] = useState<number | null>(null);
  const anos = [nowY, nowY - 1, nowY - 2];

  return (
    <DashboardLayout>
      <div className="resultados-vendas-theme min-h-screen bg-rv-bg text-rv-ink">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-8">
          <FuturaBackButton />

          <header className="mt-6 mb-10 flex items-end justify-between flex-wrap gap-6 border-b border-rv-linha pb-8">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-rv-text-suave mb-3">
                Futura · Vendas
              </div>
              <h1 className="font-display text-4xl md:text-5xl font-medium tracking-tight text-rv-ink">
                Resultados de Vendas
              </h1>
              <p className="mt-3 text-sm text-rv-text-suave max-w-xl">
                Panorama editorial das vendas faturadas, com evolução mensal, ranking com
                crescimento e distribuição por tabela de preço.
              </p>
            </div>

            <div className="flex items-center gap-1 border border-rv-linha">
              {anos.map((a) => (
                <button
                  key={a}
                  onClick={() => setAno(a)}
                  className={`px-4 py-2 text-xs tabular-nums transition-colors ${
                    a === ano
                      ? "bg-rv-ink text-rv-bg"
                      : "bg-transparent text-rv-text-suave hover:text-rv-ink"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </header>

          <KpiFaixa ano={ano} empresa={empresa} />
          <EvolucaoMensal ano={ano} empresa={empresa} />
          <RankingYoy ano={ano} empresa={empresa} />
          <ShareTabela ano={ano} empresa={empresa} />
        </div>
      </div>
    </DashboardLayout>
  );
}
