import { useState } from "react";
import { Plus, Trash2, GripVertical, Loader2, Settings2, ChevronDown, ChevronUp, Users, ArrowRight, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useDocWorkflowEtapas } from "@/hooks/useDocWorkflow";
import { useApproverProfiles } from "@/hooks/useApproverProfiles";
import { DESPACHO_MODULOS_PROCESSO } from "./DespachoDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

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
  const { data: approvers = [] } = useApproverProfiles();
  const queryClient = useQueryClient();
  const [novaEtapa, setNovaEtapa] = useState("");
  const [novoTipoAcao, setNovoTipoAcao] = useState("aprovacao");
  const [expandedEtapa, setExpandedEtapa] = useState<string | null>(null);

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

  const handleUpdateEtapa = async (etapaId: string, updates: Record<string, any>) => {
    await (supabase
      .from("process_doc_workflow_etapas" as any)
      .update(updates)
      .eq("id", etapaId) as any);
    queryClient.invalidateQueries({ queryKey: ["doc-workflow-etapas", configId] });
  };

  const toggleAprovador = async (etapa: any, aprovadorId: string, aprovadorNome: string) => {
    const ids: string[] = etapa.aprovadores_ids || [];
    const nomes: string[] = etapa.aprovadores_nomes || [];
    const idx = ids.indexOf(aprovadorId);
    let newIds: string[], newNomes: string[];
    if (idx >= 0) {
      newIds = ids.filter((_, i) => i !== idx);
      newNomes = nomes.filter((_, i) => i !== idx);
    } else {
      newIds = [...ids, aprovadorId];
      newNomes = [...nomes, aprovadorNome];
    }
    await handleUpdateEtapa(etapa.id, { aprovadores_ids: newIds, aprovadores_nomes: newNomes });
  };

  return (
    <div className="border border-border rounded-lg p-3 bg-muted/30 space-y-2.5">
      <div className="flex items-center gap-2">
        <Settings2 className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-foreground">Fases do fluxo: {configNome}</span>
        <Badge variant="outline" className="text-[9px] ml-auto">Reutilizável</Badge>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : etapas.length === 0 ? (
        <p className="text-[10px] text-muted-foreground italic">Nenhuma fase configurada. Adicione abaixo.</p>
      ) : (
        <div className="space-y-1.5">
          {etapas.map((e: any, i: number) => {
            const isExpanded = expandedEtapa === e.id;
            const aprovadoresCount = (e.aprovadores_ids || []).length;
            return (
              <Collapsible key={e.id} open={isExpanded} onOpenChange={(o) => setExpandedEtapa(o ? e.id : null)}>
                <div className="border border-border/50 rounded-md bg-background">
                  <div className="flex items-center gap-1.5 px-2 py-1.5 group">
                    <GripVertical className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono shrink-0">
                      {i + 1}
                    </Badge>
                    <span className="text-xs text-foreground flex-1 truncate">{e.nome}</span>
                    <Badge variant="outline" className="text-[9px] shrink-0">
                      {TIPOS_ACAO.find(t => t.key === e.tipo_acao)?.label || e.tipo_acao}
                    </Badge>
                    {aprovadoresCount > 0 && (
                      <Badge variant="secondary" className="text-[9px] shrink-0 gap-0.5">
                        <Users className="h-2.5 w-2.5" />
                        {aprovadoresCount}
                      </Badge>
                    )}
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    </CollapsibleTrigger>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                      onClick={() => deleteEtapa.mutate(e.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  <CollapsibleContent>
                    <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/30">
                      {/* Aprovadores */}
                      <div>
                        <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1 mb-1.5">
                          <Users className="h-3 w-3" /> Responsáveis pela ação
                        </span>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {approvers.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground italic">Nenhum aprovador disponível</p>
                          ) : (
                            approvers.map((ap) => {
                              const isChecked = (e.aprovadores_ids || []).includes(ap.id);
                              return (
                                <label key={ap.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={() => toggleAprovador(e, ap.id, ap.nome)}
                                    className="h-3.5 w-3.5"
                                  />
                                  <span className="text-xs text-foreground">{ap.nome}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Routing */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1 mb-1">
                            <ArrowRight className="h-3 w-3 text-green-500" /> Se aprovado → módulo
                          </span>
                          <Select
                            value={e.modulo_aprovacao || "nenhum"}
                            onValueChange={(v) => handleUpdateEtapa(e.id, { modulo_aprovacao: v === "nenhum" ? null : v })}
                          >
                            <SelectTrigger className="h-7 text-[10px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nenhum" className="text-xs">Próxima fase</SelectItem>
                              {DESPACHO_MODULOS_PROCESSO.map(m => (
                                <SelectItem key={m.key} value={m.key} className="text-xs">{m.icon} {m.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1 mb-1">
                            <ArrowLeftRight className="h-3 w-3 text-destructive" /> Se recusado → módulo
                          </span>
                          <Select
                            value={e.modulo_recusa || "nenhum"}
                            onValueChange={(v) => handleUpdateEtapa(e.id, { modulo_recusa: v === "nenhum" ? null : v })}
                          >
                            <SelectTrigger className="h-7 text-[10px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nenhum" className="text-xs">Retornar ao remetente</SelectItem>
                              {DESPACHO_MODULOS_PROCESSO.map(m => (
                                <SelectItem key={m.key} value={m.key} className="text-xs">{m.icon} {m.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
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
