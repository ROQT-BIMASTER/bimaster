import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export interface NovoEventoPayload {
  titulo: string;
  secaoId: string;
  dataInicio: string;
  dataPrazo: string;
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

/**
 * Criação de evento diretamente pelo calendário, com data de início e data
 * final — diferente do fluxo de tarefa, que só define prazo.
 */
export function NovoEventoCalendarioDialog({
  open, onOpenChange, secoes, dataPadrao, saving = false, onSubmit,
}: Props) {
  const [titulo, setTitulo] = useState("");
  const [secaoId, setSecaoId] = useState<string>("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitulo("");
    setInicio(dataPadrao || "");
    setFim(dataPadrao || "");
    setSecaoId((prev) => prev || secoes[0]?.id || "");
  }, [open, dataPadrao, secoes]);

  const dataInvalida = Boolean(inicio && fim && fim < inicio);
  const podeSalvar = Boolean(titulo.trim() && secaoId && inicio && fim) && !dataInvalida && !saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!podeSalvar}
            onClick={() => onSubmit({ titulo: titulo.trim(), secaoId, dataInicio: inicio, dataPrazo: fim })}
          >
            {saving ? "Criando..." : "Criar evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
