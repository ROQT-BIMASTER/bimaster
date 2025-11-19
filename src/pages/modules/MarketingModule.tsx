import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Users, TrendingUp, Activity, Eye } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const MarketingModule = () => {
  const [stats, setStats] = useState({
    totalCampanhas: 0,
    campanhasAtivas: 0,
    totalAlcance: 0,
    taxaEngajamento: 0,
  });
  const [engagementData, setEngagementData] = useState<any[]>([]);
  const [socialData, setSocialData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Estatísticas simuladas (enquanto não há integração completa)
      setStats({
        totalCampanhas: 45,
        campanhasAtivas: 12,
        totalAlcance: 15420,
        taxaEngajamento: 7.8,
      });

      // Dados de engajamento por plataforma (simulado)
      const platformEngagement = [
        { name: 'Instagram', value: 4850 },
        { name: 'Facebook', value: 3220 },
        { name: 'LinkedIn', value: 2150 },
        { name: 'Twitter', value: 1680 },
      ];

      setEngagementData(platformEngagement);

      // Dados de crescimento nos últimos 7 dias (simulado)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return {
          name: date.toLocaleDateString('pt-BR', { weekday: 'short' }),
          alcance: Math.floor(Math.random() * 1000) + 500,
          engajamento: Math.floor(Math.random() * 200) + 100,
        };
      });

      setSocialData(last7Days);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Módulo de Marketing</h1>
            <p className="text-muted-foreground">
              Gestão completa de campanhas e redes sociais
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Campanhas</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCampanhas}</div>
              <p className="text-xs text-muted-foreground">
                Publicações criadas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Campanhas Ativas</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.campanhasAtivas}</div>
              <p className="text-xs text-muted-foreground">
                Agendadas e ativas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alcance Total</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalAlcance.toLocaleString('pt-BR')}
              </div>
              <p className="text-xs text-muted-foreground">
                Pessoas alcançadas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Engajamento</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.taxaEngajamento}%</div>
              <p className="text-xs text-muted-foreground">
                Média de interação
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Engajamento por Plataforma</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={engagementData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Crescimento - Últimos 7 Dias</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={socialData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="alcance" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line type="monotone" dataKey="engajamento" stroke="hsl(var(--secondary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Acesso Rápido</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link to="/dashboard/marketing/social">
              <Button variant="outline" className="w-full justify-start">
                <BarChart3 className="mr-2 h-4 w-4" />
                Dashboards & IA
              </Button>
            </Link>
            <Link to="/dashboard/marketing/whatsapp">
              <Button variant="outline" className="w-full justify-start">
                <Activity className="mr-2 h-4 w-4" />
                WhatsApp
              </Button>
            </Link>
            <Button variant="outline" className="w-full justify-start" disabled>
              <Users className="mr-2 h-4 w-4" />
              Redes Sociais
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled>
              <TrendingUp className="mr-2 h-4 w-4" />
              Relatórios
            </Button>
          </CardContent>
        </Card>

        {/* Informações Adicionais */}
        <Card>
          <CardHeader>
            <CardTitle>Recursos do Módulo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="font-semibold mb-2">Relatórios Integrados</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Instagram Analytics</li>
                  <li>• DashCortex Reports</li>
                  <li>• Power BI Dashboards</li>
                  <li>• Análise de Sentimentos</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Monitoramento</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• WhatsApp Business</li>
                  <li>• Conversas em tempo real</li>
                  <li>• Agente IA conversacional</li>
                  <li>• Métricas de atendimento</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default MarketingModule;
