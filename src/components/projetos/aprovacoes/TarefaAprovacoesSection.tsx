import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ShieldCheck, Loader2 } from "lucide-react";
import { useLotesDaTarefa } from "@/hooks/useLoteAprovacao";
import { LoteAprovacaoCard } from "./LoteAprovacaoCard";
import { CriarLoteDialog } from "./CriarLoteDialog";

interface Props {
  tarefaId: string;
}

export function TarefaAprovacoesSection({ tarefaId }: Props) {
  const { data: lotes = [], isLoading } = useLotesDaTarefa(tarefaId);
  const [criarOpen, setCriarOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Aprovações
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{lotes.length}</Badge>
        </h3>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCriarOpen(true)}>
          <Plus className="h-3 w-3 mr-1" /> Novo lote
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
        </div>
      )}

      {!isLoading && lotes.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhum lote de aprovação criado. Crie um para iniciar o fluxo de alçadas dos documentos.
        </p>
      )}

      <div className="space-y-2">
        {lotes.map((l) => (
          <LoteAprovacaoCard key={l.id} lote={l} />
        ))}
      </div>

      <CriarLoteDialog tarefaId={tarefaId} open={criarOpen} onOpenChange={setCriarOpen} />
    </div>
  );
}
