import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Minus, Sparkles, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import {
  buildComparativoRows,
  calcResumoComparativo,
  type CenarioCustoAgg,
  type StatusComparativo,
} from "./analises-utils";

interface Props {
  custosArr: CenarioCustoAgg[];
}

const STATUS_BADGE: Record<StatusComparativo, { cls: string; icon: JSX.Element }> = {
  Aumentou: { cls: "bg-destructive/15 text-destructive border-destructive/30", icon: <TrendingUp className="h-3 w-3" /> },
  Reduziu: { cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", icon: <TrendingDown className="h-3 w-3" /> },
  Igual: { cls: "bg-muted text-muted-foreground border-border", icon: <Minus className="h-3 w-3" /> },
  Novo: { cls: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30", icon: <Sparkles className="h-3 w-3" /> },
  Removido: { cls: "bg-amber-500/15 text-amber-700 border-amber-500/30", icon: <AlertTriangle className="h-3 w-3" /> },
};

export function ComparativoSimulacoes({ custosArr }: Props) {
  const rowsAll = useMemo(() => buildComparativoRows(custosArr), [custosArr]);
  const resumo = useMemo(() => calcResumoComparativo(rowsAll), [rowsAll]);

  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");

  const rows = useMemo(() => {
    return rowsAll.filter((r) => {
      if (statusFiltro !== "todos" && r.status !== statusFiltro) return false;
      if (tipoFiltro !== "todos" && r.tipo !== tipoFiltro) return false;
      if (busca) {
        const q = busca.toLowerCase();
        if (!r.codigo.toLowerCase().includes(q) && !r.nome.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rowsAll, statusFiltro, tipoFiltro, busca]);

  const tipos = useMemo(() => Array.from(new Set(rowsAll.map((r) => r.tipo))), [rowsAll]);

  if (custosArr.length < 2) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        São necessários pelo menos 2 cenários no grupo para comparar.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cards de resumo */}
      <div className="grid gap-2 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        <ResumoCard label="Total SKUs" value={resumo.total} />
        <ResumoCard label="Aumentaram" value={resumo.aumentaram} tone="destructive" />
        <ResumoCard label="Reduziram" value={resumo.reduziram} tone="success" />
        <ResumoCard label="Iguais" value={resumo.iguais} />
        <ResumoCard label="Novos" value={resumo.novos} tone="info" />
        <ResumoCard label="Δ médio" value={`${(resumo.deltaMedioPct * 100).toFixed(2)}%`} tone={resumo.deltaMedioPct > 0 ? "destructive" : "success"} />
        <ResumoCard
          label="Maior alta"
          value={resumo.maiorAlta ? `${resumo.maiorAlta.codigo} +${(resumo.maiorAlta.deltaPct * 100).toFixed(1)}%` : "—"}
          tone="destructive"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar código ou nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-xs h-9"
        />
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="Aumentou">Aumentou</SelectItem>
            <SelectItem value="Reduziu">Reduziu</SelectItem>
            <SelectItem value="Igual">Igual</SelectItem>
            <SelectItem value="Novo">Novo</SelectItem>
            <SelectItem value="Removido">Removido</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos tipos</SelectItem>
            {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{rows.length} de {rowsAll.length}</span>
      </div>

      <Card className="overflow-hidden border-border/60">
        <div className="overflow-auto max-h-[640px]">
          <table className="w-full text-[11px]">
            <thead className="bg-muted/40 sticky top-0 z-10">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium uppercase tracking-wider text-[10px] text-muted-foreground whitespace-nowrap">Cenário</th>
                <th className="px-3 py-2 font-medium uppercase tracking-wider text-[10px] text-muted-foreground whitespace-nowrap">Código</th>
                <th className="px-3 py-2 font-medium uppercase tracking-wider text-[10px] text-muted-foreground">Descrição</th>
                <th className="px-3 py-2 font-medium uppercase tracking-wider text-[10px] text-muted-foreground">Tipo</th>
                <th className="px-3 py-2 font-medium uppercase tracking-wider text-[10px] text-muted-foreground text-right">Custo Sim01</th>
                <th className="px-3 py-2 font-medium uppercase tracking-wider text-[10px] text-muted-foreground text-right">Custo deste cenário</th>
                <th className="px-3 py-2 font-medium uppercase tracking-wider text-[10px] text-muted-foreground text-right">Δ R$</th>
                <th className="px-3 py-2 font-medium uppercase tracking-wider text-[10px] text-muted-foreground text-right">Δ %</th>
                <th className="px-3 py-2 font-medium uppercase tracking-wider text-[10px] text-muted-foreground">Status</th>
                <th className="px-3 py-2 font-medium uppercase tracking-wider text-[10px] text-muted-foreground">Observação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const altaForte = r.status === "Aumentou" && Math.abs(r.deltaPct) >= 0.1;
                const badge = STATUS_BADGE[r.status];
                return (
                  <tr key={i} className={`border-t border-border/50 hover:bg-foreground/[0.03] ${altaForte ? "bg-destructive/5" : ""}`}>
                    <td className="px-3 py-1.5 font-medium whitespace-nowrap">{r.cenarioLabel}</td>
                    <td className="px-3 py-1.5 font-mono tabular-nums whitespace-nowrap text-muted-foreground" title={r.codigo}>{r.codigo || "—"}</td>
                    <td className="px-3 py-1.5" title={r.nome}>{r.nome || "—"}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{r.tipo}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-mono">{r.custoSim01 != null ? formatCurrency(r.custoSim01) : "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-mono">{r.custoSim02 != null ? formatCurrency(r.custoSim02) : "—"}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums font-mono font-medium ${r.delta > 0 ? "text-destructive" : r.delta < 0 ? "text-emerald-700" : ""}`}>
                      {r.custoSim01 != null && r.custoSim02 != null ? formatCurrency(r.delta) : "—"}
                    </td>
                    <td className={`px-3 py-1.5 text-right tabular-nums font-mono font-medium ${r.delta > 0 ? "text-destructive" : r.delta < 0 ? "text-emerald-700" : ""}`}>
                      {r.custoSim01 != null && r.custoSim02 != null ? `${(r.deltaPct * 100).toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      <Badge variant="outline" className={`gap-1 text-[10px] ${badge.cls}`}>{badge.icon}{r.status}</Badge>
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{r.observacao}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Nenhum produto corresponde aos filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ResumoCard({ label, value, tone }: { label: string; value: string | number; tone?: "success" | "destructive" | "info" }) {
  const cls = tone === "success"
    ? "text-emerald-700"
    : tone === "destructive"
    ? "text-destructive"
    : tone === "info"
    ? "text-indigo-700"
    : "text-foreground";
  return (
    <Card className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${cls}`}>{value}</div>
    </Card>
  );
}
