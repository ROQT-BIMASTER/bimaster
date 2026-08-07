import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Download, Link2, Copy, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { buildIcs, calendarEventsToIcs, downloadIcs } from "@/lib/calendario/ics";
import {
  useCalendarioIcsToken, useCalendarioIcsTokenMutations, montarUrlIcs,
} from "@/hooks/useCalendarioIcsToken";
import type { CalendarEvent } from "./types";
import type { EquipeProjeto } from "@/hooks/useEquipesProjetos";

interface Option { id: string; nome: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Eventos já filtrados na tela (usados na exportação do arquivo). */
  events: CalendarEvent[];
  equipes: EquipeProjeto[];
  responsaveis: Option[];
}

/**
 * Exportação (.ics) e assinatura (URL) do Calendário Geral, com filtros
 * por equipe e responsável aplicados ao feed.
 */
export function CalendarioExportDialog({ open, onOpenChange, events, equipes, responsaveis }: Props) {
  const { data: tokenAtual } = useCalendarioIcsToken();
  const { gerar, atualizarFiltros, revogar } = useCalendarioIcsTokenMutations();

  const [equipeIds, setEquipeIds] = useState<string[]>([]);
  const [responsavelIds, setResponsavelIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setEquipeIds(tokenAtual?.filtros.equipeIds ?? []);
    setResponsavelIds(tokenAtual?.filtros.responsavelIds ?? []);
  }, [open, tokenAtual]);

  const membrosSelecionados = useMemo(() => {
    const set = new Set<string>(responsavelIds);
    equipes
      .filter((e) => equipeIds.includes(e.id))
      .forEach((e) => e.membros.forEach((m) => set.add(m)));
    return set;
  }, [equipes, equipeIds, responsavelIds]);

  const eventosFiltrados = useMemo(() => {
    if (!membrosSelecionados.size) return events;
    return events.filter(
      (ev) => ev.tipo === "evento" || (ev.responsavel_id && membrosSelecionados.has(ev.responsavel_id)),
    );
  }, [events, membrosSelecionados]);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const exportar = () => {
    if (!eventosFiltrados.length) {
      toast.error("Nenhum compromisso para exportar com os filtros atuais.");
      return;
    }
    downloadIcs(buildIcs(calendarEventsToIcs(eventosFiltrados)), "calendario-geral.ics");
    toast.success(`${eventosFiltrados.length} compromisso(s) exportado(s).`);
  };

  const url = tokenAtual ? montarUrlIcs(tokenAtual.token) : null;

  const gerarLink = async () => {
    try {
      await gerar.mutateAsync({ equipeIds, responsavelIds });
      toast.success("Link de assinatura gerado.");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível gerar o link.");
    }
  };

  const salvarFiltros = async () => {
    try {
      await atualizarFiltros.mutateAsync({ equipeIds, responsavelIds });
      toast.success("Filtros da assinatura atualizados.");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível atualizar os filtros.");
    }
  };

  const copiar = async (valor: string) => {
    try {
      await navigator.clipboard.writeText(valor);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportar ou assinar o calendário</DialogTitle>
          <DialogDescription>
            Gere um arquivo iCalendar (.ics) ou um link de assinatura para acompanhar a agenda
            no Google Agenda, Outlook ou Apple Calendário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Filtros
          </p>
          <ScrollArea className="max-h-52 rounded-md border p-3">
            <div className="space-y-4">
              {equipes.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Equipes</p>
                  {equipes.map((e) => (
                    <label key={e.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={equipeIds.includes(e.id)}
                        onCheckedChange={() => toggle(equipeIds, setEquipeIds, e.id)}
                      />
                      <span className="truncate">{e.nome}</span>
                    </label>
                  ))}
                </div>
              )}
              {responsaveis.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Responsáveis</p>
                  {responsaveis.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={responsavelIds.includes(r.id)}
                        onCheckedChange={() => toggle(responsavelIds, setResponsavelIds, r.id)}
                      />
                      <span className="truncate">{r.nome}</span>
                    </label>
                  ))}
                </div>
              )}
              {!equipes.length && !responsaveis.length && (
                <p className="text-xs text-muted-foreground">Nenhum filtro disponível.</p>
              )}
            </div>
          </ScrollArea>

          <Button onClick={exportar} className="w-full gap-2">
            <Download className="h-4 w-4" />
            Baixar .ics ({eventosFiltrados.length})
          </Button>

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Assinatura contínua
            </p>
            {url ? (
              <>
                <div className="flex gap-2">
                  <Input readOnly value={url} className="text-xs" onFocus={(e) => e.currentTarget.select()} />
                  <Button variant="outline" size="icon" onClick={() => copiar(url)} aria-label="Copiar link">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Link pessoal e secreto: qualquer pessoa com ele vê a sua agenda. Revogue se compartilhar por engano.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={salvarFiltros} disabled={atualizarFiltros.isPending}>
                    Salvar filtros da assinatura
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={gerarLink} disabled={gerar.isPending}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Gerar novo link
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => revogar.mutateAsync().then(() => toast.success("Assinatura revogada."))}
                    disabled={revogar.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Revogar
                  </Button>
                </div>
              </>
            ) : (
              <Button variant="outline" className="w-full gap-2" onClick={gerarLink} disabled={gerar.isPending}>
                <Link2 className="h-4 w-4" />
                Gerar link de assinatura
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
