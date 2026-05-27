import { useEffect, useState } from "react";
import { CalendarClock, Loader2, RotateCcw, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useConfirm } from "@/hooks/useConfirm";
import {
  EMPTY_SLA, STAGE_LABELS, totalSlaDias, type SlaConfig,
} from "@/lib/china/timelineSlaCompute";
import {
  useChinaTimelineSla,
  useUpsertChinaTimelineSla,
  useDeleteChinaTimelineSlaOverride,
} from "@/hooks/useChinaTimelineSla";

type Unit = "dias" | "meses";

interface Row {
  stage: number;
  qty: number;
  unit: Unit;
}

function fromDias(dias: number): Row {
  if (dias > 0 && dias % 30 === 0) {
    return { stage: 0, qty: dias / 30, unit: "meses" };
  }
  return { stage: 0, qty: dias, unit: "dias" };
}
function toDias(qty: number, unit: Unit): number {
  const v = Math.max(0, Math.floor(qty || 0));
  return unit === "meses" ? v * 30 : v;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  submissaoId: string;
  baseDate: Date | null;
}

export function TimelineSlaConfigDialog({ open, onOpenChange, submissaoId, baseDate }: Props) {
  const confirm = useConfirm();
  const { data, isLoading } = useChinaTimelineSla(submissaoId);
  const upsert = useUpsertChinaTimelineSla();
  const delOverride = useDeleteChinaTimelineSlaOverride();

  const [perSubmissao, setPerSubmissao] = useState(false);
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: 10 }, (_, i) => ({ stage: i + 1, qty: 0, unit: "dias" })),
  );

  // Reidrata o formulário sempre que o dialog abre ou os dados mudam.
  useEffect(() => {
    if (!open || !data) return;
    setPerSubmissao(data.usingOverride);
    const src: SlaConfig =
      (data.usingOverride ? (data.override as unknown as SlaConfig) : null) ??
      (data.global as unknown as SlaConfig | null) ??
      EMPTY_SLA;
    setRows(
      Array.from({ length: 10 }, (_, i) => {
        const stage = i + 1;
        const dias = (src as any)[`stage_${stage}_dias`] as number;
        const r = fromDias(dias);
        return { stage, qty: r.qty, unit: r.unit };
      }),
    );
  }, [open, data]);

  const slaValues: SlaConfig = rows.reduce((acc, r) => {
    (acc as any)[`stage_${r.stage}_dias`] = toDias(r.qty, r.unit);
    return acc;
  }, { ...EMPTY_SLA } as SlaConfig);

  const totalDias = totalSlaDias(slaValues);
  const previsaoFinal =
    baseDate && totalDias > 0
      ? format(new Date(baseDate.getTime() + totalDias * 86_400_000), "dd MMM yyyy", { locale: ptBR })
      : "—";

  const updateRow = (stage: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.stage === stage ? { ...r, ...patch } : r)));

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        submissaoId: perSubmissao ? submissaoId : null,
        values: slaValues,
      });
      toast.success(
        perSubmissao
          ? "Prazos salvos para esta submissão."
          : "Prazos padrão atualizados para todas as submissões.",
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar os prazos.");
    }
  };

  const handleClearOverride = async () => {
    if (!data?.usingOverride) return;
    if (!(await confirm({ title: "Remover o prazo personalizado desta submissão e voltar a usar o padrão?", destructive: true }))) return;
    try {
      await delOverride.mutateAsync(submissaoId);
      toast.success("Override removido. Submissão voltou ao prazo padrão.");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao remover override.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Configurar prazos da linha do tempo
          </DialogTitle>
          <DialogDescription>
            Defina o prazo (em dias ou meses) para a conclusão de cada etapa. Os prazos
            são acumulativos a partir da criação da submissão. Use "0" para etapas sem prazo.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
              <div>
                <p className="text-xs font-semibold">Aplicar somente nesta submissão</p>
                <p className="text-[11px] text-muted-foreground">
                  Quando ativado, os prazos abaixo só valem para esta submissão e ignoram o padrão.
                </p>
              </div>
              <Switch checked={perSubmissao} onCheckedChange={setPerSubmissao} />
            </div>

            <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Etapa</th>
                    <th className="px-3 py-2 text-right w-[110px]">Quantidade</th>
                    <th className="px-3 py-2 text-left w-[110px]">Unidade</th>
                    <th className="px-3 py-2 text-right w-[80px]">≈ dias</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const dias = toDias(r.qty, r.unit);
                    return (
                      <tr key={r.stage} className="border-t border-border/40">
                        <td className="px-3 py-1.5 text-muted-foreground">{r.stage}</td>
                        <td className="px-3 py-1.5">{STAGE_LABELS[r.stage]}</td>
                        <td className="px-3 py-1.5">
                          <Input
                            type="number"
                            min={0}
                            max={r.unit === "meses" ? 120 : 3650}
                            value={r.qty}
                            onChange={(e) =>
                              updateRow(r.stage, { qty: Math.max(0, Number(e.target.value) || 0) })
                            }
                            className="h-7 text-right text-xs"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Select
                            value={r.unit}
                            onValueChange={(v) => updateRow(r.stage, { unit: v as Unit })}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dias">Dias</SelectItem>
                              <SelectItem value="meses">Meses</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                          {dias}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-muted/20 text-xs">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-right font-semibold">
                      Lead time total (nascimento ao recebimento):
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {totalDias} d
                    </td>
                  </tr>
                  {baseDate && totalDias > 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-right text-muted-foreground">
                        Previsão de conclusão final (baseada em {format(baseDate, "dd MMM yyyy", { locale: ptBR })}):
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {previsaoFinal}
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>

            <DialogFooter className="flex flex-wrap items-center gap-2 sm:justify-between">
              <div className="flex items-center gap-2">
                {data?.usingOverride && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearOverride}
                    className="text-amber-300 hover:text-amber-200"
                    disabled={delOverride.isPending}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Voltar ao padrão
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={upsert.isPending}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={upsert.isPending}>
                  {upsert.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1.5" />
                  )}
                  Salvar prazos
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
