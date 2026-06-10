import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ExternalLink, Check, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { nowSaoPauloISO } from "@/lib/utils/parseLocalDate";

interface RoleChangeNotif {
  id: string;
  title: string;
  message: string;
  action_url: string | null;
  created_at: string;
  read: boolean;
}

/**
 * Banner compacto exibido no topo da Central de Trabalho quando o usuário
 * tem mudanças de papel em tarefas (responsável ↔ colaborador) recebidas
 * nas últimas 24h e ainda não lidas. Clica → popover com lista e ações.
 */
export function PapelChangeBanner() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: notifs = [] } = useQuery({
    queryKey: ["central-role-change-notifs", user?.id],
    queryFn: async (): Promise<RoleChangeNotif[]> => {
      if (!user?.id) return [];
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, message, action_url, created_at, read")
        .eq("user_id", user.id)
        .eq("type", "task_role_change")
        .eq("read", false)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as RoleChangeNotif[];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true, read_at: nowSaoPauloISO() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["central-role-change-notifs", user?.id] });
    },
  });

  if (notifs.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-3 rounded-lg border border-info/30 bg-info/5 px-4 py-2.5 text-left hover:bg-info/10 transition-colors"
        >
          <RefreshCw className="h-4 w-4 text-info shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {notifs.length} mudança{notifs.length > 1 ? "s" : ""} de papel recente{notifs.length > 1 ? "s" : ""} em tarefas
            </p>
            <p className="text-xs text-muted-foreground truncate">
              Clique para ver os detalhes e marcar como lido.
            </p>
          </div>
          <Badge variant="outline" className="border-info/40 text-info">
            {notifs.length}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
          <p className="text-sm font-semibold">Mudanças de papel</p>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1"
            onClick={() => markRead.mutate(notifs.map((n) => n.id))}
            disabled={markRead.isPending}
          >
            <CheckCheck className="h-3.5 w-3.5" /> Marcar todas
          </Button>
        </div>
        <div className="max-h-[360px] overflow-y-auto divide-y divide-border/40">
          {notifs.map((n) => (
            <div key={n.id} className="px-3 py-2.5 hover:bg-muted/30 transition-colors">
              <p className="text-sm text-foreground leading-snug">{n.message}</p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(n.created_at), { locale: ptBR, addSuffix: true })}
                </span>
                <div className="flex items-center gap-1">
                  {n.action_url && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[11px] gap-1"
                      onClick={() => {
                        markRead.mutate([n.id]);
                        navigate(n.action_url!);
                        setOpen(false);
                      }}
                    >
                      <ExternalLink className="h-3 w-3" /> Ir para tarefa
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px] gap-1"
                    onClick={() => markRead.mutate([n.id])}
                    disabled={markRead.isPending}
                  >
                    <Check className="h-3 w-3" /> Lido
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
