import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useNavigate } from "react-router-dom";
import type { ProdutoConsolidado } from "@/hooks/useCustosConsolidados";
import { deltaPct, statusComparativo } from "@/lib/fabrica/consolidado-utils";

type SortKey = "codigo" | "nome" | "grupo" | "custo" | "delta" | "itens";

interface Props {
  produtos: ProdutoConsolidado[];
}

const STATUS_CLS: Record<string, string> = {
  Aumentou: "bg-destructive/15 text-destructive border-destructive/30",
  Reduziu: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  Igual: "bg-muted text-muted-foreground border-border",
  Novo: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30",
  "Só Oficial": "bg-amber-500/15 text-amber-700 border-amber-500/30",
};

export function TabProdutos({ produtos }: Props) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>("delta");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const arr = [...produtos];
    arr.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "codigo":
          return dir * (a.produto.codigo || "").localeCompare(b.produto.codigo || "");
        case "nome":
          return dir * (a.produto.nome || "").localeCompare(b.produto.nome || "");
        case "grupo":
          return dir * a.grupoNome.localeCompare(b.grupoNome);
        case "custo":
          return dir * (a.custoFinal - b.custoFinal);
        case "delta": {
          const da = deltaPct(a);
          const db = deltaPct(b);
          if (da == null && db == null) return 0;
          if (da == null) return 1;
          if (db == null) return -1;
          return dir * (Math.abs(da) - Math.abs(db));
        }
        case "itens":
          return dir * (a.itens.length - b.itens.length);
      }
    });
    return arr;
  }, [produtos, sortKey, sortDir]);

  function sortHeader(key: SortKey, label: string, align: "left" | "right" = "left") {
    return (
      <th className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : ""}`}>
        <button
          className="inline-flex items-center gap-1 hover:text-foreground"
          onClick={() => {
            if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
            else {
              setSortKey(key);
              setSortDir(key === "codigo" || key === "nome" || key === "grupo" ? "asc" : "desc");
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
              {sortHeader("codigo", "Código")}
              {sortHeader("nome", "Descrição")}
              {sortHeader("grupo", "Grupo")}
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Marca</th>
              {sortHeader("custo", "Custo Final", "right")}
              {sortHeader("delta", "Δ vs Sim01", "right")}
              <th className="px-3 py-2 font-medium">Status</th>
              {sortHeader("itens", "# Itens", "right")}
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Nenhum produto.</td></tr>
            )}
            {rows.map((p) => {
              const dp = deltaPct(p);
              const status = statusComparativo(p);
              return (
                <tr key={p.produto.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono whitespace-nowrap" title={p.produto.codigo}>{p.produto.codigo || "—"}</td>
                  <td className="px-3 py-2" title={p.produto.nome}>{p.produto.nome || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground" title={p.grupoNome}>{p.grupoNome}</td>
                  <td className="px-3 py-2 text-muted-foreground">{(p.produto.tipo || "OFICIAL").toUpperCase()}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.produto.marca || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{formatCurrency(p.custoFinal)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${dp == null ? "text-muted-foreground" : dp > 0 ? "text-destructive" : dp < 0 ? "text-emerald-700" : ""}`}>
                    {dp == null ? "—" : `${(dp * 100).toFixed(2)}%`}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={STATUS_CLS[status]}>{status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{p.itens.length}</td>
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Abrir ficha de custo"
                      onClick={() => navigate(`/dashboard/fabrica/produtos/${p.produto.id}/custos`)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
