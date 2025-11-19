import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, TrendingUp, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface TeamMember {
  user_id: string;
  user_name: string;
  monthly_points: number;
  visits_this_month: number;
  current_level: string;
  role: string;
}

export const TeamComparisonCard = () => {
  const [teamData, setTeamData] = useState<TeamMember[]>([]);
  const [currentUser, setCurrentUser] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeamData();
  }, []);

  const fetchTeamData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar dados da equipe da view
      const { data: teamMembers, error } = await supabase
        .from("team_performance_view")
        .select("*")
        .order("monthly_points", { ascending: false })
        .limit(10);

      if (error) throw error;

      setTeamData(teamMembers || []);
      
      // Encontrar usuário atual
      const current = teamMembers?.find(m => m.user_id === user.id);
      setCurrentUser(current || null);
    } catch (error) {
      console.error("Erro ao buscar dados da equipe:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Comparação com a Equipe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Carregando dados da equipe...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (teamData.length === 0) {
    return null;
  }

  const topPerformer = teamData[0];
  const teamAverage = teamData.length > 0
    ? Math.round(teamData.reduce((sum, m) => sum + (m.monthly_points || 0), 0) / teamData.length)
    : 0;

  const userVsAverage = currentUser
    ? ((currentUser.monthly_points || 0) / teamAverage) * 100 - 100
    : 0;

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500';
      case 'supervisor': return 'bg-blue-500';
      case 'vendedor': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'supervisor': return 'Supervisor';
      case 'vendedor': return 'Vendedor';
      default: return role;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Comparação com a Equipe
        </CardTitle>
        <CardDescription>
          Veja como você se compara com seus colegas este mês
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg bg-secondary/20">
            <p className="text-sm text-muted-foreground mb-1">Sua Pontuação</p>
            <p className="text-2xl font-bold text-primary">
              {currentUser?.monthly_points || 0}
            </p>
          </div>
          
          <div className="p-4 border rounded-lg bg-secondary/20">
            <p className="text-sm text-muted-foreground mb-1">Média da Equipe</p>
            <p className="text-2xl font-bold">{teamAverage}</p>
          </div>
          
          <div className="p-4 border rounded-lg bg-secondary/20">
            <p className="text-sm text-muted-foreground mb-1">Melhor Pontuação</p>
            <p className="text-2xl font-bold text-primary">
              {topPerformer?.monthly_points || 0}
            </p>
          </div>
        </div>

        {/* Performance vs Average */}
        {currentUser && (
          <div className="p-4 border rounded-lg bg-primary/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Seu desempenho vs média</span>
              <Badge variant={userVsAverage >= 0 ? "default" : "secondary"}>
                {userVsAverage >= 0 ? '+' : ''}{Math.round(userVsAverage)}%
              </Badge>
            </div>
            <Progress 
              value={Math.max(0, Math.min(100, ((currentUser.monthly_points || 0) / (topPerformer?.monthly_points || 1)) * 100))} 
              className="h-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {userVsAverage >= 0 
                ? `Você está acima da média! Continue assim! 🎉`
                : `Você pode melhorar! Faltam ${Math.abs(Math.round(userVsAverage))}% para a média.`
              }
            </p>
          </div>
        )}

        {/* Top 5 Team Members */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Target className="h-4 w-4" />
            Top 5 da Equipe Este Mês
          </h4>
          
          {teamData.slice(0, 5).map((member, index) => {
            const isCurrentUser = currentUser?.user_id === member.user_id;
            
            return (
              <div
                key={member.user_id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  isCurrentUser 
                    ? 'bg-primary/10 border-primary' 
                    : 'bg-secondary/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    index === 0 ? 'bg-yellow-500' :
                    index === 1 ? 'bg-gray-400' :
                    index === 2 ? 'bg-orange-500' :
                    'bg-muted'
                  }`}>
                    <span className="text-sm font-bold text-white">
                      {index + 1}
                    </span>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`font-semibold text-sm ${isCurrentUser ? 'text-primary' : ''}`}>
                        {member.user_name || 'Sem nome'}
                      </p>
                      {isCurrentUser && (
                        <Badge variant="default" className="text-xs h-5">
                          Você
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className={`text-xs h-5 ${getRoleColor(member.role)}`}>
                        {getRoleLabel(member.role)}
                      </Badge>
                      {member.current_level && (
                        <span className="text-xs text-muted-foreground">
                          {member.current_level}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="font-bold text-primary">{member.monthly_points || 0}</p>
                  <p className="text-xs text-muted-foreground">
                    {member.visits_this_month || 0} visitas
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Motivational Message */}
        {currentUser && (
          <div className="p-4 border rounded-lg bg-gradient-to-r from-primary/10 to-primary/5">
            <p className="text-sm text-muted-foreground">
              {currentUser.monthly_points >= teamAverage
                ? "🎉 Excelente! Você está acima da média da equipe. Continue mantendo este ritmo!"
                : `💪 ${Math.round((topPerformer.monthly_points - (currentUser.monthly_points || 0)) / 10)} visitas extras poderiam colocá-lo no topo!`
              }
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
