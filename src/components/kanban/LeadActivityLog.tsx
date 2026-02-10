import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowRight, CheckCircle2, MessageSquare, Edit, UserPlus, Zap } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LogEntry {
  id: string;
  acao: string;
  detalhes: string | null;
  created_at: string;
  user_id: string | null;
}

interface LeadActivityLogProps {
  prospectId: string;
}

const iconMap: Record<string, any> = {
  moveu: ArrowRight,
  concluiu: CheckCircle2,
  mensagem: MessageSquare,
  editou: Edit,
  atribuiu: UserPlus,
};

function getIcon(acao: string) {
  const key = Object.keys(iconMap).find(k => acao.toLowerCase().includes(k));
  return key ? iconMap[key] : Zap;
}

export const LeadActivityLog = ({ prospectId }: LeadActivityLogProps) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel(`activity-logs-${prospectId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "lead_activity_logs",
        filter: `prospect_id=eq.${prospectId}`,
      }, () => fetchLogs())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [prospectId]);

  const fetchLogs = async () => {
    const { data } = await supabase
      .from("lead_activity_logs")
      .select("*")
      .eq("prospect_id", prospectId)
      .order("created_at", { ascending: false })
      .limit(50);
    setLogs(data || []);
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-1">
      {logs.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum registro de atividade ainda.
        </p>
      )}

      <div className="relative">
        {/* Timeline line */}
        {logs.length > 0 && (
          <div className="absolute left-[15px] top-3 bottom-3 w-px bg-border" />
        )}

        <div className="space-y-4">
          {logs.map((log) => {
            const Icon = getIcon(log.acao);
            return (
              <div key={log.id} className="flex items-start gap-4 relative">
                <div className="z-10 h-8 w-8 rounded-full bg-card border flex items-center justify-center shrink-0">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="text-sm font-medium">{log.acao}</p>
                  {log.detalhes && (
                    <p className="text-xs text-muted-foreground mt-0.5">{log.detalhes}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
