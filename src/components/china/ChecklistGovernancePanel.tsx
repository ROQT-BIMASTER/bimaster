import { useMemo, useState } from "react";
import { useChecklistGovernance, type ChecklistItemEstado } from "@/hooks/useChecklistGovernance";
import { useMergedChinaChecklist } from "@/hooks/useMergedChinaChecklist";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronDown, ChevronRight, CheckCircle2, Clock, AlertTriangle, ShieldAlert,
  Calendar as CalendarIcon, Rocket, FileWarning,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { cn } from "@/lib/utils";

interface Props {
  submissaoId: string;
}

const statusBadge: Record<ChecklistItemEstado["status"], { label: string; className: string }> = {
  pendente:     { label: "Pendente",     className: "bg-muted text-foreground" },
  em_andamento: { label: "Em andamento", className: "bg-warning/10 text-warning" },
  concluido:    { label: "Concluído",    className: "bg-success/10 text-success" },
  waiver:       { label: "Dispensado",   className: "bg-primary/10 text-primary" },
};

function slaInfo(prazo: string | null): { label: string; tone: "ok" | "warn" | "late" | "none" } {
  if (!prazo) return { label: "Sem prazo", tone: "none" };
  const today = new Date();
  const d = parseLocalDate(prazo);
  if (!d) return { label: "Sem prazo", tone: "none" };
  const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: `Atrasado ${Math.abs(diff)}d`, tone: "late" };
  if (diff <= 2) return { label: `Vence em ${diff}d`, tone: "warn" };
  return { label: format(d, "dd/MM/yyyy", { locale: ptBR }), tone: "ok" };
}

