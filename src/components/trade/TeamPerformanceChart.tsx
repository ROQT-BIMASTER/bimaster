import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";

interface TeamMemberStats {
  id: string;
  nome: string;
  role: string;
  total_visitas: number;
  concluidas: number;
  em_andamento: number;
  agendadas: number;
  canceladas: number;
  taxa_conclusao: number;
}

export const TeamPerformanceChart = () => {
  const [stats, setStats] = useState<TeamMemberStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeamPerformance();
  }, []);

  const fetchTeamPerformance = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar role do usuário
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      let teamMemberIds: string[] = [];

      // Se for admin, busca todos os usuários
      if (roleData?.role === 'admin') {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("aprovado", true);
        
        teamMemberIds = profiles?.map(p => p.id) || [];
      } else if (roleData?.role === 'supervisor') {
        // Se for supervisor, busca subordinados
        const { data: subordinados } = await supabase
          .rpc('get_subordinados', { _user_id: user.id });

        if (subordinados) {
          teamMemberIds = subordinados.map((s: any) => s.subordinado_id);
        }
        // Adicionar o próprio supervisor
        teamMemberIds.push(user.id);
      }

      if (teamMemberIds.length === 0) {
        setStats([]);
        setLoading(false);
        return;
      }

      // Buscar visitas de cada membro
      const { data: visits, error: visitsError } = await supabase
        .from("visits")
        .select("user_id, status")
        .in("user_id", teamMemberIds);

      if (visitsError) throw visitsError;

      // Buscar informações dos usuários
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          id,
          nome,
          user_roles (role)
        `)
        .in("id", teamMemberIds);

      if (profilesError) throw profilesError;

      // Calcular estatísticas por usuário
      const memberStats: TeamMemberStats[] = profiles?.map(profile => {
        const userVisits = visits?.filter(v => v.user_id === profile.id) || [];
        const concluidas = userVisits.filter(v => v.status === 'completed').length;
        const total = userVisits.length;
        const em_andamento = userVisits.filter(v => v.status === 'in_progress').length;
        const agendadas = userVisits.filter(v => v.status === 'scheduled').length;
        const canceladas = userVisits.filter(v => v.status === 'cancelled').length;

        return {
          id: profile.id,
          nome: profile.nome,
          role: (profile.user_roles as any)?.[0]?.role || 'vendedor',
          total_visitas: total,
          concluidas,
          em_andamento,
          agendadas,
          canceladas,
          taxa_conclusao: total > 0 ? Math.round((concluidas / total) * 100) : 0
        };
      }) || [];

      // Ordenar por taxa de conclusão (decrescente)
      memberStats.sort((a, b) => b.taxa_conclusao - a.taxa_conclusao);

      setStats(memberStats);
    } catch (error) {
      console.error("Erro ao buscar performance:", error);
      toast.error("Erro ao carregar dados de performance");
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'hsl(var(--chart-1))';
      case 'supervisor':
        return 'hsl(var(--chart-2))';
      case 'vendedor':
        return 'hsl(var(--chart-3))';
      case 'promotor':
        return 'hsl(var(--chart-4))';
      default:
        return 'hsl(var(--chart-5))';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Carregando dados de performance...
        </CardContent>
      </Card>
    );
  }

  if (stats.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance da Equipe
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground">
          Nenhum dado de performance disponível
        </CardContent>
      </Card>
    );
  }

  // Dados para o gráfico de barras (visitas por status)
  const chartData = stats.map(member => ({
    nome: member.nome.split(' ')[0], // Apenas primeiro nome
    Concluídas: member.concluidas,
    'Em Andamento': member.em_andamento,
    Agendadas: member.agendadas,
    total: member.total_visitas,
    taxa: member.taxa_conclusao
  }));

  return (
    <div className="space-y-4">
      {/* Gráfico de Barras - Visitas por Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Visitas por Membro da Equipe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="nome" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend 
                wrapperStyle={{ 
                  paddingTop: '20px',
                  color: 'hsl(var(--foreground))'
                }}
              />
              <Bar dataKey="Concluídas" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Em Andamento" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Agendadas" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cards de Performance Individual */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((member) => (
          <Card key={member.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="truncate">{member.nome}</span>
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: getRoleColor(member.role) }}
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total de Visitas</span>
                <span className="font-semibold">{member.total_visitas}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Concluídas</span>
                <span className="font-semibold text-green-600">{member.concluidas}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Em Andamento</span>
                <span className="font-semibold text-yellow-600">{member.em_andamento}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Agendadas</span>
                <span className="font-semibold text-blue-600">{member.agendadas}</span>
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Taxa de Conclusão</span>
                  <span className="text-lg font-bold">{member.taxa_conclusao}%</span>
                </div>
                <div className="mt-2 w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${member.taxa_conclusao}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
