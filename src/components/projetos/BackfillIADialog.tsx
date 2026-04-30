import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEstimarHorasIA, EstimativaIA } from "@/hooks/useEstimarHorasIA";
import { useProjetoHoras } from "@/hooks/useProjetoHoras";
import { Sparkles, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projetoId: string;
}

export function BackfillIADialog({ open, onOpenChange, projetoId }: Props) {
  const estimar = useEstimarHorasIA(projetoId);
  const { registrar } = useProjetoHoras(projetoId);
  const [estimativas, setEstimativas] = useState<(EstimativaIA & { _hours: string; _selected: boolean })[]>([]);
  const [saving, setSaving] = useState(false);

  const rodarIA = () => {
    estimar.mutate(undefined, {
      onSuccess: (data) => {
        setEstimativas(
          (data || []).map((e) => ({ ...e, _hours: String(e.horas), _selected: true }))
        );
        if (!data?.length) toast.info("Nenhuma tarefa concluída sem horas registradas.");
      },
    });
  };

  const totalSelecionado = estimativas
    .filter((e) => e._selected)
    .reduce((s, e) => s + (parseFloat(e._hours.replace(",", ".")) || 0), 0);

  const aprovar = async () => {
    const sel = estimativas.filter((e) => e._selected);
    if (!sel.length) return;
    setSaving(true);
    let ok = 0;
    for (const e of sel) {
      const h = parseFloat(e._hours.replace(",", "."));
      if (!h || h <= 0) continue;
      try {
        await registrar.mutateAsync({
          horas: h,
          descricao: `[IA backfill] ${e.justificativa}`.slice(0, 240),
          tarefa_id: e.tarefa_id,
          data: e.tarefa.data_conclusao || e.tarefa.data_inicio || new Date().toISOString().slice(0, 10),
        });
        ok++;
      } catch (err) {
        console.error(err);
      }
    }
    setSaving(false);
    toast.success(`${ok} lançamento(s) aprovados`);
    setEstimativas([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Backfill histórico por IA
          </DialogTitle>
          <DialogDescription>
            A IA analisa as tarefas concluídas sem registro de horas e propõe estimativas. Revise,
            ajuste e aprove apenas as que fizerem sentido.
          </DialogDescription>
        </DialogHeader>

        {estimativas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Button onClick={rodarIA} disabled={estimar.isPending} size="lg">
              {estimar.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analisando tarefas...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Rodar análise da IA</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center max-w-sm">
              Será feita uma análise das tarefas concluídas que ainda não têm horas registradas.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <div>
                <Badge variant="outline">{estimativas.filter((e) => e._selected).length} selecionadas</Badge>
                <span className="ml-2 text-muted-foreground">Total: <strong>{totalSelecionado.toFixed(1)}h</strong></span>
              </div>
              <Button variant="ghost" size="sm" onClick={rodarIA} disabled={estimar.isPending}>
                Recalcular
              </Button>
            </div>
            <ScrollArea className="max-h-[420px] -mx-6 px-6">
              <div className="space-y-2">
                {estimativas.map((e, i) => (
                  <div key={e.tarefa_id} className="border rounded-md p-3 flex gap-3 items-start">
                    <Checkbox
                      checked={e._selected}
                      onCheckedChange={(v) => {
                        const next = [...estimativas];
                        next[i] = { ...e, _selected: !!v };
                        setEstimativas(next);
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{e.tarefa.titulo}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{e.justificativa}</div>
                      {e.tarefa.responsavel_nome && (
                        <Badge variant="outline" className="text-[10px] mt-1.5">{e.tarefa.responsavel_nome}</Badge>
                      )}
                    </div>
                    <div className="w-24">
                      <Input
                        type="number" step="0.25" min="0"
                        value={e._hours}
                        onChange={(ev) => {
                          const next = [...estimativas];
                          next[i] = { ...e, _hours: ev.target.value };
                          setEstimativas(next);
                        }}
                        className="h-8 text-right"
                      />
                      <div className="text-[10px] text-muted-foreground text-right mt-0.5">horas</div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="ghost" onClick={() => setEstimativas([])} disabled={saving}>Cancelar</Button>
              <Button onClick={aprovar} disabled={saving || !estimativas.some((e) => e._selected)}>
                {saving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                ) : (
                  <><Check className="h-4 w-4 mr-2" /> Aprovar e lançar</>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
