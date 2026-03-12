import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, Circle, XCircle, Plus, Clock, Trash2, Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ETAPAS_DISPONIVEIS = [
  { value: "regulatorio", label: "Regulatório", papelRequerido: "regulatorio" },
  { value: "qualidade", label: "Qualidade", papelRequerido: "gestor_produto" },
  { value: "diretoria", label: "Diretoria", papelRequerido: "diretoria" },
  { value: "arte", label: "Arte/Criação", papelRequerido: "design" },
  { value: "embalagem", label: "Embalagem", papelRequerido: "design" },
  { value: "marketing", label: "Marketing", papelRequerido: "gestor_produto" },
  { value: "producao", label: "Produção", papelRequerido: "coordenador" },
];

const ETAPA_PAPEIS_PERMITIDOS: Record<string, string[]> = {
  regulatorio: ["regulatorio", "coordenador", "gestor_produto"],
  qualidade: ["gestor_produto", "coordenador"],
  diretoria: ["diretoria", "coordenador"],
  arte: ["design", "controle_arte", "coordenador"],
  embalagem: ["design", "controle_arte", "coordenador"],
  marketing: ["gestor_produto", "coordenador"],
  producao: ["coordenador", "gestor_produto"],
};

// Roles allowed to manage (add/remove) approval stages
const MANAGE_ROLES = ["coordenador", "gestor_produto"];

interface Aprovacao {
  id: string;
  tarefa_id: string;
  etapa: string;
  status: string;
  aprovador_id: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjetoAprovacaoWorkflowProps {
  tarefaId: string;
  projetoId?: string;
  currentUserPapel?: string;
}

export function ProjetoAprovacaoWorkflow({ tarefaId, projetoId, currentUserPapel }: ProjetoAprovacaoWorkflowProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newEtapa, setNewEtapa] = useState("");
  const [observacao, setObservacao] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<Aprovacao | null>(null);

  const canManageStages = MANAGE_ROLES.includes(currentUserPapel || "");

