import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { 
  CheckCircle, XCircle, Clock, MessageSquare, 
  FileText, User, Calendar, AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Approval {
  id: string;
  status: string;
  comentario: string | null;
  data_solicitacao: string;
  data_resposta: string | null;
  versao: number;
  tarefa: {
    id: string;
    titulo: string;
    tipo: string;
    descricao: string | null;
  } | null;
  etapa: {
    nome: string;
    cor: string;
  } | null;
  aprovador: {
    nome: string;
  } | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pendente: { label: 'Pendente', color: 'bg-amber-500', icon: Clock },
  aprovado: { label: 'Aprovado', color: 'bg-green-500', icon: CheckCircle },
  rejeitado: { label: 'Rejeitado', color: 'bg-red-500', icon: XCircle },
  revisao: { label: 'Em Revisão', color: 'bg-blue-500', icon: MessageSquare },
};

export function ApprovalsList() {
  const queryClient = useQueryClient();
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [comment, setComment] = useState("");
  const [actionType, setActionType] = useState<'aprovar' | 'rejeitar' | null>(null);

  const { data: approvals, isLoading } = useQuery({
    queryKey: ['marketing-approvals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_aprovacoes')
        .select(`
          *,
          tarefa:lancamentos_tarefas_marketing(id, titulo, tipo, descricao),
          etapa:marketing_workflow_etapas(nome, cor),
          aprovador:profiles!marketing_aprovacoes_aprovador_id_fkey(nome)
        `)
        .order('data_solicitacao', { ascending: false });

      if (error) throw error;
      return data as unknown as Approval[];
    }
  });

  const updateApproval = useMutation({
    mutationFn: async ({ id, status, comentario }: { id: string; status: string; comentario?: string }) => {
      const { error } = await supabase
        .from('marketing_aprovacoes')
        .update({ 
          status, 
          comentario: comentario || null,
          data_resposta: new Date().toISOString()
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-approvals'] });
      toast.success('Aprovação atualizada!');
      setSelectedApproval(null);
      setComment("");
      setActionType(null);
    },
    onError: () => {
      toast.error('Erro ao atualizar aprovação');
    }
  });

  const handleAction = (approval: Approval, action: 'aprovar' | 'rejeitar') => {
    setSelectedApproval(approval);
    setActionType(action);
    setComment("");
  };

  const confirmAction = () => {
    if (!selectedApproval || !actionType) return;
    
    updateApproval.mutate({
      id: selectedApproval.id,
      status: actionType === 'aprovar' ? 'aprovado' : 'rejeitado',
      comentario: comment,
    });
  };

  const pendingCount = approvals?.filter(a => a.status === 'pendente').length || 0;
  const approvedCount = approvals?.filter(a => a.status === 'aprovado').length || 0;
  const rejectedCount = approvals?.filter(a => a.status === 'rejeitado').length || 0;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-amber-500">{pendingCount}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Aprovadas</p>
                <p className="text-2xl font-bold text-green-500">{approvedCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejeitadas</p>
                <p className="text-2xl font-bold text-red-500">{rejectedCount}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Approvals List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Aprovações
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingCount} pendentes
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : !approvals?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma aprovação pendente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {approvals.map(approval => {
                const status = statusConfig[approval.status] || statusConfig.pendente;
                const StatusIcon = status.icon;
                
                return (
                  <div 
                    key={approval.id}
                    className={cn(
                      "p-4 rounded-lg border transition-all",
                      approval.status === 'pendente' && "border-amber-500/30 bg-amber-500/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className={cn("text-[10px]", status.color)}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {status.label}
                          </Badge>
                          {approval.etapa && (
                            <Badge 
                              variant="outline" 
                              className="text-[10px]"
                              style={{ borderColor: approval.etapa.cor, color: approval.etapa.cor }}
                            >
                              {approval.etapa.nome}
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            v{approval.versao}
                          </span>
                        </div>

                        <h4 className="font-medium">
                          {approval.tarefa?.titulo || 'Tarefa não encontrada'}
                        </h4>

                        {approval.tarefa?.descricao && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {approval.tarefa.descricao}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDistanceToNow(new Date(approval.data_solicitacao), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </div>
                          {approval.aprovador && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {approval.aprovador.nome}
                            </div>
                          )}
                        </div>

                        {approval.comentario && (
                          <div className="flex items-start gap-2 p-2 bg-muted/50 rounded text-sm">
                            <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            <span>{approval.comentario}</span>
                          </div>
                        )}
                      </div>

                      {approval.status === 'pendente' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => handleAction(approval, 'rejeitar')}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-500 hover:bg-green-600"
                            onClick={() => handleAction(approval, 'aprovar')}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={!!selectedApproval} onOpenChange={() => setSelectedApproval(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'aprovar' ? 'Aprovar Tarefa' : 'Rejeitar Tarefa'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="font-medium">{selectedApproval?.tarefa?.titulo}</p>
              {selectedApproval?.tarefa?.descricao && (
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedApproval.tarefa.descricao}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Comentário {actionType === 'rejeitar' && <span className="text-red-500">*</span>}
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={actionType === 'aprovar' ? 'Comentário opcional...' : 'Motivo da rejeição...'}
                rows={3}
              />
            </div>

            {actionType === 'rejeitar' && !comment && (
              <div className="flex items-center gap-2 text-amber-500 text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>Informe o motivo da rejeição</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedApproval(null)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmAction}
              disabled={actionType === 'rejeitar' && !comment}
              className={actionType === 'aprovar' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}
            >
              {actionType === 'aprovar' ? 'Confirmar Aprovação' : 'Confirmar Rejeição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
