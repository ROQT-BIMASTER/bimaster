import { useMemo } from "react";
import { addMinutes, format, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Mail, BellOff } from "lucide-react";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { CATEGORIA_LABELS } from "./CalendarFiltersBar";
import type { CalendarEvent } from "./types";
import type { CalendarioLembretesPrefs, LembretePorTipo } from "@/hooks/useCalendarioPreferencias";

const TIPO_PADRAO: LembretePorTipo = {
  ativo: true,
  antecedenciaMinutos: 60,
  email: true,
  notificacao: true,
};

const FREQ_LABEL: Record<string, string> = {
  instant: "no horário do lembrete",
  daily: "agrupado no resumo diário",
  weekly: "agrupado no resumo semanal",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Preferências em edição (ainda não salvas) — a prévia usa exatamente estas regras. */
  prefs: CalendarioLembretesPrefs;
  /** Eventos já filtrados pelas regras de visibilidade. */
  eventos: CalendarEvent[];
}

/**
 * Prévia (dry-run) dos lembretes: mostra como cada regra seria disparada
 * para os próximos compromissos, sem enviar nada.
 */
export function CalendarioLembretesPreviewDialog({ open, onOpenChange, prefs, eventos }: Props) {
  const linhas = useMemo(() => {
    const agora = new Date();
    const regra = (cat?: string | null) => prefs.porTipo[cat ?? "geral"] ?? TIPO_PADRAO;

    return eventos
      .map((ev) => {
        const dia = parseLocalDate(ev.data_inicio ?? ev.data_prazo ?? "");
        if (!dia) return null;
        const [h, m] = (ev.hora_inicio ?? "09:00").split(":").map(Number);
        const inicio = new Date(dia);
        inicio.setHours(h || 0, m || 0, 0, 0);
        if (!isAfter(inicio, agora)) return null;

        const r = regra(ev.categoria);
        const disparo = addMinutes(inicio, -r.antecedenciaMinutos);
        const email = prefs.ativo && r.ativo && prefs.email && r.email;
        const notificacao = prefs.ativo && r.ativo && prefs.notificacao && r.notificacao;

        return { ev, inicio, disparo, regra: r, email, notificacao };
      })
      .filter(Boolean)
      .sort((a, b) => a!.disparo.getTime() - b!.disparo.getTime())
      .slice(0, 25) as Array<{
        ev: CalendarEvent; inicio: Date; disparo: Date; regra: LembretePorTipo;
        email: boolean; notificacao: boolean;
      }>;
  }, [eventos, prefs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Prévia dos lembretes
          </DialogTitle>
          <DialogDescription>
            Simulação com as regras atuais — {FREQ_LABEL[prefs.frequencia] ?? prefs.frequencia}.
            Nenhum aviso é enviado nesta prévia.
          </DialogDescription>
        </DialogHeader>

        {!prefs.ativo && (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            A chave geral está desligada: nenhum lembrete seria disparado.
          </p>
        )}

        <ScrollArea className="max-h-[55vh] pr-3">
          {linhas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Não há compromissos futuros para simular com os filtros atuais.
            </p>
          ) : (
            <ul className="space-y-2">
              {linhas.map(({ ev, inicio, disparo, regra, email, notificacao }) => (
                <li key={`${ev.id}-${disparo.getTime()}`} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{ev.titulo}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {CATEGORIA_LABELS[ev.categoria ?? "geral"] ?? ev.categoria ?? "Tarefa"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Evento em {format(inicio, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} ·{" "}
                    aviso {regra.antecedenciaMinutos >= 1440
                      ? `${Math.round(regra.antecedenciaMinutos / 1440)} dia(s) antes`
                      : `${regra.antecedenciaMinutos} min antes`}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    <Badge variant="secondary" className="gap-1">
                      Disparo: {format(disparo, "dd/MM HH:mm", { locale: ptBR })}
                    </Badge>
                    <span className={`inline-flex items-center gap-1 ${email ? "text-foreground" : "text-muted-foreground line-through"}`}>
                      <Mail className="h-3 w-3" /> E-mail
                    </span>
                    <span className={`inline-flex items-center gap-1 ${notificacao ? "text-foreground" : "text-muted-foreground line-through"}`}>
                      {notificacao ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />} Notificação
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
