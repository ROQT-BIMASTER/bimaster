import { useMemo, useState } from "react";
import { Loader2, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/formatters";
import {
  useDecidirSuplementacao,
  useSuplementacoes,
  type SuplementacaoRow,
  type SuplementacaoStatus,
} from "@/hooks/orcamento/useSuplementacoes";

function statusMeta(s: SuplementacaoStatus) {
  switch (s) {
    case "aprovada":
      return { label: "Aprovada", variant: "default" as const, icon: CheckCircle2 };
    case "rejeitada":
      return { label: "Rejeitada", variant: "destructive" as const, icon: XCircle };
    default:
      return { label: "Pendente", variant: "secondary" as const, icon: Clock };
  }
}

export function SuplementacoesPanel({ periodId }: { periodId: string }) {
  const { data, isLoading } = useSuplementacoes(periodId);
  const [expanded, setExpanded] = useState(true);
  const [rejeitar, setRejeitar] = useState<SuplementacaoRow | null>(null);

  const rows = data ?? [];
  const pendentes = useMemo(() => rows.filter((r) => r.status === "pendente"), [rows]);
  const historico = useMemo(() => rows.filter((r) => r.status !== "pendente").slice(0, 20), [rows]);

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold">Suplementações</CardTitle>
          {pendentes.length > 0 && (
            <Badge variant="secondary" className="font-normal">
              {pendentes.length} pendente{pendentes.length === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setExpanded((v) => !v)}>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {isLoading ? (
            <div className="py-6 flex items-center justify-center text-sm text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : (
            <>
              {pendentes.length > 0 && (
                <SuplementacaoTable
                  rows={pendentes}
                  periodId={periodId}
                  onRejeitar={setRejeitar}
                  showActions
                />
              )}
              {historico.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                    Histórico
                  </div>
                  <SuplementacaoTable rows={historico} periodId={periodId} />
                </div>
              )}
              {rows.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Nenhuma suplementação neste período.
                </div>
              )}
            </>
          )}
        </CardContent>
      )}

      <RejeitarDialog
        row={rejeitar}
        periodId={periodId}
        onClose={() => setRejeitar(null)}
      />
    </Card>
  );
}

function SuplementacaoTable({
  rows,
  periodId,
  onRejeitar,
  showActions,
}: {
  rows: SuplementacaoRow[];
  periodId: string;
  onRejeitar?: (r: SuplementacaoRow) => void;
  showActions?: boolean;
}) {
  const decidir = useDecidirSuplementacao(periodId);

  return (
    <div className="rounded-md border border-border/60 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Departamento
            </TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Solicitante
            </TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-medium text-right">
              Valor
            </TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Justificativa
            </TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Status
            </TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Decisão
            </TableHead>
            {showActions && (
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-medium w-[180px]">
                Ações
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const meta = statusMeta(r.status);
            const Icon = meta.icon;
            return (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.department_nome ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  <div>{r.solicitante_nome ?? "—"}</div>
                  <div className="opacity-70">
                    {format(new Date(r.solicitado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatCurrency(r.valor)}
                </TableCell>
                <TableCell className="max-w-[280px] text-xs">
                  <div className="truncate" title={r.justificativa}>
                    {r.justificativa}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={meta.variant} className="font-normal gap-1">
                    <Icon className="h-3 w-3" /> {meta.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.decidido_em ? (
                    <>
                      <div>{r.decisor_nome ?? "—"}</div>
                      <div className="opacity-70">
                        {format(new Date(r.decidido_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </div>
                      {r.motivo_decisao && (
                        <div className="mt-0.5 italic max-w-[200px] truncate" title={r.motivo_decisao}>
                          "{r.motivo_decisao}"
                        </div>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                {showActions && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 px-2 text-xs"
                        onClick={() =>
                          decidir.mutate({ id: r.id, aprovar: true })
                        }
                        disabled={decidir.isPending}
                      >
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => onRejeitar?.(r)}
                        disabled={decidir.isPending}
                      >
                        Rejeitar
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function RejeitarDialog({
  row,
  periodId,
  onClose,
}: {
  row: SuplementacaoRow | null;
  periodId: string;
  onClose: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const decidir = useDecidirSuplementacao(periodId);
  const open = row !== null;

  const handleConfirm = async () => {
    if (!row || motivo.trim().length < 3) return;
    await decidir.mutateAsync({ id: row.id, aprovar: false, motivo: motivo.trim() });
    setMotivo("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setMotivo("");
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rejeitar suplementação</DialogTitle>
          <DialogDescription>
            {row?.department_nome ?? "—"} — {row ? formatCurrency(row.valor) : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 py-2">
          <Label htmlFor="motivo-rej">Motivo (obrigatório)</Label>
          <Textarea
            id="motivo-rej"
            rows={4}
            placeholder="Explique o motivo da rejeição"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={decidir.isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={motivo.trim().length < 3 || decidir.isPending}
          >
            {decidir.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Rejeitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
