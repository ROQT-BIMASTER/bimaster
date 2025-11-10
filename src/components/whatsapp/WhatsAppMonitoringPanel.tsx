import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, MessageCircle, Clock, CheckCircle2, XCircle, TrendingUp, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { format, subDays, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MonitoringPanelProps {
  userId?: string;
  dateRange?: { start: Date; end: Date };
}

interface KPIs {
  totalConversations: number;
  activeConversations: number;
  completedConversations: number;
  cancelledConversations: number;
  totalMessages: number;
  userMessages: number;
  botMessages: number;
  avgResponseTime: number;
  responseRate: number;
  todayConversations: number;
  weekConversations: number;
  monthConversations: number;
}

interface RecentConversation {
  id: string;
  phone_number: string;
  status: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message: string;
  user_name: string;
}

export function WhatsAppMonitoringPanel({ userId, dateRange }: MonitoringPanelProps) {
  const [kpis, setKpis] = useState<KPIs>({
    totalConversations: 0,
    activeConversations: 0,
    completedConversations: 0,
    cancelledConversations: 0,
    totalMessages: 0,
    userMessages: 0,
    botMessages: 0,
    avgResponseTime: 0,
    responseRate: 0,
    todayConversations: 0,
    weekConversations: 0,
    monthConversations: 0,
  });
  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchKPIs();
    fetchRecentConversations();
    
    // Realtime subscription
    const channel = supabase
      .channel('whatsapp-monitoring')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_conversations'
        },
        () => {
          fetchKPIs();
          fetchRecentConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages'
        },
        () => {
          fetchKPIs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, dateRange]);

  async function fetchKPIs() {
    try {
      const now = new Date();
      const today = startOfDay(now);
      const weekAgo = subDays(today, 7);
      const monthAgo = subDays(today, 30);

      let conversationsQuery = supabase
        .from("whatsapp_conversations")
        .select("id, status, created_at, updated_at");

      if (userId) {
        conversationsQuery = conversationsQuery.eq("user_id", userId);
      }

      if (dateRange) {
        conversationsQuery = conversationsQuery
          .gte("created_at", dateRange.start.toISOString())
          .lte("created_at", dateRange.end.toISOString());
      }

      const { data: conversations, error: convError } = await conversationsQuery;

      if (convError) throw convError;

      // Calcular KPIs de conversas
      const total = conversations?.length || 0;
      const active = conversations?.filter(c => c.status === "active").length || 0;
      const completed = conversations?.filter(c => c.status === "completed").length || 0;
      const cancelled = conversations?.filter(c => c.status === "cancelled").length || 0;
      
      const todayCount = conversations?.filter(c => 
        isAfter(new Date(c.created_at), today)
      ).length || 0;
      
      const weekCount = conversations?.filter(c => 
        isAfter(new Date(c.created_at), weekAgo)
      ).length || 0;
      
      const monthCount = conversations?.filter(c => 
        isAfter(new Date(c.created_at), monthAgo)
      ).length || 0;

      // Buscar mensagens
      let messagesQuery = supabase
        .from("whatsapp_messages")
        .select("sender, timestamp, conversation_id");

      if (userId) {
        const conversationIds = conversations?.map(c => c.id) || [];
        if (conversationIds.length > 0) {
          messagesQuery = messagesQuery.in("conversation_id", conversationIds);
        }
      }

      if (dateRange) {
        messagesQuery = messagesQuery
          .gte("timestamp", dateRange.start.toISOString())
          .lte("timestamp", dateRange.end.toISOString());
      }

      const { data: messages } = await messagesQuery;

      const totalMsgs = messages?.length || 0;
      const userMsgs = messages?.filter(m => m.sender === "user").length || 0;
      const botMsgs = messages?.filter(m => m.sender === "bot").length || 0;

      // Calcular taxa de resposta (conversas que receberam resposta do bot)
      const conversationsWithBotResponse = new Set(
        messages?.filter(m => m.sender === "bot").map(m => m.conversation_id)
      );
      const responseRate = total > 0 
        ? Math.round((conversationsWithBotResponse.size / total) * 100) 
        : 0;

      // Calcular tempo médio de resposta (simplificado)
      let avgResponseTime = 0;
      if (conversations && messages) {
        let totalResponseTime = 0;
        let responseCount = 0;

        conversations.forEach(conv => {
          const convMessages = messages
            .filter(m => m.conversation_id === conv.id)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

          for (let i = 0; i < convMessages.length - 1; i++) {
            if (convMessages[i].sender === "user" && convMessages[i + 1].sender === "bot") {
              const time1 = new Date(convMessages[i].timestamp).getTime();
              const time2 = new Date(convMessages[i + 1].timestamp).getTime();
              totalResponseTime += (time2 - time1);
              responseCount++;
            }
          }
        });

        if (responseCount > 0) {
          avgResponseTime = Math.round((totalResponseTime / responseCount) / 1000); // em segundos
        }
      }

      setKpis({
        totalConversations: total,
        activeConversations: active,
        completedConversations: completed,
        cancelledConversations: cancelled,
        totalMessages: totalMsgs,
        userMessages: userMsgs,
        botMessages: botMsgs,
        avgResponseTime,
        responseRate,
        todayConversations: todayCount,
        weekConversations: weekCount,
        monthConversations: monthCount,
      });
    } catch (error: any) {
      console.error("Erro ao carregar KPIs:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as métricas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchRecentConversations() {
    try {
      let query = supabase
        .from("whatsapp_conversations")
        .select(`
          id,
          phone_number,
          status,
          created_at,
          updated_at,
          user_id,
          profiles!whatsapp_conversations_user_id_fkey(nome)
        `)
        .order("updated_at", { ascending: false })
        .limit(10);

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data: conversations, error } = await query;

      if (error) throw error;

      // Buscar contagem de mensagens para cada conversa
      const conversationsWithCounts = await Promise.all(
        (conversations || []).map(async (conv) => {
          const { data: messages } = await supabase
            .from("whatsapp_messages")
            .select("content, timestamp")
            .eq("conversation_id", conv.id)
            .order("timestamp", { ascending: false })
            .limit(1);

          return {
            id: conv.id,
            phone_number: conv.phone_number,
            status: conv.status,
            created_at: conv.created_at,
            updated_at: conv.updated_at,
            message_count: messages?.length || 0,
            last_message: messages?.[0]?.content || "Sem mensagens",
            user_name: (conv as any).profiles?.nome || "Usuário",
          };
        })
      );

      setRecentConversations(conversationsWithCounts);
    } catch (error: any) {
      console.error("Erro ao carregar conversas recentes:", error);
    }
  }

  function formatResponseTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
    return `${Math.round(seconds / 3600)}h`;
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
      active: { variant: "default", icon: MessageCircle },
      completed: { variant: "secondary", icon: CheckCircle2 },
      cancelled: { variant: "destructive", icon: XCircle },
    };

    const config = variants[status] || { variant: "outline", icon: MessageCircle };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status === "active" ? "Ativa" : status === "completed" ? "Completa" : "Cancelada"}
      </Badge>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header KPIs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Painel de Acompanhamento WhatsApp
          </CardTitle>
          <CardDescription>
            Métricas em tempo real das conversas e mensagens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Taxa de Resposta */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Taxa de Resposta</span>
              <span className="text-2xl font-bold">{kpis.responseRate}%</span>
            </div>
            <Progress value={kpis.responseRate} className="h-2" />
          </div>

          {/* Métricas Principais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Hoje</p>
              <p className="text-2xl font-bold">{kpis.todayConversations}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Esta Semana</p>
              <p className="text-2xl font-bold">{kpis.weekConversations}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Ativas</p>
              <p className="text-2xl font-bold text-blue-600">{kpis.activeConversations}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Completas</p>
              <p className="text-2xl font-bold text-green-600">{kpis.completedConversations}</p>
            </div>
          </div>

          {/* Estatísticas Detalhadas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Conversas</p>
                <p className="text-xl font-semibold">{kpis.totalConversations}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <MessageCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Mensagens Totais</p>
                <p className="text-xl font-semibold">{kpis.totalMessages}</p>
                <p className="text-xs text-muted-foreground">
                  {kpis.userMessages} usuários / {kpis.botMessages} bot
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tempo Médio</p>
                <p className="text-xl font-semibold">{formatResponseTime(kpis.avgResponseTime)}</p>
                <p className="text-xs text-muted-foreground">de resposta</p>
              </div>
            </div>
          </div>

          {/* Badges de Status */}
          <div className="flex flex-wrap gap-2 pt-4 border-t">
            <Badge variant="outline" className="flex items-center gap-2">
              <MessageCircle className="h-3 w-3" />
              {kpis.activeConversations} Ativas
            </Badge>
            <Badge variant="outline" className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              {kpis.completedConversations} Completas
            </Badge>
            <Badge variant="outline" className="flex items-center gap-2">
              <XCircle className="h-3 w-3 text-red-600" />
              {kpis.cancelledConversations} Canceladas
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Conversas Recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Conversas Recentes
          </CardTitle>
          <CardDescription>
            Últimas 10 conversas atualizadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentConversations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma conversa encontrada
            </p>
          ) : (
            <div className="space-y-3">
              {recentConversations.map((conv) => (
                <div
                  key={conv.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium truncate">{conv.phone_number}</p>
                      {getStatusBadge(conv.status)}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.last_message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {conv.user_name} • {format(new Date(conv.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
