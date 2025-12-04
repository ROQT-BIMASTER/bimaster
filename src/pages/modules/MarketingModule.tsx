import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart3, 
  MessageSquare, 
  Calendar, 
  Image, 
  ArrowRight,
  LineChart,
  Brain,
  Users,
  Activity,
  Sparkles,
  Eye,
  Send
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MarketingModule = () => {
  const { data: stats } = useQuery({
    queryKey: ['marketing-module-stats'],
    queryFn: async () => {
      const [postsRes, conversasRes] = await Promise.all([
        supabase.from("social_media_posts").select("*", { count: "exact", head: true }),
        supabase.from("whatsapp_conversations").select("*", { count: "exact", head: true })
      ]);

      return {
        totalPosts: postsRes.count || 0,
        conversasWhatsApp: conversasRes.count || 0,
        campanhasAtivas: 12, // Simulado
        alcanceTotal: 15420 // Simulado
      };
    }
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Marketing Digital</h1>
          <p className="text-muted-foreground mt-1">
            Gestão completa de campanhas, redes sociais e comunicação
          </p>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Posts Agendados</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalPosts || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Campanhas Ativas</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats?.campanhasAtivas || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Conversas WhatsApp</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.conversasWhatsApp || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Alcance Total</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {(stats?.alcanceTotal || 0).toLocaleString('pt-BR')}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Redes Sociais e Conteúdo */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Redes Sociais e Conteúdo</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Link to="/dashboard/marketing/social">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Dashboards Social</CardTitle>
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Métricas e relatórios de redes sociais
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Visualizar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Card className="opacity-50 cursor-not-allowed h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Calendário Editorial</CardTitle>
                <Calendar className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Planejamento de conteúdo
                </p>
                <div className="mt-2 flex items-center text-xs text-muted-foreground">
                  Em breve
                </div>
              </CardContent>
            </Card>

            <Card className="opacity-50 cursor-not-allowed h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gerador de Imagens</CardTitle>
                <Image className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Criação de imagens com IA
                </p>
                <div className="mt-2 flex items-center text-xs text-muted-foreground">
                  Em breve
                </div>
              </CardContent>
            </Card>

            <Card className="opacity-50 cursor-not-allowed h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monitoramento</CardTitle>
                <Users className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Monitoramento de menções
                </p>
                <div className="mt-2 flex items-center text-xs text-muted-foreground">
                  Em breve
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* WhatsApp e Comunicação */}
        <div>
          <h2 className="text-xl font-semibold mb-4">WhatsApp e Comunicação</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Link to="/dashboard/marketing/whatsapp">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">WhatsApp Business</CardTitle>
                  <MessageSquare className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Gestão de conversas e atendimento
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Acessar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Card className="opacity-50 cursor-not-allowed h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Agente IA</CardTitle>
                <Brain className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Agente conversacional inteligente
                </p>
                <div className="mt-2 flex items-center text-xs text-muted-foreground">
                  Em breve
                </div>
              </CardContent>
            </Card>

            <Card className="opacity-50 cursor-not-allowed h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Análise de Sentimento</CardTitle>
                <Sparkles className="h-4 w-4 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Análise de sentimento com IA
                </p>
                <div className="mt-2 flex items-center text-xs text-muted-foreground">
                  Em breve
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Analytics e BI */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Analytics e Business Intelligence</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="opacity-50 cursor-not-allowed h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">DashCortex Reports</CardTitle>
                <LineChart className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Relatórios avançados DashCortex
                </p>
                <div className="mt-2 flex items-center text-xs text-muted-foreground">
                  Em breve
                </div>
              </CardContent>
            </Card>

            <Card className="opacity-50 cursor-not-allowed h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Power BI</CardTitle>
                <BarChart3 className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Dashboards Power BI integrados
                </p>
                <div className="mt-2 flex items-center text-xs text-muted-foreground">
                  Em breve
                </div>
              </CardContent>
            </Card>

            <Card className="opacity-50 cursor-not-allowed h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Looker Studio</CardTitle>
                <Activity className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Relatórios Looker Studio
                </p>
                <div className="mt-2 flex items-center text-xs text-muted-foreground">
                  Em breve
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default MarketingModule;