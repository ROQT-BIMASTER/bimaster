import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProjetoHoras, HoraLancamento } from "@/hooks/useProjetoHoras";
import { Clock, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Props {
  projetoId: string;
  tarefaId?: string;
}

export function ProjetoHorasMiniPanel({ projetoId, tarefaId }: Props) {
  const { lancamentos, registrar, remover } = useProjetoHoras(projetoId);
  const [open, setOpen] = useState(false);
  const [horas, setHoras] = useState("");
  const [descricao, setDescricao] = useState("");

  const filtrados = tarefaId ? lancamentos.filter((l) => l.tarefa_id === tarefaId) : lancamentos;
  const totalHoras = filtrados.reduce((s, l) => s + Number(l.horas), 0);

  const handleSave = () => {
    const h = parseFloat(horas.replace(",", "."));
    if (!h || h <= 0) return;
    registrar.mutate({ horas: h, descricao, tarefa_id: tarefaId ?? null }, {
      onSuccess: () => { setOpen(false); setHoras(""); setDescricao(""); },
    });
  };

  return (
    <div className="border rounded-md p-2 bg-muted/20">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Clock className="h-3.5 w-3.5 text-primary" />
          Horas {tarefaId ? "da tarefa" : "do projeto"}
          <Badge variant="outline" className="text-[10px]">{totalHoras.toFixed(1)}h</Badge>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1">
              <Plus className="h-3 w-3" /> Registrar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Registrar horas</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label className="text-xs">Horas trabalhadas hoje</Label>
                <Input
                  type="number" step="0.25" min="0.25" max="24"
                  value={horas} onChange={(e) => setHoras(e.target.value)}
                  placeholder="Ex: 2.5"
                />
              </div>
              <div>
                <Label className="text-xs">O que foi feito (opcional)</Label>
                <Textarea
                  value={descricao} onChange={(e) => setDescricao(e.target.value)}
                  rows={3} placeholder="Resumo curto..."
                />
              </div>
              <Button onClick={handleSave} disabled={registrar.isPending} className="w-full">
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {filtrados.length > 0 && (
        <ScrollArea className="max-h-[180px]">
          <div className="space-y-1">
            {filtrados.slice(0, 20).map((l: HoraLancamento) => (
              <div key={l.id} className="flex items-center justify-between gap-2 text-[11px] p-1.5 rounded hover:bg-muted/40">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{l.autor?.nome?.split(" ")[0] || "—"}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">{Number(l.horas).toFixed(1)}h</Badge>
                    {l.origem === "ia_backfill" && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-primary/10">IA</Badge>}
                    <span className="text-muted-foreground">{format(new Date(l.data), "dd/MM", { locale: ptBR })}</span>
                  </div>
                  {l.descricao && <div className="text-muted-foreground truncate">{l.descricao}</div>}
                </div>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => remover.mutate(l.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
