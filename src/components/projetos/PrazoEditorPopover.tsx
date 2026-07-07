import { useMemo, useState } from "react";
import { CalendarIcon, Calculator, Lock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useFeriados } from "@/hooks/useFeriados";
import {
  calcularPrazoComFeriados,
  contarDiasUteisEntre,
  feriadosToSet,
  parseDateLocal,
  toISODateLocal,
  RegimeCalendario,
} from "@/lib/prazoCalculator";

interface PrazoEditorPopoverProps {
  /** Rótulo no botão e título do popover. */
  label: string;
  /** Valor atual de início (ISO). */
  dataInicio: string | null;
  /** Valor atual do prazo (ISO). */
  dataPrazo: string | null;
  /** Dias de alerta antes do prazo. */
  diasAlertaAntes?: number;
  /** Regime de cálculo do projeto. */
  regime?: RegimeCalendario;
  /** Bloqueia datas após esse limite (ex.: prazo da seção/projeto/tarefa pai). */
  limiteSuperior?: string | null;
  /** Bloqueia datas antes desse limite (ex.: início do projeto). */
  limiteInferior?: string | null;
  /** Callback ao salvar. */
  onSave: (next: {
    data_inicio: string | null;
    data_prazo: string | null;
    dias_alerta_antes: number;
  }) => Promise<void> | void;
  /** Trigger custom; se omitido, renderiza um botão padrão. */
  children?: React.ReactNode;
  /** Quando `true`, o botão fica desabilitado e o popover não abre. Usado para
   *  tarefas cujo prazo é definido por um processo operacional. */
  locked?: boolean;
  /** Motivo exibido no tooltip quando `locked=true`. */
  lockedReason?: string;
}