  const { data: aprovacoes = [], isLoading } = useQuery({
    queryKey: ["tarefa-aprovacoes", tarefaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefa_aprovacoes" as any)
        .select("*")
        .eq("tarefa_id", tarefaId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as Aprovacao[];
    },
    enabled: !!tarefaId,
  });

  const aprovadorIds = [...new Set(aprovacoes.filter(a => a.aprovador_id).map(a => a.aprovador_id!))];
  const { data: profiles = [] } = useQuery({
    queryKey: ["aprovador-profiles", aprovadorIds.join(",")],
    queryFn: async () => {
      if (aprovadorIds.length === 0) return [];
      const { data } = await supabase.from("profiles").select("id, nome, avatar_url").in("id", aprovadorIds);
      return data || [];
    },
    enabled: aprovadorIds.length > 0,
  });

  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));

  const canApproveEtapa = (etapa: string): boolean => {
    if (!currentUserPapel) return false;
    const allowed = ETAPA_PAPEIS_PERMITIDOS[etapa] || [];
    return allowed.includes(currentUserPapel);
  };

  const addEtapa = useMutation({
    mutationFn: async (etapa: string) => {
      const { error } = await supabase
        .from("projeto_tarefa_aprovacoes" as any)
        .insert({ tarefa_id: tarefaId, etapa, status: "pendente" } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-aprovacoes", tarefaId] });
      setNewEtapa("");
      toast.success("Etapa de aprovação adicionada!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, obs, etapa }: { id: string; status: string; obs?: string; etapa: string }) => {
      if (!canApproveEtapa(etapa)) {
        throw new Error(`Você não tem permissão para ${status === "aprovado" ? "aprovar" : "rejeitar"} esta etapa.`);
      }
      if (status === "rejeitado" && (!obs || obs.trim().length === 0)) {
        throw new Error("É obrigatório informar o motivo da rejeição.");
      }

      const { error } = await supabase
        .from("projeto_tarefa_aprovacoes" as any)
        .update({
          status,
          aprovador_id: user?.id,
          observacoes: obs || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-aprovacoes", tarefaId] });
      toast.success("Status de aprovação atualizado!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeEtapa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("projeto_tarefa_aprovacoes" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-aprovacoes", tarefaId] });
      toast.success("Etapa removida!");
      setDeleteConfirm(null);
    },
  });

  const etapasUsadas = aprovacoes.map(a => a.etapa);
  const etapasDisponiveis = ETAPAS_DISPONIVEIS.filter(e => !etapasUsadas.includes(e.value));

  const statusIcon = (status: string) => {
    switch (status) {
      case "aprovado": return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
      case "rejeitado": return <XCircle className="h-5 w-5 text-destructive" />;
      default: return <Clock className="h-5 w-5 text-amber-400" />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "aprovado": return "bg-emerald-500/15 text-emerald-500 border-0";
      case "rejeitado": return "bg-destructive/15 text-destructive border-0";
      default: return "bg-amber-500/15 text-amber-500 border-0";
    }
  };

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Workflow de Aprovação</h3>
        <Badge variant="outline" className="text-[10px]">
          {aprovacoes.filter(a => a.status === "aprovado").length}/{aprovacoes.length} aprovadas
        </Badge>
      </div>

      {aprovacoes.length > 0 ? (
        <div className="relative space-y-0">
          {aprovacoes.length > 1 && (
            <div className="absolute left-[11px] top-6 bottom-6 w-0.5 bg-border/50" />
          )}
          {aprovacoes.map((aprov) => {
            const etapaLabel = ETAPAS_DISPONIVEIS.find(e => e.value === aprov.etapa)?.label || aprov.etapa;
            const aprovador = aprov.aprovador_id ? profileMap[aprov.aprovador_id] : null;
            const userCanApprove = canApproveEtapa(aprov.etapa);

            return (
              <div key={aprov.id} className="relative flex gap-3 py-3">
                <div className="relative z-10 flex-shrink-0 mt-0.5">
                  {statusIcon(aprov.status)}
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{etapaLabel}</span>
                      <Badge className={cn("text-[10px]", statusColor(aprov.status))}>
                        {aprov.status === "aprovado" ? "Aprovado" : aprov.status === "rejeitado" ? "Rejeitado" : "Pendente"}
                      </Badge>
                      {aprov.status === "pendente" && !userCanApprove && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground/50" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Apenas {(ETAPA_PAPEIS_PERMITIDOS[aprov.etapa] || []).join(", ")} podem aprovar</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    {/* Only coordenador/gestor can remove stages */}
                    {aprov.status === "pendente" && canManageStages && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDeleteConfirm(aprov)}>
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    )}
                  </div>

                  {aprovador && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={aprovador.avatar_url || undefined} />
                        <AvatarFallback className="text-[7px]">{aprovador.nome?.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span>{aprovador.nome}</span>
                      <span>· {format(new Date(aprov.updated_at), "dd MMM HH:mm", { locale: ptBR })}</span>
                    </div>
                  )}

                  {aprov.observacoes && (
                    <p className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1.5 italic">
                      "{aprov.observacoes}"
                    </p>
                  )}

                  {aprov.status === "pendente" && userCanApprove && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Observação (obrigatória para rejeição)..."
                        value={observacao[aprov.id] || ""}
                        onChange={e => setObservacao(prev => ({ ...prev, [aprov.id]: e.target.value }))}
                        className="min-h-[50px] text-xs resize-none"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => updateStatus.mutate({ id: aprov.id, status: "aprovado", obs: observacao[aprov.id], etapa: aprov.etapa })}
                        >
                          <CheckCircle2 className="h-3 w-3" /> Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs gap-1"
                          disabled={!observacao[aprov.id]?.trim()}
                          onClick={() => updateStatus.mutate({ id: aprov.id, status: "rejeitado", obs: observacao[aprov.id], etapa: aprov.etapa })}
                        >
                          <XCircle className="h-3 w-3" /> Rejeitar
                        </Button>
                      </div>
                    </div>
                  )}

                  {aprov.status === "pendente" && !userCanApprove && (
                    <p className="text-[10px] text-muted-foreground/60 italic">
                      Aguardando aprovação de: {(ETAPA_PAPEIS_PERMITIDOS[aprov.etapa] || []).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground py-2">
          Nenhuma etapa de aprovação definida. Adicione etapas abaixo.
        </p>
      )}

      {/* Only coordenador/gestor can add stages */}
      {etapasDisponiveis.length > 0 && canManageStages && (
        <div className="flex items-center gap-2">
          <Select value={newEtapa} onValueChange={setNewEtapa}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Adicionar etapa..." />
            </SelectTrigger>
            <SelectContent>
              {etapasDisponiveis.map(e => (
                <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="h-8 text-xs gap-1"
            disabled={!newEtapa}
            onClick={() => newEtapa && addEtapa.mutate(newEtapa)}
          >
            <Plus className="h-3 w-3" /> Adicionar
          </Button>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover etapa de aprovação?</AlertDialogTitle>
            <AlertDialogDescription>
              A etapa "{ETAPAS_DISPONIVEIS.find(e => e.value === deleteConfirm?.etapa)?.label}" será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && removeEtapa.mutate(deleteConfirm.id)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
