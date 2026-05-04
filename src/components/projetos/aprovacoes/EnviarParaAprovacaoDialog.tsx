import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { FileText, Loader2, UserCog, Workflow } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTemplatesAlcadas } from "@/hooks/useLoteAprovacao";
import { useChinaDocsDaTarefa } from "@/hooks/useChinaDocsDaTarefa";
import { useEnviarDocumentoAprovacao } from "@/hooks/useKanbanAprovacoes";

interface Props {
  tarefaId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface EtapaTpl {
  id: string;
  nome: string;
  ordem: number;
  tipo: string;
  responsavel_id: string | null;
}

interface UserOption {
  id: string;
  nome: string | null;
}

function useEtapasDoPipeline(pipelineId: string) {
  return useQuery({
    queryKey: ["pipeline-etapas", pipelineId],
    enabled: !!pipelineId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fluxo_aprovacao_etapas")
        .select("id, nome, ordem, tipo, responsavel_id")
        .eq("config_id", pipelineId)
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data || []) as EtapaTpl[];
    },
  });
}

function useUsuariosDoProjeto(tarefaId: string) {
  return useQuery({
    queryKey: ["usuarios-projeto-tarefa", tarefaId],
    enabled: !!tarefaId,
    queryFn: async (): Promise<UserOption[]> => {
      const { data: tarefa } = await supabase
        .from("projeto_tarefas")
        .select("projeto_id")
        .eq("id", tarefaId)
        .maybeSingle();
      if (!tarefa?.projeto_id) return [];
      const { data: membros } = await supabase
        .from("projeto_membros")
        .select("user_id")
        .eq("projeto_id", tarefa.projeto_id);
      const ids = (membros || []).map((m: any) => m.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", ids);
      return (profs || []) as UserOption[];
    },
  });
}

export function EnviarParaAprovacaoDialog({ tarefaId, open, onOpenChange }: Props) {
  const { data: templates = [], isLoading: loadingTpl } = useTemplatesAlcadas();
  const { data: docs = [], isLoading: loadingDocs } = useChinaDocsDaTarefa(tarefaId);
  const { data: usuarios = [] } = useUsuariosDoProjeto(tarefaId);
  const enviar = useEnviarDocumentoAprovacao();

  const [pipelineId, setPipelineId] = useState("");
  const { data: etapas = [] } = useEtapasDoPipeline(pipelineId);

  const [prazo, setPrazo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  // Reset overrides quando muda o pipeline
  useEffect(() => {
    setOverrides({});
  }, [pipelineId]);

  function toggle(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  function setOverride(etapaId: string, userId: string) {
    setOverrides((cur) => {
      const next = { ...cur };
      if (!userId) delete next[etapaId];
      else next[etapaId] = userId;
      return next;
    });
  }

  const docsDisponiveis = useMemo(() => docs, [docs]);

  async function handleSubmit() {
    if (!pipelineId || selected.size === 0) return;
    await enviar.mutateAsync({
      documentoIds: Array.from(selected),
      pipelineId,
      tarefaId,
      prazoEm: prazo ? new Date(prazo).toISOString() : undefined,
      overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
    });
    setPipelineId("");
    setPrazo("");
    setSelected(new Set());
    setOverrides({});
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar documentos para aprovação</DialogTitle>
          <DialogDescription>
            Cada documento vira um card individual no Kanban, com o aprovador definido por etapa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Pipeline</Label>
              <Select value={pipelineId} onValueChange={setPipelineId} disabled={loadingTpl}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prazo">Prazo (opcional)</Label>
              <Input id="prazo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </div>
          </div>

          {pipelineId && etapas.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs">
                  <UserCog className="h-3.5 w-3.5 text-primary" />
                  Aprovadores por etapa
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Em branco = mantém o responsável padrão da etapa. Você pode escolher qualquer membro do projeto.
                </p>
                <div className="space-y-1.5 rounded-md border border-border p-2 bg-muted/20">
                  {etapas.map((et) => (
                    <div key={et.id} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5 flex items-center gap-1.5 text-xs">
                        <Workflow className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium truncate">{et.nome}</span>
                        <span className="text-[10px] text-muted-foreground">({et.tipo})</span>
                      </div>
                      <div className="col-span-7">
                        <Select
                          value={overrides[et.id] || ""}
                          onValueChange={(v) => setOverride(et.id, v === "_default" ? "" : v)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Padrão da etapa" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_default">Padrão da etapa</SelectItem>
                            {usuarios.map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.nome || u.id.slice(0, 8)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Documentos ({selected.size}/{docsDisponiveis.length})</Label>
            <ScrollArea className="h-40 rounded-md border border-border p-2">
              {loadingDocs && <p className="text-xs text-muted-foreground">Carregando…</p>}
              {!loadingDocs && docsDisponiveis.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum documento vinculado a esta tarefa. Vincule documentos primeiro.
                </p>
              )}
              <div className="space-y-1">
                {docsDisponiveis.map((d) => (
                  <label
                    key={d.documento_id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40 cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.has(d.documento_id)}
                      onCheckedChange={() => toggle(d.documento_id)}
                    />
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs truncate flex-1">{d.nome_arquivo || d.tipo_documento}</span>
                    <span className="text-[10px] text-muted-foreground">{d.tipo_documento}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={!pipelineId || selected.size === 0 || enviar.isPending}
          >
            {enviar.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
