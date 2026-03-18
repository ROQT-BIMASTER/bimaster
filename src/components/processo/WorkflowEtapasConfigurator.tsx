import { useState } from "react";
import { Plus, Trash2, GripVertical, Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useDocWorkflowEtapas } from "@/hooks/useDocWorkflow";

const TIPOS_ACAO = [
  { key: "aprovacao", label: "Aprovação" },
  { key: "revisao", label: "Revisão" },
  { key: "parecer", label: "Parecer técnico" },
  { key: "ciencia", label: "Ciência" },
  { key: "assinatura", label: "Assinatura" },
];

interface WorkflowEtapasConfiguratorProps {
  configId: string;
  configNome: string;
}

export function WorkflowEtapasConfigurator({ configId, configNome }: WorkflowEtapasConfiguratorProps) {
  const { etapas, isLoading, addEtapa, deleteEtapa } = useDocWorkflowEtapas(configId);
  const [novaEtapa, setNovaEtapa] = useState("");
  const [novoTipoAcao, setNovoTipoAcao] = useState("aprovacao");

  const handleAdd = async () => {
    if (!novaEtapa.trim()) return;
    await addEtapa.mutateAsync({
      config_id: configId,
      nome: novaEtapa.trim(),
      ordem: etapas.length + 1,
      tipo_acao: novoTipoAcao,
    });
    setNovaEtapa("");
    setNovoTipoAcao("aprovacao");
  };

  return (
    <div className="border border-border rounded-lg p-3 bg-muted/30 space-y-2.5">
      <div className="flex items-center gap-2">
        <Settings2 className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-foreground">Fases do fluxo: {configNome}</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : etapas.length === 0 ? (
        <p className="text-[10px] text-muted-foreground italic">Nenhuma fase configurada. Adicione abaixo.</p>
      ) : (
        <div className="space-y-1">
          {etapas.map((e, i) => (
            <div key={e.id} className="flex items-center gap-1.5 group">
              <GripVertical className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono shrink-0">
                {i + 1}
              </Badge>
              <span className="text-xs text-foreground flex-1 truncate">{e.nome}</span>
              <Badge variant="outline" className="text-[9px] shrink-0">
                {TIPOS_ACAO.find(t => t.key === e.tipo_acao)?.label || e.tipo_acao}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                onClick={() => deleteEtapa.mutate(e.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1.5 items-end">
        <div className="flex-1">
          <Input
            value={novaEtapa}
            onChange={(e) => setNovaEtapa(e.target.value)}
            placeholder="Nome da fase..."
            className="h-7 text-xs"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
        </div>
        <Select value={novoTipoAcao} onValueChange={setNovoTipoAcao}>
          <SelectTrigger className="h-7 w-28 text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPOS_ACAO.map(t => (
              <SelectItem key={t.key} value={t.key} className="text-xs">{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="h-7 text-xs px-2 shrink-0 gap-1"
          onClick={handleAdd}
          disabled={!novaEtapa.trim() || addEtapa.isPending}
        >
          {addEtapa.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Fase
        </Button>
      </div>
    </div>
  );
}
