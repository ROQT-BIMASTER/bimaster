import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CATEGORIA_LABELS } from "./CalendarFiltersBar";
import { CalendarioLembretesPreviewDialog } from "./CalendarioLembretesPreviewDialog";
import type { CalendarEvent } from "./types";
import {
  useCalendarioPreferencias, useCalendarioPreferenciasMutations,
  DEFAULT_LEMBRETES, type CalendarioLembretesPrefs, type LembretePorTipo,
} from "@/hooks/useCalendarioPreferencias";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Eventos visíveis usados na prévia (dry-run) dos lembretes. */
  eventos?: CalendarEvent[];
}

const ANTECEDENCIAS = [
  { valor: 15, nome: "15 minutos antes" },
  { valor: 60, nome: "1 hora antes" },
  { valor: 1440, nome: "1 dia antes" },
  { valor: 2880, nome: "2 dias antes" },
];

const TIPO_PADRAO: LembretePorTipo = {
  ativo: true,
  antecedenciaMinutos: 60,
  email: true,
  notificacao: true,
};

/** Configurações de lembretes e notificações do Calendário Geral. */
export function CalendarioNotificacoesDialog({ open, onOpenChange, eventos = [] }: Props) {
  const { data: prefs } = useCalendarioPreferencias();
  const { salvar } = useCalendarioPreferenciasMutations();
  const [form, setForm] = useState<CalendarioLembretesPrefs>(DEFAULT_LEMBRETES);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (open && prefs?.lembretes) setForm(prefs.lembretes);
  }, [open, prefs?.lembretes]);

  const tipo = (cat: string): LembretePorTipo => form.porTipo[cat] ?? TIPO_PADRAO;

  const setTipo = (cat: string, patch: Partial<LembretePorTipo>) =>
    setForm((f) => ({
      ...f,
      porTipo: { ...f.porTipo, [cat]: { ...tipo(cat), ...patch } },
    }));

  const submeter = async () => {
    try {
      await salvar.mutateAsync({ lembretes: form });
      toast.success("Preferências de lembretes salvas.");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar as preferências.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lembretes e notificações</DialogTitle>
          <DialogDescription>
            Defina como você quer ser avisado sobre os compromissos do calendário.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <Label className="text-sm">Receber lembretes</Label>
                <p className="text-xs text-muted-foreground">Chave geral para todos os avisos do calendário.</p>
              </div>
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))} />
            </div>

            <div className={form.ativo ? "space-y-4" : "space-y-4 opacity-50 pointer-events-none"}>
              <div className="space-y-1.5">
                <Label>Frequência</Label>
                <Select
                  value={form.frequencia}
                  onValueChange={(v) => setForm((f) => ({ ...f, frequencia: v as CalendarioLembretesPrefs["frequencia"] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instant">No horário do lembrete</SelectItem>
                    <SelectItem value="daily">Resumo diário</SelectItem>
                    <SelectItem value="weekly">Resumo semanal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  E-mail
                  <Switch checked={form.email} onCheckedChange={(v) => setForm((f) => ({ ...f, email: v }))} />
                </label>
                <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  Notificação
                  <Switch checked={form.notificacao} onCheckedChange={(v) => setForm((f) => ({ ...f, notificacao: v }))} />
                </label>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Por tipo de evento
                </p>
                {Object.entries(CATEGORIA_LABELS).map(([cat, label]) => {
                  const t = tipo(cat);
                  return (
                    <div key={cat} className="rounded-md border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">{label}</Label>
                        <Switch checked={t.ativo} onCheckedChange={(v) => setTipo(cat, { ativo: v })} />
                      </div>
                      {t.ativo && (
                        <div className="grid gap-2 sm:grid-cols-3">
                          <Select
                            value={String(t.antecedenciaMinutos)}
                            onValueChange={(v) => setTipo(cat, { antecedenciaMinutos: Number(v) })}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ANTECEDENCIAS.map((a) => (
                                <SelectItem key={a.valor} value={String(a.valor)}>{a.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <label className="flex items-center justify-between rounded-md border border-border px-2 text-xs">
                            E-mail
                            <Switch checked={t.email} onCheckedChange={(v) => setTipo(cat, { email: v })} />
                          </label>
                          <label className="flex items-center justify-between rounded-md border border-border px-2 text-xs">
                            Notificação
                            <Switch checked={t.notificacao} onCheckedChange={(v) => setTipo(cat, { notificacao: v })} />
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={() => setPreviewOpen(true)}>
            Prévia / teste
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={submeter} disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando..." : "Salvar preferências"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <CalendarioLembretesPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        prefs={form}
        eventos={eventos}
      />
    </Dialog>
  );
}
