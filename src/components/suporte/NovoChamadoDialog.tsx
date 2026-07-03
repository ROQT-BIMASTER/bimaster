import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, LifeBuoy } from "lucide-react";
import { useSuporteFilas } from "@/hooks/suporte/useSuporteFilas";
import { useSuporteAcoes } from "@/hooks/suporte/useSuporteAcoes";
import { SUPORTE_PRIORIDADE_LABEL, type SuportePrioridade } from "@/hooks/suporte/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado criado — recebe o id do ticket para a página abrir a thread. */
  onCriado?: (ticketId: string) => void;
}

export function NovoChamadoDialog({ open, onOpenChange, onCriado }: Props) {
  const { data: filas = [], isLoading: filasLoading } = useSuporteFilas();
  const { abrirChamado } = useSuporteAcoes();
  const [filaId, setFilaId] = useState<string>("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<SuportePrioridade>("media");

  const podeEnviar = !!filaId && titulo.trim().length > 0 && !abrirChamado.isPending;

  const submit = async () => {
    if (!podeEnviar) return;
    const res = await abrirChamado.mutateAsync({
      filaId,
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      prioridade,
    });
    setFilaId("");
    setTitulo("");
    setDescricao("");
    setPrioridade("media");
    onOpenChange(false);
    onCriado?.(res.ticket_id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-primary" />
            Novo chamado
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Departamento *</Label>
            <Select value={filaId} onValueChange={setFilaId}>
              <SelectTrigger>
                <SelectValue placeholder={filasLoading ? "Carregando..." : "Para qual departamento?"} />
              </SelectTrigger>
              <SelectContent>
                {filas
                  .filter((f) => f.aceita_chamados)
                  .map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Assunto *</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Resumo curto do que você precisa"
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhe a solicitação (vira a 1ª mensagem do chamado)"
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select value={prioridade} onValueChange={(v) => setPrioridade(v as SuportePrioridade)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SUPORTE_PRIORIDADE_LABEL) as SuportePrioridade[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {SUPORTE_PRIORIDADE_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!podeEnviar}>
            {abrirChamado.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Abrir chamado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
