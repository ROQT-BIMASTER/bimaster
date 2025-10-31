import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, TrendingUp, Award, Star, Calendar, Settings } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UserRanking {
  id: string;
  user_id: string;
  period_type: string;
  period_key: string;
  total_points: number;
  ranking_position: number | null;
  level_name: string | null;
  level_number: number;
  badges: any;
  streak_days: number;
  last_activity_date: string | null;
  region: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    nome: string;
  };
}

interface Challenge {
  id: string;
  challenge_name: string;
  description: string;
  challenge_type: string;
  start_date: string;
  end_date: string;
  target_quantity: number;
  bonus_points: number;
  progress?: number;
}

const TradePerformance = () => {
  const { isAdminOrSupervisor } = useUserRole();
  const [currentUserRanking, setCurrentUserRanking] = useState<UserRanking | null>(null);
  const [topRankings, setTopRankings] = useState<UserRanking[]>([]);
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'quarterly' | 'yearly' | 'all_time'>('monthly');

  useEffect(() => {
    fetchPerformanceData();
  }, [selectedPeriod]);

  const fetchPerformanceData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentPeriodKey = getCurrentPeriodKey(selectedPeriod);

      // Buscar ranking do usuário atual
      const { data: userRank } = await supabase
        .from("user_rankings")
        .select("*")
        .eq("user_id", user.id)
        .eq("period_type", selectedPeriod)
        .eq("period_key", currentPeriodKey)
        .maybeSingle();

      setCurrentUserRanking(userRank);

      // Buscar top 10 rankings com perfis
      const { data: rankings, error: rankingsError } = await supabase
        .from("user_rankings")
        .select("*")
        .eq("period_type", selectedPeriod)
        .eq("period_key", currentPeriodKey)
        .order("total_points", { ascending: false })
        .limit(10);

      if (rankings) {
        // Buscar perfis separadamente
        const userIds = rankings.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", userIds);

        // Combinar rankings com perfis
        const rankingsWithProfiles = rankings.map(rank => ({
          ...rank,
          profiles: profiles?.find(p => p.id === rank.user_id)
        }));

        setTopRankings(rankingsWithProfiles as any);
      }

      // Buscar desafios ativos
      const today = new Date().toISOString().split('T')[0];
      const { data: challenges } = await supabase
        .from("trade_challenges")
        .select("*")
        .eq("is_active", true)
        .lte("start_date", today)
        .gte("end_date", today);

      // Buscar progresso do usuário em cada desafio
      if (challenges) {
        const challengesWithProgress = await Promise.all(
          challenges.map(async (challenge) => {
            const { data: progress } = await supabase
              .from("user_challenge_progress")
              .select("current_progress")
              .eq("user_id", user.id)
              .eq("challenge_id", challenge.id)
              .maybeSingle();

            return {
              ...challenge,
              progress: progress?.current_progress || 0
            };
          })
        );
        setActiveChallenges(challengesWithProgress);
      }

    } catch (error) {
      console.error("Erro ao buscar dados de performance:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const getCurrentPeriodKey = (period: string) => {
    const now = new Date();
    switch (period) {
      case 'monthly':
        return format(now, 'yyyy-MM');
      case 'quarterly':
        return `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
      case 'yearly':
        return now.getFullYear().toString();
      case 'all_time':
        return 'all';
      default:
        return format(now, 'yyyy-MM');
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Bronze': return 'bg-orange-500';
      case 'Prata': return 'bg-gray-400';
      case 'Ouro': return 'bg-yellow-500';
      case 'Platina': return 'bg-blue-400';
      case 'Elite': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getNextLevelPoints = (currentLevel: number) => {
    const levels = [500, 1500, 3000, 5000];
    return currentLevel < 5 ? levels[currentLevel - 1] : null;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p>Carregando...</p>
        </div>
      </DashboardLayout>
    );
  }

  const nextLevelPoints = currentUserRanking ? getNextLevelPoints(currentUserRanking.level_number) : null;
  const progressToNextLevel = nextLevelPoints && currentUserRanking 
    ? (currentUserRanking.total_points / nextLevelPoints) * 100 
    : 100;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Trophy className="h-8 w-8 text-primary" />
              Trade Performance
            </h1>
            <p className="text-muted-foreground">
              Sistema de pontuação e recompensas por desempenho
            </p>
          </div>
          {isAdminOrSupervisor && (
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Configurações
            </Button>
          )}
        </div>

        {/* User Performance Card */}
        {currentUserRanking && (
          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Seu Desempenho</span>
                <Badge className={getLevelColor(currentUserRanking.level_name)}>
                  {currentUserRanking.level_name}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{currentUserRanking.total_points}</p>
                  <p className="text-sm text-muted-foreground">Pontos</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">#{currentUserRanking.ranking_position}</p>
                  <p className="text-sm text-muted-foreground">Posição</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{currentUserRanking.streak_days}</p>
                  <p className="text-sm text-muted-foreground">Dias Sequenciais</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{currentUserRanking.level_number}</p>
                  <p className="text-sm text-muted-foreground">Nível</p>
                </div>
              </div>

              {nextLevelPoints && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progresso para {currentUserRanking.level_number < 5 ? ['Prata', 'Ouro', 'Platina', 'Elite'][currentUserRanking.level_number - 1] : 'Máximo'}</span>
                    <span>{currentUserRanking.total_points} / {nextLevelPoints}</span>
                  </div>
                  <Progress value={Math.min(progressToNextLevel, 100)} />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Tabs value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as any)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="monthly">Mensal</TabsTrigger>
            <TabsTrigger value="quarterly">Trimestral</TabsTrigger>
            <TabsTrigger value="yearly">Anual</TabsTrigger>
            <TabsTrigger value="all_time">Geral</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedPeriod} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Rankings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Top 10 Rankings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {topRankings.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum ranking disponível ainda
                    </p>
                  ) : (
                    topRankings.map((rank, index) => (
                      <div
                        key={rank.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                            <span className="font-bold">{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium">{rank.profiles?.nome || 'Usuário'}</p>
                            <Badge variant="outline" className="text-xs">
                              {rank.level_name}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{rank.total_points}</p>
                          <p className="text-xs text-muted-foreground">pontos</p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Active Challenges */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Desafios Ativos
                  </CardTitle>
                  <CardDescription>Complete desafios para ganhar pontos extras</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeChallenges.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum desafio ativo no momento
                    </p>
                  ) : (
                    activeChallenges.map((challenge) => (
                      <div key={challenge.id} className="p-4 border rounded-lg space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold">{challenge.challenge_name}</h4>
                            <p className="text-sm text-muted-foreground">{challenge.description}</p>
                          </div>
                          <Badge variant="secondary">
                            +{challenge.bonus_points} pts
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>Progresso</span>
                            <span>{challenge.progress} / {challenge.target_quantity}</span>
                          </div>
                          <Progress value={(challenge.progress! / challenge.target_quantity) * 100} />
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Até {format(new Date(challenge.end_date), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Point Actions Reference */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Como Ganhar Pontos
                </CardTitle>
                <CardDescription>Ações que geram pontuação</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-3 border rounded-lg">
                    <p className="font-semibold">Visita Completa</p>
                    <p className="text-2xl font-bold text-primary">50 pts</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="font-semibold">Auditoria Completa</p>
                    <p className="text-2xl font-bold text-primary">100 pts</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="font-semibold">Medição de Gôndola</p>
                    <p className="text-2xl font-bold text-primary">80 pts</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="font-semibold">Lançamento Sell Out</p>
                    <p className="text-2xl font-bold text-primary">70 pts</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="font-semibold">Inteligência Competitiva</p>
                    <p className="text-2xl font-bold text-primary">60 pts</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="font-semibold">Upload de Foto</p>
                    <p className="text-2xl font-bold text-primary">30 pts</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default TradePerformance;
