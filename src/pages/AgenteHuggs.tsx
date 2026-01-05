import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HuggsChat } from '@/components/huggs/HuggsChat';
import { HuggsAgentConfig } from '@/components/huggs/HuggsAgentConfig';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Settings, 
  BarChart3, 
  Bot,
  Zap,
  FileText,
  History
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function AgenteHuggs() {
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalMessages: 0,
    avgResponseTime: 0,
    totalTokens: 0
  });
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // Check if admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userData.user.id)
        .single();
      
      setIsAdmin(roleData?.role === 'admin' || roleData?.role === 'supervisor');

      // Fetch user stats
      const { data: sessions } = await supabase
        .from('huggs_chat_sessions')
        .select('id, messages_count')
        .eq('user_id', userData.user.id);

      const { data: usage } = await supabase
        .from('huggs_usage_logs')
        .select('tokens_input, tokens_output, latency_ms')
        .eq('user_id', userData.user.id);

      if (sessions) {
        setStats(prev => ({
          ...prev,
          totalSessions: sessions.length,
          totalMessages: sessions.reduce((acc, s) => acc + (s.messages_count || 0), 0)
        }));
      }

      if (usage && usage.length > 0) {
        const avgLatency = usage.reduce((acc, u) => acc + (u.latency_ms || 0), 0) / usage.length;
        const totalTokens = usage.reduce((acc, u) => acc + (u.tokens_input || 0) + (u.tokens_output || 0), 0);
        
        setStats(prev => ({
          ...prev,
          avgResponseTime: Math.round(avgLatency / 1000 * 10) / 10,
          totalTokens
        }));
      }
    };

    fetchStats();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
              <Bot className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                Agente Huggs
                <Badge variant="secondary" className="font-normal">
                  <Zap className="h-3 w-3 mr-1" />
                  n8n Connected
                </Badge>
              </h1>
              <p className="text-muted-foreground">
                Assistente inteligente de análise de dados empresariais
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Conversas</p>
                  <p className="text-2xl font-bold">{stats.totalSessions}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Mensagens</p>
                  <p className="text-2xl font-bold">{stats.totalMessages}</p>
                </div>
                <History className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tempo Médio</p>
                  <p className="text-2xl font-bold">{stats.avgResponseTime}s</p>
                </div>
                <Zap className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tokens Usados</p>
                  <p className="text-2xl font-bold">{(stats.totalTokens / 1000).toFixed(1)}k</p>
                </div>
                <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="chat" className="space-y-4">
          <TabsList>
            <TabsTrigger value="chat">
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="reports">
              <FileText className="h-4 w-4 mr-2" />
              Relatórios
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="config">
                <Settings className="h-4 w-4 mr-2" />
                Configurações
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="chat">
            <HuggsChat className="min-h-[600px]" />
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Relatórios Gerados</CardTitle>
                <CardDescription>
                  Relatórios e análises gerados pelo agente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum relatório gerado ainda.</p>
                  <p className="text-sm">
                    Peça ao agente para gerar um relatório no chat.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="config">
              <HuggsAgentConfig />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
