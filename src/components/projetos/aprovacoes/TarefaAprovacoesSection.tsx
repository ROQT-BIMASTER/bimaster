import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ShieldCheck, Loader2, Send } from "lucide-react";
import { useLotesDaTarefa } from "@/hooks/useLoteAprovacao";
import { LoteAprovacaoCard } from "./LoteAprovacaoCard";
import { CriarLoteDialog } from "./CriarLoteDialog";
import { EnviarParaAprovacaoDialog } from "./EnviarParaAprovacaoDialog";

interface Props {
  tarefaId: string;
}

export function TarefaAprovacoesSection({ tarefaId }: Props) {
  const { data: lotes = [], isLoading } = useLotesDaTarefa(tarefaId);
  const [criarOpen, setCriarOpen] = useState(false);
  const [enviarOpen, setEnviarOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Aprovações
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{lotes.length}</Badge>
        </h3>
        <div className="flex gap-1.5">
          <Button size="sm" className="h-7 text-xs" onClick={() => setEnviarOpen(true)}>
            <Send className="h-3 w-3 mr-1" /> Enviar para aprovação
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCriarOpen(true)}>
            <Plus className="h-3 w-3 mr-1" /> Lote
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
        </div>
      )}

      {!isLoading && lotes.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhuma aprovação ainda. Use "Enviar para aprovação" para gerar cards individuais no Kanban,
          ou "Lote" para criar um agrupamento.
        </p>
      )}

      <div className="space-y-2">
        {lotes.map((l) => (
          <LoteAprovacaoCard key={l.id} lote={l} />
        ))}
      </div>

      <CriarLoteDialog tarefaId={tarefaId} open={criarOpen} onOpenChange={setCriarOpen} />
      <EnviarParaAprovacaoDialog tarefaId={tarefaId} open={enviarOpen} onOpenChange={setEnviarOpen} />
    </div>
  );
}
