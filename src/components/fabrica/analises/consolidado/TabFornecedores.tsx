import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { ArrowUpDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { ProdutoConsolidado } from "@/hooks/useCustosConsolidados";
import { agregarFornecedores } from "@/lib/fabrica/consolidado-utils";

type SortKey = "fornecedor" | "produtos" | "insumos" | "total" | "ticket" | "delta";

export function TabFornecedores({ produtos }: { produtos: ProdutoConsolidado[] }) {
  const linhas = useMemo(() => agregarFornecedores(produtos), [produtos]);
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const arr = [...linhas];
    arr.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "fornecedor":
          return dir * a.fornecedor.localeCompare(b.fornecedor);
        case "produtos":
          return dir * (a.nProdutos - b.nProdutos);
        case "insumos":
          return dir * (a.nInsumos - b.nInsumos);
        case "total":
          return dir * (a.totalMovimentado - b.totalMovimentado);
        case "ticket":
          return dir * (a.ticketMedio - b.ticketMedio);
        case "delta": {
          if (a.deltaPctMedio == null && b.deltaPctMedio == null) return 0;
          if (a.deltaPctMedio == null) return 1;
          if (b.deltaPctMedio == null) return -1;
          return dir * (a.deltaPctMedio - b.deltaPctMedio);
        }
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
              setSortDir(key === "fornecedor" ? "asc" : "desc");
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
          <thead className="bg-muted sticky top-0 z-20 shadow-sm">
            <tr className="text-left">
              {H("fornecedor", "Fornecedor")}
              {H("produtos", "# Produtos", "right")}
              {H("insumos", "# Insumos", "right")}
              {H("total", "Total Movimentado", "right")}
              {H("ticket", "Ticket Médio", "right")}
              {H("delta", "Δ % Médio", "right")}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Sem dados.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.fornecedor} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2" title={r.fornecedor}>{r.fornecedor}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.nProdutos}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.nInsumos}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{formatCurrency(r.totalMovimentado)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.ticketMedio)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${r.deltaPctMedio == null ? "text-muted-foreground" : r.deltaPctMedio > 0 ? "text-destructive" : r.deltaPctMedio < 0 ? "text-emerald-700" : ""}`}>
                  {r.deltaPctMedio == null ? "—" : `${(r.deltaPctMedio * 100).toFixed(2)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
