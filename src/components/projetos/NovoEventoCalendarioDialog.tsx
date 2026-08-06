import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export type FrequenciaRecorrencia = "nenhuma" | "semanal" | "mensal";

export interface NovoEventoPayload {
  titulo: string;
  secaoId: string;
  dataInicio: string;
  dataPrazo: string;
  recorrencia: {
    frequencia: FrequenciaRecorrencia;
    intervalo: number;
    ate: string | null;
  };
  lembrete: {
    ativo: boolean;
    antecedenciaMinutos: number;
    email: boolean;
    notificacao: boolean;
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secoes: { id: string; nome: string }[];
  /** Data clicada no calendário (Y-M-D) usada como início e fim padrão. */
  dataPadrao: string | null;
  saving?: boolean;
  onSubmit: (payload: NovoEventoPayload) => void;
}

const ANTECEDENCIAS: { value: string; label: string }[] = [
  { value: "30", label: "30 minutos antes" },
  { value: "60", label: "1 hora antes" },
  { value: "180", label: "3 horas antes" },
  { value: "1440", label: "1 dia antes" },
  { value: "2880", label: "2 dias antes" },
  { value: "10080", label: "1 semana antes" },
];

/**
 * Criação de evento diretamente pelo calendário, com data de início e data
 * final, recorrência opcional (semanal/mensal) e lembrete automático.
 */
export function NovoEventoCalendarioDialog({
  open, onOpenChange, secoes, dataPadrao, saving = false, onSubmit,
}: Props) {
  const [titulo, setTitulo] = useState("");
  const [secaoId, setSecaoId] = useState<string>("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [frequencia, setFrequencia] = useState<FrequenciaRecorrencia>("nenhuma");
  const [intervalo, setIntervalo] = useState("1");
  const [ate, setAte] = useState("");
  const [lembreteAtivo, setLembreteAtivo] = useState(false);
  const [antecedencia, setAntecedencia] = useState("1440");
  const [canalEmail, setCanalEmail] = useState(true);
  const [canalNotificacao, setCanalNotificacao] = useState(true);

  useEffect(() => {
    if (!open) return;
    setTitulo("");
    setInicio(dataPadrao || "");
    setFim(dataPadrao || "");
    setFrequencia("nenhuma");
    setIntervalo("1");
    setAte("");
    setLembreteAtivo(false);
    setAntecedencia("1440");
    setCanalEmail(true);
    setCanalNotificacao(true);
    setSecaoId((prev) => prev || secoes[0]?.id || "");
  }, [open, dataPadrao, secoes]);

  const dataInvalida = Boolean(inicio && fim && fim < inicio);
  const ateInvalida = frequencia !== "nenhuma" && Boolean(ate) && Boolean(inicio) && ate < inicio;
  const lembreteInvalido = lembreteAtivo && !canalEmail && !canalNotificacao;
  const podeSalvar =
    Boolean(titulo.trim() && secaoId && inicio && fim) &&
    !dataInvalida && !ateInvalida && !lembreteInvalido && !saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo evento</DialogTitle>
          <DialogDescription>
            Defina data de início e data final. O evento aparece como barra contínua no calendário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="evento-titulo">Título</Label>
            <Input
              id="evento-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Semana de gravações"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Seção</Label>
            <Select value={secaoId} onValueChange={setSecaoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a seção" />
              </SelectTrigger>
              <SelectContent>
                {secoes.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="evento-inicio">Início</Label>
              <Input
                id="evento-inicio"
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="evento-fim">Fim</Label>
              <Input
                id="evento-fim"
                type="date"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
              />
            </div>
          </div>

          {dataInvalida && (
            <p className="text-xs text-destructive">A data final não pode ser anterior à data de início.</p>
          )}

          {/* Recorrência */}
          <div className="rounded-lg border p-3 space-y-3">
            <div className="space-y-1.5">
              <Label>Repetição</Label>
              <Select value={frequencia} onValueChange={(v) => setFrequencia(v as FrequenciaRecorrencia)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Não se repete</SelectItem>
                  <SelectItem value="semanal">Semanalmente</SelectItem>
                  <SelectItem value="mensal">Mensalmente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {frequencia !== "nenhuma" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="evento-intervalo">
                    A cada ({frequencia === "semanal" ? "semanas" : "meses"})
                  </Label>
                  <Input
                    id="evento-intervalo"
                    type="number"
                    min={1}
                    max={12}
                    value={intervalo}
                    onChange={(e) => setIntervalo(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="evento-ate">Encerrar em</Label>
                  <Input
                    id="evento-ate"
                    type="date"
                    value={ate}
                    onChange={(e) => setAte(e.target.value)}
                  />
                </div>
              </div>
            )}

            {frequencia !== "nenhuma" && (
              <p className="text-[11px] text-muted-foreground">
                Cada ocorrência é independente: editar ou concluir uma não altera as demais.
                Sem data de encerramento, a série é gerada por 6 meses.
              </p>
            )}
            {ateInvalida && (
              <p className="text-xs text-destructive">O encerramento não pode ser anterior ao início.</p>
            )}
          </div>

          {/* Lembretes */}
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="evento-lembrete" className="cursor-pointer">Lembrete automático</Label>
              <Switch id="evento-lembrete" checked={lembreteAtivo} onCheckedChange={setLembreteAtivo} />
            </div>

            {lembreteAtivo && (
              <>
                <Select value={antecedencia} onValueChange={setAntecedencia}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANTECEDENCIAS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={canalEmail} onCheckedChange={(v) => setCanalEmail(Boolean(v))} />
                    E-mail
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={canalNotificacao} onCheckedChange={(v) => setCanalNotificacao(Boolean(v))} />
                    Notificação no sistema
                  </label>
                </div>
                {lembreteInvalido && (
                  <p className="text-xs text-destructive">Selecione ao menos um canal de lembrete.</p>
                )}
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!podeSalvar}
            onClick={() => onSubmit({
              titulo: titulo.trim(),
              secaoId,
              dataInicio: inicio,
              dataPrazo: fim,
              recorrencia: {
                frequencia,
                intervalo: Math.min(Math.max(Number(intervalo) || 1, 1), 12),
                ate: ate || null,
              },
              lembrete: {
                ativo: lembreteAtivo,
                antecedenciaMinutos: Number(antecedencia) || 1440,
                email: canalEmail,
                notificacao: canalNotificacao,
              },
            })}
          >
            {saving ? "Criando..." : "Criar evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
