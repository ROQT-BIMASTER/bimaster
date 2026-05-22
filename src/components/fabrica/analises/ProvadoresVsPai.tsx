import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/formatters";
import { classificacaoProvador, type CenarioCustoAgg } from "./analises-utils";

interface Props {
  custosArr: CenarioCustoAgg[];
}

interface ProvadorRow {
  provador_id: string;
  provador_codigo: string;
  provador_nome: string;
  pai_codigo: string;
  pai_nome: string;
  custo_fabrica: number;
  custo_pai: number;
  pct_do_pai: number;
  oficial: boolean;
  tipo_sku: string | null;
}

export function ProvadoresVsPai({ custosArr }: Props) {
  const ids = useMemo(() => custosArr.map((c) => c.produto.id), [custosArr]);

  const { data: rowsAll = [], isLoading } = useQuery<ProvadorRow[]>({
    queryKey: ["fabrica-provadores-vw", ids.slice().sort().join(",")],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_fabrica_provadores_custo" as any)
        .select("provador_id, provador_codigo, provador_nome, pai_codigo, pai_nome, pai_id, custo_fabrica, custo_pai, pct_do_pai, oficial, tipo_sku")
        .or(`provador_id.in.(${ids.join(",")}),pai_id.in.(${ids.join(",")})`);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        provador_id: r.provador_id,
        provador_codigo: r.provador_codigo || "",
        provador_nome: r.provador_nome || "",
        pai_codigo: r.pai_codigo || "",
        pai_nome: r.pai_nome || "",
        custo_fabrica: Number(r.custo_fabrica || 0),
        custo_pai: Number(r.custo_pai || 0),
        pct_do_pai: Number(r.pct_do_pai || 0),
        oficial: !!r.oficial,
        tipo_sku: r.tipo_sku,
      })) as ProvadorRow[];
    },
  });

  const [somenteOficiais, setSomenteOficiais] = useState(false);
  const rows = useMemo(
    () => (somenteOficiais ? rowsAll.filter((r) => r.oficial) : rowsAll),
    [rowsAll, somenteOficiais],
  );

  const resumo = useMemo(() => {
    let eficientes = 0, medios = 0, caros = 0;
    let somaPct = 0;
    rows.forEach((r) => {
      const c = classificacaoProvador(r.pct_do_pai);
      if (c === "Eficiente") eficientes++;
      else if (c === "Médio") medios++;
      else caros++;
      somaPct += r.pct_do_pai;
    });
    return {
      total: rows.length,
      eficientes,
      medios,
      caros,
      mediaPct: rows.length > 0 ? somaPct / rows.length : 0,
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 grid-cols-2 md:grid-cols-5">
        <ResumoCard label="Total" value={resumo.total} />
        <ResumoCard label="Eficientes (<50%)" value={resumo.eficientes} tone="success" />
        <ResumoCard label="Médios (50-70%)" value={resumo.medios} tone="warning" />
        <ResumoCard label="Caros (≥70%)" value={resumo.caros} tone="destructive" />
        <ResumoCard label="% médio do pai" value={`${(resumo.mediaPct * 100).toFixed(1)}%`} />
      </div>

      <div className="flex items-center gap-2">
        <Switch id="oficiais-only" checked={somenteOficiais} onCheckedChange={setSomenteOficiais} />
        <Label htmlFor="oficiais-only" className="text-xs cursor-pointer">Somente provadores oficiais</Label>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-auto max-h-[640px]">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Cód. Provador</th>
                <th className="px-3 py-2 font-medium">Provador</th>
                <th className="px-3 py-2 font-medium">Cód. Pai</th>
                <th className="px-3 py-2 font-medium">Produto Pai</th>
                <th className="px-3 py-2 font-medium text-right">Custo Provador</th>
                <th className="px-3 py-2 font-medium text-right">Custo Pai</th>
                <th className="px-3 py-2 font-medium text-right">% do Pai</th>
                <th className="px-3 py-2 font-medium">Classificação</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Carregando...</td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Nenhum provador encontrado para este grupo.</td></tr>
              )}
              {rows.map((r) => {
                const c = classificacaoProvador(r.pct_do_pai);
                const tone = c === "Eficiente"
                  ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                  : c === "Médio"
                  ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
                  : "bg-destructive/15 text-destructive border-destructive/30";
                return (
                  <tr key={r.provador_id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono">{r.provador_codigo}</td>
                    <td className="px-3 py-2">{r.provador_nome}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{r.pai_codigo}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.pai_nome}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.custo_fabrica)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.custo_pai)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{(r.pct_do_pai * 100).toFixed(2)}%</td>
                    <td className="px-3 py-2"><Badge variant="outline" className={tone}>{c}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ResumoCard({ label, value, tone }: { label: string; value: string | number; tone?: "success" | "destructive" | "warning" }) {
  const cls = tone === "success"
    ? "text-emerald-700"
    : tone === "destructive"
    ? "text-destructive"
    : tone === "warning"
    ? "text-amber-700"
    : "text-foreground";
  return (
    <Card className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${cls}`}>{value}</div>
    </Card>
  );
}
