import { AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import {
  useOrcamentoConsumo,
  type OrcamentoConsumoEstagio,
  type OrcamentoConsumoRow,
} from "@/hooks/orcamento/useOrcamentoCorporativo";

function estagioMeta(estagio: OrcamentoConsumoEstagio) {
  switch (estagio) {
    case "estourado_100":
      return { label: "Estourado", cls: "bg-destructive", badge: "destructive" as const };
    case "critico_95":
      return { label: "Crítico (≥95%)", cls: "bg-orange-500", badge: "destructive" as const };
    case "alerta_80":
      return { label: "Alerta (≥80%)", cls: "bg-amber-500", badge: "secondary" as const };
    default:
      return { label: "OK", cls: "bg-emerald-500", badge: "outline" as const };
  }
}

export function OrcamentoConsumoTab({ periodId }: { periodId: string }) {
  const { data, isLoading, error } = useOrcamentoConsumo(periodId);

  const rows = data ?? [];
  const distribuidos = rows.filter((r) => r.distribution_id !== null);
  const sintetica = rows.find((r) => r.distribution_id === null);

  const totais = distribuidos.reduce(
    (acc, r) => ({
      alocado: acc.alocado + r.valor_alocado,
      comprometido: acc.comprometido + r.valor_comprometido,
      utilizado: acc.utilizado + r.valor_utilizado,
      pago: acc.pago + r.valor_pago,
      em_fila: acc.em_fila + r.em_fila,
      saldo: acc.saldo + r.saldo_livre,
    }),
    { alocado: 0, comprometido: 0, utilizado: 0, pago: 0, em_fila: 0, saldo: 0 },
  );

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-semibold">Consumo por departamento</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fonte: Contas a Pagar (comprometido = provisionado, realizado = lançado). Excluídos cancelados.
          </p>
        </div>
        <Badge variant="secondary" className="font-normal">
          {distribuidos.length} {distribuidos.length === 1 ? "departamento" : "departamentos"}
        </Badge>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="py-12 flex items-center justify-center text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculando saldos…
          </div>
        ) : error ? (
          <div className="py-12 flex items-center justify-center text-sm text-destructive gap-2">
            <AlertCircle className="h-4 w-4" /> Falha ao carregar consumo.
          </div>
        ) : !rows.length ? (
          <div className="py-12 flex items-center justify-center text-sm text-muted-foreground gap-2">
            <AlertCircle className="h-4 w-4" /> Nenhuma distribuição no período (ou sem permissão).
          </div>
        ) : (
          <div className="rounded-md border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Departamento</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-medium text-right">Alocado</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-medium text-right">Comprometido</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-medium text-right">Realizado</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-medium text-right">Pago</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-medium text-right">Em fila</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-medium text-right">Saldo</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-medium w-[220px]">Consumo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distribuidos.map((r) => (
                  <ConsumoRow key={r.distribution_id ?? r.department_id ?? "row"} r={r} />
                ))}
                {sintetica && (
                  <TableRow className="bg-amber-500/5 border-t-2 border-amber-500/40">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                        <span>{sintetica.department_nome ?? "(sem departamento)"}</span>
                        <Badge variant="outline" className="text-[10px] font-normal">
                          fora do radar
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(sintetica.valor_comprometido)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(sintetica.valor_utilizado)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(sintetica.valor_pago)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(sintetica.em_fila)}</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      {formatCurrency(sintetica.saldo_livre)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">Sem verba alocada</TableCell>
                  </TableRow>
                )}
                {distribuidos.length > 0 && (
                  <TableRow className="bg-muted/40 font-medium border-t-2 border-border">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(totais.alocado)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(totais.comprometido)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(totais.utilizado)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(totais.pago)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(totais.em_fila)}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        totais.saldo < 0 ? "text-destructive" : "text-emerald-600",
                      )}
                    >
                      {formatCurrency(totais.saldo)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConsumoRow({ r }: { r: OrcamentoConsumoRow }) {
  const meta = estagioMeta(r.estagio);
  const pct = r.pct_consumido ?? 0;
  const pctCap = Math.min(100, Math.max(0, pct));
  return (
    <TableRow>
      <TableCell className="font-medium">{r.department_nome ?? "—"}</TableCell>
      <TableCell className="text-right tabular-nums">{formatCurrency(r.valor_alocado)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatCurrency(r.valor_comprometido)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatCurrency(r.valor_utilizado)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatCurrency(r.valor_pago)}</TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(r.em_fila)}</TableCell>
      <TableCell
        className={cn(
          "text-right tabular-nums font-medium",
          r.saldo_livre < 0 ? "text-destructive" : "text-emerald-600",
        )}
      >
        {formatCurrency(r.saldo_livre)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="relative h-2 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("absolute inset-y-0 left-0 transition-all", meta.cls)}
              style={{ width: `${pctCap}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground w-12 text-right">
            {r.pct_consumido == null ? "—" : `${pct.toFixed(0)}%`}
          </span>
          <Badge variant={meta.badge} className="text-[10px] font-normal whitespace-nowrap">
            {meta.label}
          </Badge>
        </div>
      </TableCell>
    </TableRow>
  );
}
