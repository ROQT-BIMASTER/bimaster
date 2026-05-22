import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, ArrowUpDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { ProdutoConsolidado } from "@/hooks/useCustosConsolidados";
import { agregarInsumosFornecedores } from "@/lib/fabrica/consolidado-utils";

type SortKey = "insumo" | "fornecedor" | "tipo" | "n" | "medio" | "min" | "max" | "var" | "total";

export function TabInsumosFornecedores({ produtos }: { produtos: ProdutoConsolidado[] }) {
  const linhas = useMemo(() => agregarInsumosFornecedores(produtos), [produtos]);
  const [sortKey, setSortKey] = useState<SortKey>("var");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const arr = [...linhas];
    arr.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "insumo":
          return dir * (a.insumoNome || a.insumoCodigo).localeCompare(b.insumoNome || b.insumoCodigo);
        case "fornecedor":
          return dir * a.fornecedor.localeCompare(b.fornecedor);
        case "tipo":
          return dir * a.tipoInsumo.localeCompare(b.tipoInsumo);
        case "n":
          return dir * (a.nProdutos - b.nProdutos);
        case "medio":
          return dir * (a.custoMedio - b.custoMedio);
        case "min":
          return dir * (a.custoMin - b.custoMin);
        case "max":
          return dir * (a.custoMax - b.custoMax);
        case "var":
          return dir * (a.variacao - b.variacao);
        case "total":
          return dir * (a.totalAcumulado - b.totalAcumulado);
      }
    });
    return arr;
  }, [linhas, sortKey, sortDir]);

  function H(key: SortKey, label: string, align: "left" | "right" = "left") {
    return (
      <th className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : ""}`}>
        <button
          className="inline-flex items-center gap-1 hover:text-foreground"
          onClick={() => {
            if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
            else {
              setSortKey(key);
              setSortDir(["insumo", "fornecedor", "tipo"].includes(key) ? "asc" : "desc");
            }
          }}
        >
          {label}
          <ArrowUpDown className="h-3 w-3 opacity-60" />
        </button>
      </th>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-auto max-h-[680px]">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium whitespace-nowrap">Cód. Insumo</th>
              {H("insumo", "Descrição")}
              {H("fornecedor", "Fornecedor")}
              {H("tipo", "Tipo")}
              {H("n", "# Produtos", "right")}
              {H("medio", "Custo Médio", "right")}
              {H("min", "Mínimo", "right")}
              {H("max", "Máximo", "right")}
              {H("var", "Variação", "right")}
              {H("total", "Total Acumulado", "right")}
              <th className="px-3 py-2 font-medium">Última NF</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">Sem dados.</td></tr>
            )}
            {rows.map((r) => {
              const alta = r.variacao >= 0.15;
              return (
                <tr key={r.chave} className={`border-t hover:bg-muted/30 ${alta ? "bg-destructive/5" : ""}`}>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{r.insumoCodigo || "—"}</td>
                  <td className="px-3 py-2" title={r.insumoNome}>{r.insumoNome || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground" title={r.fornecedor}>{r.fornecedor}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.tipoInsumo}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.nProdutos}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.custoMedio)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.custoMin)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.custoMax)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.variacao > 0 ? (
                      <Badge variant="outline" className={alta ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-amber-500/10 text-amber-700 border-amber-500/30"}>
                        +{(r.variacao * 100).toFixed(1)}%
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.totalAcumulado)}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{r.ultimaNF || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
