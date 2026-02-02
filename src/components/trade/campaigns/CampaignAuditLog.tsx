import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, User, Calendar, ArrowRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CampaignAuditLogProps {
  campaignId: string;
}

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  user_id: string;
  user_name: string | null;
  created_at: string;
}

export function CampaignAuditLog({ campaignId }: CampaignAuditLogProps) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["campaign-audit-log", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_campaign_audit_log")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AuditEntry[];
    },
  });

  const getActionLabel = (action: string) => {
    const labels: Record<string, { label: string; color: string }> = {
      status_changed: { label: "Status Alterado", color: "bg-blue-100 text-blue-800" },
      validation_changed: { label: "Validação Alterada", color: "bg-purple-100 text-purple-800" },
      budget_changed: { label: "Orçamento Alterado", color: "bg-orange-100 text-orange-800" },
      created: { label: "Criado", color: "bg-green-100 text-green-800" },
      updated: { label: "Atualizado", color: "bg-yellow-100 text-yellow-800" },
      deleted: { label: "Removido", color: "bg-red-100 text-red-800" },
      delete_campaign: { label: "Campanha Excluída", color: "bg-red-100 text-red-800" },
      delete_lancamento: { label: "Lançamento Excluído", color: "bg-red-100 text-red-800" },
      update_campaign: { label: "Campanha Editada", color: "bg-yellow-100 text-yellow-800" },
      update_lancamento: { label: "Lançamento Editado", color: "bg-yellow-100 text-yellow-800" },
      create_lancamento: { label: "Lançamento Criado", color: "bg-green-100 text-green-800" },
    };
    return labels[action] || { label: action, color: "bg-gray-100 text-gray-800" };
  };

  const getFieldLabel = (field: string | null) => {
    if (!field) return null;
    const labels: Record<string, string> = {
      status: "Status",
      validation_status: "Status de Validação",
      verba_orcada: "Verba Orçada",
      estimated_cost: "Custo Estimado",
      actual_cost: "Custo Real",
      sell_out_atual: "Sell Out Atual",
      sell_in_atual: "Sell In Atual",
    };
    return labels[field] || field;
  };

  const formatValue = (field: string | null, value: string | null) => {
    if (!value) return "-";
    
    // Formatar valores monetários
    if (field?.includes("cost") || field?.includes("verba") || field?.includes("sell")) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numValue);
      }
    }
    
    // Formatar status
    const statusLabels: Record<string, string> = {
      draft: "Rascunho",
      pending_approval: "Pendente Aprovação",
      approved: "Aprovado",
      active: "Em Execução",
      paused: "Pausado",
      completed: "Encerrado",
      cancelled: "Cancelado",
      pending: "Pendente",
      rejected: "Rejeitado",
    };
    
    return statusLabels[value] || value;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico de Alterações
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma alteração registrada</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {logs.map((log) => {
                const actionInfo = getActionLabel(log.action);
                return (
                  <div
                    key={log.id}
                    className="flex gap-4 p-4 border rounded-lg bg-muted/30"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <History className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={actionInfo.color}>{actionInfo.label}</Badge>
                        {log.field_changed && (
                          <span className="text-sm text-muted-foreground">
                            Campo: <strong>{getFieldLabel(log.field_changed)}</strong>
                          </span>
                        )}
                      </div>
                      
                      {log.old_value && log.new_value && (
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <span className="px-2 py-1 bg-red-50 text-red-700 rounded">
                            {formatValue(log.field_changed, log.old_value)}
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <span className="px-2 py-1 bg-green-50 text-green-700 rounded">
                            {formatValue(log.field_changed, log.new_value)}
                          </span>
                        </div>
                      )}
                      
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{log.user_name || "Sistema"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