export function PrazoEditorPopover({
  label,
  dataInicio,
  dataPrazo,
  diasAlertaAntes = 2,
  regime = "dias_uteis",
  limiteSuperior,
  limiteInferior,
  onSave,
  children,
  locked = false,
  lockedReason,
}: PrazoEditorPopoverProps) {
  const [open, setOpen] = useState(false);
  const ano = new Date().getFullYear();
  const { feriados } = useFeriados(ano);
  const { feriados: feriadosProx } = useFeriados(ano + 1);
  const feriadosSet = useMemo(
    () => feriadosToSet([...(feriados ?? []), ...(feriadosProx ?? [])]),
    [feriados, feriadosProx],
  );
  const feriadosDates = useMemo(
    () => Array.from(feriadosSet).map((s) => parseDateLocal(s)!).filter(Boolean),
    [feriadosSet],
  );

  const [inicio, setInicio] = useState<Date | undefined>(parseDateLocal(dataInicio) ?? undefined);
  const [prazo, setPrazo] = useState<Date | undefined>(parseDateLocal(dataPrazo) ?? undefined);
  const [duracao, setDuracao] = useState<number>(() =>
    inicio && prazo ? contarDiasUteisEntre(inicio, prazo, regime, feriadosSet) : 0,
  );
  const [alerta, setAlerta] = useState<number>(diasAlertaAntes);

  const limiteSup = parseDateLocal(limiteSuperior ?? null);
  const limiteInf = parseDateLocal(limiteInferior ?? null);

  const isDisabled = (d: Date) => {
    if (limiteSup && d > limiteSup) return true;
    if (limiteInf && d < limiteInf) return true;
    return false;
  };

  const aplicarDuracao = () => {
    if (!inicio || duracao <= 0) return;
    const novo = calcularPrazoComFeriados({ inicio, dias: duracao, regime, feriadosSet });
    setPrazo(novo);
  };

  const handleSave = async () => {
    await onSave({
      data_inicio: inicio ? toISODateLocal(inicio) : null,
      data_prazo: prazo ? toISODateLocal(prazo) : null,
      dias_alerta_antes: alerta,
    });
    setOpen(false);
  };

  const feriadoNome = (d: Date): string | undefined => {
    const key = toISODateLocal(d);
    return [...(feriados ?? []), ...(feriadosProx ?? [])].find((f) => f.data === key)?.nome;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children ?? (
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
            <CalendarIcon className="h-3.5 w-3.5" />
            {prazo ? format(prazo, "dd/MM/yyyy", { locale: ptBR }) : "Definir prazo"}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-4 z-50" align="start">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-[11px] text-muted-foreground">
              Regime: {regime === "corridos" ? "Dias corridos" : regime === "uteis_com_sabado" ? "Úteis com sábado" : "Dias úteis"} · Feriados nacionais aplicados
            </p>
          </div>

          <Tabs defaultValue="data">
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="data" className="text-xs">Por data final</TabsTrigger>
              <TabsTrigger value="duracao" className="text-xs">Por duração</TabsTrigger>
            </TabsList>

            <TabsContent value="data" className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px]">Início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8 mt-1">
                        <CalendarIcon className="h-3 w-3 mr-1.5" />
                        {inicio ? format(inicio, "dd/MM/yyyy") : "—"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={inicio}
                        onSelect={(d) => setInicio(d ?? undefined)}
                        disabled={isDisabled}
                        modifiers={{ feriado: feriadosDates }}
                        modifiersClassNames={{ feriado: "bg-amber-500/20 text-amber-600 font-semibold" }}
                        className="p-3 pointer-events-auto"
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-[11px]">Prazo final</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8 mt-1">
                        <CalendarIcon className="h-3 w-3 mr-1.5" />
                        {prazo ? format(prazo, "dd/MM/yyyy") : "—"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={prazo}
                        onSelect={(d) => setPrazo(d ?? undefined)}
                        disabled={isDisabled}
                        modifiers={{ feriado: feriadosDates }}
                        modifiersClassNames={{ feriado: "bg-amber-500/20 text-amber-600 font-semibold" }}
                        className="p-3 pointer-events-auto"
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              {inicio && prazo && (
                <p className="text-[11px] text-muted-foreground">
                  Duração: <strong>{contarDiasUteisEntre(inicio, prazo, regime, feriadosSet)}</strong> dia(s) úteis
                </p>
              )}
            </TabsContent>

            <TabsContent value="duracao" className="mt-3 space-y-2">
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                <div>
                  <Label className="text-[11px]">Início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8 mt-1">
                        <CalendarIcon className="h-3 w-3 mr-1.5" />
                        {inicio ? format(inicio, "dd/MM/yyyy") : "Hoje"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={inicio}
                        onSelect={(d) => setInicio(d ?? undefined)}
                        disabled={isDisabled}
                        modifiers={{ feriado: feriadosDates }}
                        modifiersClassNames={{ feriado: "bg-amber-500/20 text-amber-600 font-semibold" }}
                        className="p-3 pointer-events-auto"
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-[11px]">Dias úteis</Label>
                  <Input
                    type="number"
                    min={1}
                    value={duracao || ""}
                    onChange={(e) => setDuracao(Number(e.target.value) || 0)}
                    className="h-8 text-xs w-20 mt-1"
                  />
                </div>
                <Button size="sm" variant="secondary" className="h-8 gap-1.5 text-xs" onClick={aplicarDuracao}>
                  <Calculator className="h-3 w-3" /> Calcular
                </Button>
              </div>
              {prazo && (
                <p className="text-[11px] text-muted-foreground">
                  Prazo calculado: <strong>{format(prazo, "dd/MM/yyyy", { locale: ptBR })}</strong>
                  {feriadoNome(prazo) && (
                    <span className="text-amber-600 ml-1">(feriado: {feriadoNome(prazo)})</span>
                  )}
                </p>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-2 pt-2 border-t">
            <Label className="text-[11px] flex-1">Alertar antes (dias)</Label>
            <Input
              type="number"
              min={0}
              max={30}
              value={alerta}
              onChange={(e) => setAlerta(Number(e.target.value) || 0)}
              className="h-7 text-xs w-16"
            />
          </div>

          {limiteSuperior && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-[10px] text-muted-foreground cursor-help">
                    Limite superior: {format(parseDateLocal(limiteSuperior)!, "dd/MM/yyyy")}
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">O prazo deste item não pode ultrapassar o prazo do nível superior.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave}>Salvar prazo</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
