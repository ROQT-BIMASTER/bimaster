import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CheckCircle2, FileText, FolderOpen, ShieldCheck, ShieldX, Loader2, AlertTriangle } from "lucide-react";

const COFRE_CATEGORIA_LABELS: Record<string, string> = {
  briefing: "Briefing",
  arte_final: "Arte Final",
  rotulo: "Rótulo",
  ficha_tecnica: "Ficha Técnica",
  laudo: "Laudo",
  certificado: "Certificado",
  orcamento: "Orçamento",
  nota_fiscal: "Nota Fiscal",
  art: "ART",
  outro: "Outro",
};

interface ValidacaoFinalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarefaId: string;
  produtoId: string;
  produtoNome?: string;
  onSuccess: () => void;
}

export function ValidacaoFinalDialog({
  open, onOpenChange, tarefaId, produtoId, produtoNome, onSuccess,
}: ValidacaoFinalDialogProps) {
  const { user } = useAuth();
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [checkedCategories, setCheckedCategories] = useState<Set<string>>(new Set());
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    if (!open || !tarefaId) return;
    setLoading(true);
    
    // Load documents and approval stages in parallel
    const [docsResult, approvalsResult] = await Promise.all([
      supabase
        .from("fabrica_revisao_documentos" as any)
        .select("*")
        .eq("origem_projeto_tarefa_id", tarefaId)
        .order("created_at", { ascending: false }),
      supabase
        .from("projeto_tarefa_aprovacoes" as any)
        .select("*")
        .eq("tarefa_id", tarefaId)
        .order("created_at", { ascending: true }),
    ]);
    
    setDocumentos((docsResult.data as any[]) || []);
    setPendingApprovals((approvalsResult.data as any[]) || []);
    setLoading(false);
  }, [open, tarefaId]);

  useEffect(() => { loadData(); }, [loadData]);

  const docsByCategoria = documentos.reduce((acc: Record<string, any[]>, doc: any) => {
    const cat = doc.categoria || "outro";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  const allCategories = Object.keys(docsByCategoria);
  const allChecked = allCategories.length > 0 && allCategories.every(c => checkedCategories.has(c));

  // CRITICAL: Check if all approval stages are approved
  const hasApprovalStages = pendingApprovals.length > 0;
  const allApprovalsApproved = pendingApprovals.every(a => a.status === "aprovado");
  const pendingOrRejected = pendingApprovals.filter(a => a.status !== "aprovado");

  const handleSubmit = async () => {
    if (!user) return;
    
    // Block if approval stages are not all approved
    if (hasApprovalStages && !allApprovalsApproved) {
      toast.error("Todas as etapas de aprovação devem estar aprovadas antes de enviar para validação final.");
      return;
    }
    
    setSubmitting(true);
    try {
      const { error: valError } = await supabase
        .from("projeto_tarefa_validacoes" as any)
        .insert({
          tarefa_id: tarefaId,
          produto_id: produtoId,
          status: "pendente",
          solicitado_por: user.id,
          observacoes: observacoes || null,
        } as any);
      if (valError) throw valError;

      const { error: taskError } = await supabase
        .from("projeto_tarefas")
        .update({ validacao_status: "pendente_validacao" } as any)
        .eq("id", tarefaId);
      if (taskError) throw taskError;

      toast.success("Enviado para validação final!");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            Enviar para Validação Final
          </DialogTitle>
          <DialogDescription>
            Confira os documentos do Cofre para {produtoNome || "o produto"} antes de enviar para aprovação.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          <div className="space-y-4 pr-2">
            {/* Approval stages warning */}
            {hasApprovalStages && !allApprovalsApproved && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-destructive">Etapas de aprovação pendentes</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    As seguintes etapas precisam ser aprovadas: {pendingOrRejected.map(a => a.etapa).join(", ")}
                  </p>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : documentos.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Nenhum documento no Cofre vinculado a esta tarefa.
              </div>
            ) : (
              <>
                <Label className="text-xs text-muted-foreground">
                  Checklist de conferência — confirme cada categoria
                </Label>
                {allCategories.map(cat => (
                  <div key={cat} className="border border-border/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={checkedCategories.has(cat)}
                        onCheckedChange={(checked) => {
                          const next = new Set(checkedCategories);
                          if (checked) next.add(cat); else next.delete(cat);
                          setCheckedCategories(next);
                        }}
                      />
                      <Badge variant="outline" className="text-xs">
                        {COFRE_CATEGORIA_LABELS[cat] || cat}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ({docsByCategoria[cat].length} doc{docsByCategoria[cat].length > 1 ? "s" : ""})
                      </span>
                    </div>
                    <div className="pl-6 space-y-1">
                      {docsByCategoria[cat].map((doc: any) => (
                        <div key={doc.id} className="flex items-center gap-2 text-xs text-foreground/80">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate">{doc.nome_arquivo}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}

            <div className="space-y-2">
              <Label className="text-sm">Observações</Label>
              <Textarea
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                placeholder="Observações opcionais para o aprovador..."
                className="min-h-[60px] text-sm"
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || documentos.length === 0 || !allChecked || (hasApprovalStages && !allApprovalsApproved)}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Enviar para Validação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AprovacaoPanelProps {
  tarefaId: string;
  validacaoStatus: string | null;
  onStatusChange: () => void;
}

export function AprovacaoPanel({ tarefaId, validacaoStatus, onStatusChange }: AprovacaoPanelProps) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [rejectObs, setRejectObs] = useState("");
  const [showReject, setShowReject] = useState(false);

  if (!validacaoStatus || validacaoStatus === "validada" || validacaoStatus === "rejeitada") {
    return null;
  }

  const handleAprovar = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const { data: tarefaData } = await supabase
        .from("projeto_tarefas")
        .select("projeto_id")
        .eq("id", tarefaId)
        .single();

      if (tarefaData?.projeto_id) {
        const { data: canPublish } = await supabase.rpc("can_publish_to_cofre", {
          _user_id: user.id,
          _projeto_id: tarefaData.projeto_id,
        });
        if (!canPublish) {
          toast.error("Apenas usuários com papel 'Admin. Cofre' ou 'Coordenador' podem aprovar.");
          setSubmitting(false);
          return;
        }
      }

      await supabase
        .from("projeto_tarefa_validacoes" as any)
        .update({
          status: "aprovada",
          aprovado_por: user.id,
          aprovado_em: new Date().toISOString(),
        } as any)
        .eq("tarefa_id", tarefaId)
        .eq("status", "pendente");

      await supabase
        .from("projeto_tarefas")
        .update({ validacao_status: "validada" } as any)
        .eq("id", tarefaId);

      await supabase
        .from("fabrica_revisao_documentos" as any)
        .update({ visivel_fabrica: true } as any)
        .eq("origem_projeto_tarefa_id", tarefaId);

      toast.success("Documentos aprovados e visíveis para a Fábrica!");
      onStatusChange();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejeitar = async () => {
    if (!user) return;
    // Require rejection reason
    if (!rejectObs.trim()) {
      toast.error("Informe o motivo da rejeição.");
      return;
    }
    setSubmitting(true);
    try {
      await supabase
        .from("projeto_tarefa_validacoes" as any)
        .update({
          status: "rejeitada",
          aprovado_por: user.id,
          aprovado_em: new Date().toISOString(),
          observacoes: rejectObs,
        } as any)
        .eq("tarefa_id", tarefaId)
        .eq("status", "pendente");

      await supabase
        .from("projeto_tarefas")
        .update({ validacao_status: "rejeitada" } as any)
        .eq("id", tarefaId);

      toast.success("Validação rejeitada.");
      onStatusChange();
      setShowReject(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-medium text-amber-400">Aguardando Validação Final</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Os documentos do Cofre estão aguardando aprovação para serem visíveis na Fábrica.
      </p>
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs"
          onClick={handleAprovar}
          disabled={submitting}
        >
          <ShieldCheck className="h-3.5 w-3.5" /> Aprovar
        </Button>
        {!showReject ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs text-destructive border-destructive/30"
            onClick={() => setShowReject(true)}
            disabled={submitting}
          >
            <ShieldX className="h-3.5 w-3.5" /> Rejeitar
          </Button>
        ) : (
          <div className="flex-1 flex items-center gap-2">
            <Textarea
              value={rejectObs}
              onChange={e => setRejectObs(e.target.value)}
              placeholder="Motivo da rejeição (obrigatório)..."
              className="min-h-[32px] h-8 text-xs flex-1"
            />
            <Button
              size="sm"
              variant="destructive"
              className="text-xs"
              onClick={handleRejeitar}
              disabled={submitting || !rejectObs.trim()}
            >
              Confirmar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