export function ChecklistGovernancePanel({ submissaoId }: Props) {
  const merged = useMergedChinaChecklist(submissaoId);
  const gov = useChecklistGovernance(submissaoId);
  const [collapsed, setCollapsed] = useState(false);
  const [waiverFor, setWaiverFor] = useState<{ id: string; label: string } | null>(null);
  const [waiverMotivo, setWaiverMotivo] = useState("");

  const sumPesos = useMemo(
    () => gov.estados.reduce((s, e) => s + Number(e.peso_percentual || 0), 0),
    [gov.estados],
  );

  const grouped = useMemo(() => {
    return merged.categories.map((cat) => {
      const catKey = cat.isCustom ? `custom_${cat.customId}` : cat.key;
      const items = cat.tipos
        .map((tipo) => {
          const dt = merged.getDocType(tipo);
          const estado = gov.byKey.get(`${cat.fluxo}|${catKey}|${tipo}`);
          return { tipo, label: dt?.labelPt || tipo, labelCn: dt?.labelCn || "", estado };
        })
        .filter((i) => !!i.estado);
      return { cat, catKey, items };
    });
  }, [merged.categories, merged.getDocType, gov.byKey]);

  const progresso = gov.progresso;
  const percent = progresso?.percent_concluido || 0;
  const podeLiberar = !!progresso?.pode_liberar;
  const liberado = !!progresso?.liberado_para_oc_em;

  const normalizar = () => {
    if (gov.estados.length === 0) return;
    const each = Math.floor((100 / gov.estados.length) * 100) / 100;
    gov.estados.forEach((e) =>
      gov.updateEstado.mutate({ id: e.id, peso_percentual: each }),
    );
  };

  return (
    <Card className="border bg-card/60 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {collapsed ? <ChevronRight className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
          <div className="text-sm font-semibold whitespace-nowrap">Conclusão da Ficha</div>
          <div className="flex-1 min-w-[120px] max-w-md">
            <Progress value={percent} className="h-2" />
          </div>
          <div className="text-sm font-bold tabular-nums">{percent.toFixed(0)}%</div>
          {progresso?.itens_atrasados ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {progresso.itens_atrasados} atrasados
            </Badge>
          ) : null}
          {liberado ? (
            <Badge className="bg-success/15 text-success gap-1">
              <CheckCircle2 className="h-3 w-3" /> Liberado para OC/OP
            </Badge>
          ) : podeLiberar ? (
            <Badge className="bg-success/10 text-success">Pronto para liberar</Badge>
          ) : (
            <Badge variant="secondary">
              {progresso?.itens_pendentes ?? 0} pendentes
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            disabled={!podeLiberar || liberado || gov.liberarParaOC.isPending}
            onClick={() => gov.liberarParaOC.mutate()}
            className="gap-1"
          >
            <Rocket className="h-3.5 w-3.5" />
            {liberado ? "Liberado" : "Liberar para OC/OP"}
          </Button>
        </div>
      </button>

      {!collapsed && (
        <div className="border-t px-4 py-3 space-y-3 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div>
              Soma dos pesos:{" "}
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  Math.round(sumPesos) === 100 ? "text-success" : "text-warning",
                )}
              >
                {sumPesos.toFixed(2)}%
              </span>{" "}
              {Math.round(sumPesos) !== 100 && (
                <span className="text-warning">— distribua até totalizar 100%</span>
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={normalizar}>
              Normalizar pesos
            </Button>
          </div>

          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Item</th>
                  <th className="text-center px-2 py-2 w-20">Peso (%)</th>
                  <th className="text-center px-2 py-2 w-32">Prazo</th>
                  <th className="text-center px-2 py-2 w-28">Status</th>
                  <th className="text-right px-3 py-2 w-44">Ações</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(({ cat, items }) =>
                  items.length === 0 ? null : (
                    <>
                      <tr key={`hdr-${cat.key}`} className="bg-muted/20">
                        <td colSpan={5} className="px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
                          {cat.fluxo === "china_envia" ? "China envia" : "Brasil envia"} — {cat.labelPt}
                        </td>
                      </tr>
                      {items.map(({ estado, label, tipo }) => {
                        if (!estado) return null;
                        const sla = slaInfo(estado.prazo_data);
                        const st = statusBadge[estado.status];
                        return (
                          <tr key={estado.id} className="border-t">
                            <td className="px-3 py-2">
                              <div className="font-medium">{label}</div>
                              <div className="text-[10px] text-muted-foreground font-mono">{tipo}</div>
                            </td>
                            <td className="px-2 py-1">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                value={estado.peso_percentual}
                                onChange={(e) =>
                                  gov.updateEstado.mutate({
                                    id: estado.id,
                                    peso_percentual: Number(e.target.value) || 0,
                                  })
                                }
                                className="h-7 text-xs text-center"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                      "h-7 w-full justify-start gap-1 text-xs font-normal",
                                      sla.tone === "late" && "border-destructive text-destructive",
                                      sla.tone === "warn" && "border-warning text-warning",
                                    )}
                                  >
                                    <CalendarIcon className="h-3 w-3" />
                                    {sla.label}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={
                                      estado.prazo_data
                                        ? parseLocalDate(estado.prazo_data) || undefined
                                        : undefined
                                    }
                                    onSelect={(d) =>
                                      gov.updateEstado.mutate({
                                        id: estado.id,
                                        prazo_data: d ? format(d, "yyyy-MM-dd") : null,
                                      })
                                    }
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            </td>
                            <td className="px-2 py-1 text-center">
                              <Badge className={cn("text-[10px]", st.className)}>{st.label}</Badge>
                            </td>
                            <td className="px-3 py-1 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {estado.status !== "concluido" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[11px] gap-1"
                                    onClick={() => gov.concluirItem.mutate(estado.id)}
                                  >
                                    <CheckCircle2 className="h-3 w-3" /> Concluir
                                  </Button>
                                )}
                                {estado.status !== "waiver" && estado.status !== "concluido" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-[11px] gap-1 text-primary"
                                    onClick={() => {
                                      setWaiverFor({ id: estado.id, label });
                                      setWaiverMotivo("");
                                    }}
                                  >
                                    <ShieldAlert className="h-3 w-3" /> Dispensar
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  ),
                )}
                {grouped.every((g) => g.items.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      Nenhum item de checklist configurado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={!!waiverFor} onOpenChange={(o) => !o && setWaiverFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-primary" />
              Dispensar item do checklist
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Item:</span>{" "}
              <span className="font-medium">{waiverFor?.label}</span>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">
                Justificativa <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={waiverMotivo}
                onChange={(e) => setWaiverMotivo(e.target.value)}
                placeholder="Explique por que este item será dispensado (mín. 5 caracteres)"
                rows={4}
              />
            </div>
            <div className="text-[11px] text-muted-foreground">
              A dispensa registra seu nome, data e motivo. Itens dispensados contam como
              concluídos para liberação de OC/OP, mas ficam visíveis no histórico.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWaiverFor(null)}>
              Cancelar
            </Button>
            <Button
              disabled={waiverMotivo.trim().length < 5 || gov.aplicarWaiver.isPending}
              onClick={() => {
                if (!waiverFor) return;
                gov.aplicarWaiver.mutate(
                  { estadoId: waiverFor.id, motivo: waiverMotivo.trim() },
                  { onSuccess: () => setWaiverFor(null) },
                );
              }}
            >
              Confirmar dispensa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
