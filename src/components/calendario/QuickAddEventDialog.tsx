import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CATEGORIA_LABELS } from "./CalendarFiltersBar";
import { useCalendarioEventosMutations } from "@/hooks/useCalendarioEventos";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Data clicada no mês/semana (Y-M-D). */
  data: string | null;
  /** Abre o formulário completo mantendo a data escolhida. */
  onMaisOpcoes: (data: string | null) => void;
}

const CATEGORIAS = Object.keys(CATEGORIA_LABELS);

/**
 * Criação rápida de evento avulso (ou série recorrente) direto da grade
 * do calendário. Mantém a visibilidade pessoal por padrão — participantes
 * e compartilhamento ficam no formulário completo.
 */
export function QuickAddEventDialog({ open, onOpenChange, data, onMaisOpcoes }: Props) {
  const { criar } = useCalendarioEventosMutations();

  const [titulo, setTitulo] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [diaInteiro, setDiaInteiro] = useState(true);
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFim, setHoraFim] = useState("10:00");
  const [categoria, setCategoria] = useState("geral");
  const [tags, setTags] = useState("");
  const [frequencia, setFrequencia] = useState<"nenhuma" | "semanal" | "mensal">("nenhuma");
  const [ate, setAte] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitulo("");
    setDataInicio(data ?? "");
    setDiaInteiro(true);
    setHoraInicio("09:00");
    setHoraFim("10:00");
    setCategoria("geral");
    setTags("");
    setFrequencia("nenhuma");
    setAte("");
  }, [open, data]);

  const salvar = async () => {
    if (!titulo.trim()) {
      toast.error("Informe o título do evento.");
      return;
    }
    if (!dataInicio) {
      toast.error("Informe a data do evento.");
      return;
    }
    if (!diaInteiro && horaFim <= horaInicio) {
      toast.error("O horário de término deve ser depois do início.");
      return;
    }
    if (frequencia !== "nenhuma") {
      if (!ate) {
        toast.error("Informe até quando a série se repete.");
        return;
      }
      if (ate < dataInicio) {
        toast.error("O fim da recorrência deve ser posterior à data inicial.");
        return;
      }
    }

    try {
      const total = await criar.mutateAsync({
        titulo,
        data_inicio: dataInicio,
        data_fim: dataInicio,
        dia_inteiro: diaInteiro,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        cor: "#6366f1",
        categoria,
        participantes: [],
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        recorrencia: frequencia === "nenhuma" ? undefined : { frequencia, intervalo: 1, ate },
      });
      toast.success(total > 1 ? `${total} ocorrências criadas.` : "Evento criado.");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível criar o evento.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criação rápida</DialogTitle>
          <DialogDescription>
            Evento pessoal, visível apenas para você até que participantes sejam adicionados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="quick-titulo">Título</Label>
            <Input
              id="quick-titulo"
              value={titulo}
              maxLength={160}
              autoFocus
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Reunião de alinhamento"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quick-data">Data</Label>
              <Input id="quick-data" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quick-cat">Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger id="quick-cat"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORIA_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label htmlFor="quick-dia" className="text-sm font-normal">Dia inteiro</Label>
            <Switch id="quick-dia" checked={diaInteiro} onCheckedChange={setDiaInteiro} />
          </div>

          {!diaInteiro && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="quick-hi">Início</Label>
                <Input id="quick-hi" type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quick-hf">Término</Label>
                <Input id="quick-hf" type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="quick-tags">Marcadores</Label>
            <Input
              id="quick-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Separe por vírgula. Ex.: diretoria, trimestral"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quick-freq">Repetir</Label>
              <Select value={frequencia} onValueChange={(v) => setFrequencia(v as typeof frequencia)}>
                <SelectTrigger id="quick-freq"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Não repete</SelectItem>
                  <SelectItem value="semanal">Semanalmente</SelectItem>
                  <SelectItem value="mensal">Mensalmente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {frequencia !== "nenhuma" && (
              <div className="space-y-1.5">
                <Label htmlFor="quick-ate">Até</Label>
                <Input id="quick-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => { onOpenChange(false); onMaisOpcoes(dataInicio || data); }}
          >
            Mais opções
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={criar.isPending}>
              {criar.isPending ? "Salvando..." : "Criar evento"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
