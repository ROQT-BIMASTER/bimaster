import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/formatters";
import type { CenarioCustoAgg } from "./analises-utils";

interface Props {
  custosArr: CenarioCustoAgg[];
}

interface LinhaConsolidada {
  codigo: string;
  nome: string;
  cenarioLabel: string | null;
  tipo: string;
  totalInsumos: number;
  ipi: number;
  totalNF: number;
  servico: number;
  condicao: number;
  nfMadeIn: number;
  custoFinal: number;
  ref?: CenarioCustoAgg;
}

function aggregate(c: CenarioCustoAgg): LinhaConsolidada {
  return {
    codigo: c.produto.codigo,
    nome: c.produto.nome,
    cenarioLabel: c.produto.cenario_label || null,
    tipo: (c.produto.tipo || "OFICIAL").toUpperCase(),
    totalInsumos: c.totalInsumos,
    ipi: c.ipiTotal,
    totalNF: c.totalNF,
    servico: c.totalServico,
    condicao: c.totalCondicao,
    nfMadeIn: c.totalNFMadeIn,
    custoFinal: c.custoFinal,
    ref: c,
  };
}

export function ConsolidadoComposicao({ custosArr }: Props) {
  const [comparar, setComparar] = useState(false);

  const ordenados = useMemo(
    () => [...custosArr].sort((a, b) => (a.produto.created_at || "").localeCompare(b.produto.created_at || "")),
    [custosArr],
  );
  const sim01 = ordenados[0];
  const sim02 = ordenados[ordenados.length - 1];

  const linhasSim02 = useMemo(() => custosArr.map(aggregate), [custosArr]);

  const max = useMemo(() => Math.max(0, ...linhasSim02.map((l) => l.custoFinal)), [linhasSim02]);
  const totais = useMemo(() => {
    return linhasSim02.reduce(
      (acc, l) => ({
        totalInsumos: acc.totalInsumos + l.totalInsumos,
        ipi: acc.ipi + l.ipi,
        totalNF: acc.totalNF + l.totalNF,
        servico: acc.servico + l.servico,
        condicao: acc.condicao + l.condicao,
        nfMadeIn: acc.nfMadeIn + l.nfMadeIn,
        custoFinal: acc.custoFinal + l.custoFinal,
      }),
      { totalInsumos: 0, ipi: 0, totalNF: 0, servico: 0, condicao: 0, nfMadeIn: 0, custoFinal: 0 },
    );
  }, [linhasSim02]);

  function biggest(l: LinhaConsolidada): keyof LinhaConsolidada | null {
    const partes: Array<[keyof LinhaConsolidada, number]> = [
      ["totalInsumos", l.totalInsumos],
      ["ipi", l.ipi],
      ["servico", l.servico],
      ["condicao", l.condicao],
      ["nfMadeIn", l.nfMadeIn],
    ];
    partes.sort((a, b) => b[1] - a[1]);
    return partes[0]?.[1] > 0 ? partes[0][0] : null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-muted-foreground">
          Decomposição do custo final por produto. Cenário atual (Sim02): <strong>{sim02?.produto.cenario_label || sim02?.produto.nome}</strong>.
        </div>
        {sim01 && sim02 && sim01 !== sim02 && (
          <div className="flex items-center gap-2">
            <Switch id="comparar-comp" checked={comparar} onCheckedChange={setComparar} />
            <Label htmlFor="comparar-comp" className="text-xs cursor-pointer">Comparar com Sim01</Label>
          </div>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-auto max-h-[640px]">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium whitespace-nowrap">Código</th>
                <th className="px-3 py-2 font-medium">Descrição</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium text-right">Total Insumos</th>
                <th className="px-3 py-2 font-medium text-right">IPI (R$)</th>
                <th className="px-3 py-2 font-medium text-right">Total NF</th>
                <th className="px-3 py-2 font-medium text-right">Serviço</th>
                <th className="px-3 py-2 font-medium text-right">Condição</th>
                <th className="px-3 py-2 font-medium text-right" title="Custo adicional na NF de produtos importados (origem estrangeira).">Importação</th>
                <th className="px-3 py-2 font-medium text-right">Custo Final</th>
                <th className="px-3 py-2 font-medium" style={{ minWidth: 120 }}>Peso</th>
              </tr>
            </thead>
            <tbody>
              {linhasSim02.map((l, i) => {
                const big = biggest(l);
                const pct = max > 0 ? (l.custoFinal / max) * 100 : 0;
                const cell = (val: number, key: keyof LinhaConsolidada) =>
                  `px-3 py-2 text-right tabular-nums ${big === key ? "bg-destructive/10 font-semibold" : ""}`;
                return (
                  <tr key={i} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono whitespace-nowrap" title={l.codigo}>{l.codigo || "—"}</td>
                    <td className="px-3 py-2" title={l.nome}>
                      <div>{l.nome || "—"}</div>
                      {l.cenarioLabel && l.cenarioLabel !== l.nome && (
                        <div className="text-[10px] text-muted-foreground">{l.cenarioLabel}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{l.tipo}</td>
                    <td className={cell(l.totalInsumos, "totalInsumos")}>{formatCurrency(l.totalInsumos)}</td>
                    <td className={cell(l.ipi, "ipi")}>{formatCurrency(l.ipi)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(l.totalNF)}</td>
                    <td className={cell(l.servico, "servico")}>{formatCurrency(l.servico)}</td>
                    <td className={cell(l.condicao, "condicao")}>{formatCurrency(l.condicao)}</td>
                    <td className={cell(l.nfMadeIn, "nfMadeIn")}>{formatCurrency(l.nfMadeIn)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(l.custoFinal)}</td>
                    <td className="px-3 py-2">
                      <div className="h-1.5 w-full bg-muted rounded overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {linhasSim02.length === 0 && (
                <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">Sem dados de custo.</td></tr>
              )}
            </tbody>
            {linhasSim02.length > 0 && (
              <tfoot className="bg-muted/60 sticky bottom-0 font-medium">
                <tr>
                  <td className="px-3 py-2" colSpan={3}>Totais</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totais.totalInsumos)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totais.ipi)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totais.totalNF)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totais.servico)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totais.condicao)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totais.nfMadeIn)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totais.custoFinal)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {comparar && sim01 && sim02 && sim01 !== sim02 && (
        <Card className="p-3">
          <div className="text-xs font-medium mb-2">Comparativo Sim01 vs Sim02 (totais)</div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
            {([
              ["Insumos", sim01.totalInsumos, sim02.totalInsumos],
              ["IPI", sim01.ipiTotal, sim02.ipiTotal],
              ["NF", sim01.totalNF, sim02.totalNF],
              ["Serviço", sim01.totalServico, sim02.totalServico],
              ["Condição", sim01.totalCondicao, sim02.totalCondicao],
              ["Made In", sim01.totalNFMadeIn, sim02.totalNFMadeIn],
              ["Custo Final", sim01.custoFinal, sim02.custoFinal],
            ] as [string, number, number][]).map(([label, a, b]) => {
              const d = b - a;
              return (
                <div key={label} className="rounded-md border p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
                  <div className="tabular-nums">{formatCurrency(a)} → {formatCurrency(b)}</div>
                  <div className={`tabular-nums ${d > 0 ? "text-destructive" : d < 0 ? "text-emerald-700" : "text-muted-foreground"}`}>
                    Δ {formatCurrency(d)}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
