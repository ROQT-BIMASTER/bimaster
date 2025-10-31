import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, TrendingUp, Award, Target, Star, Gift, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";

interface UserRanking {
  user_id: string;
  total_points: number;
  ranking_position: number;
  level_name: string;
  level_number: number;
  nome?: string;
  email?: string;
}

interface PointsHistory {
  id: string;
  action_code: string;
  base_points: number;
  multiplier: number;
  final_points: number;
  earned_at: string;
  metadata: any;
  action_name?: string;
}

interface Challenge {
  id: string;
  challenge_name: string;
  description: string;
  challenge_type: string;
  start_date: string;
  end_date: string;
  bonus_points: number;
  target_quantity: number;
  user_challenge_progress?: {
    current_progress: number;
    completed: boolean;
  }[];
}

const TradePerformance = () => {
  const { isAdminOrSupervisor } = useUserRole();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRanking, setUserRanking] = useState<UserRanking | null>(null);
  const [rankings, setRankings] = useState<UserRanking[]>([]);
  const [pointsHistory, setPointsHistory] = useState<PointsHistory[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [periodType, setPeriodType] = useState<string>("monthly");
  const [periodKey, setPeriodKey] = useState<string>(format(new Date(), "yyyy-MM"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, periodType, periodKey]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser(user);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchUserRanking(),
        fetchRankings(),
        fetchPointsHistory(),
        fetchChallenges(),
      ]);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRanking = async () => {
    const { data, error } = await supabase
      .from("user_rankings")
      .select("*")
      .eq("user_id", currentUser?.id)
      .eq("period_type", periodType)
      .eq("period_key", periodKey)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Erro ao buscar ranking do usuário:", error);
    } else {
      setUserRanking(data);
    }
  };

  const fetchRankings = async () => {
    const { data, error } = await supabase
      .from("user_rankings")
      .select(`
        user_id,
        total_points,
        ranking_position,
        level_name,
        level_number
      `)
      .eq("period_type", periodType)
      .eq("period_key", periodKey)
      .order("ranking_position", { ascending: true })
      .limit(50);

    if (error) {
      console.error("Erro ao buscar rankings:", error);
      return;
    }

    // Buscar perfis dos usuários
    if (data) {
      const userIds = data.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", userIds);

      const rankingsWithProfiles = data.map(rank => ({
        ...rank,
        nome: profiles?.find(p => p.id === rank.user_id)?.nome,
        email: profiles?.find(p => p.id === rank.user_id)?.email,
      }));

      setRankings(rankingsWithProfiles);
    }
  };

  const fetchPointsHistory = async () => {
    const { data, error } = await supabase
      .from("user_points_history")
      .select("*")
      .eq("user_id", currentUser?.id)
      .order("earned_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Erro ao buscar histórico:", error);
      return;
    }

    // Buscar nomes das ações
    if (data) {
      const actionCodes = [...new Set(data.map(p => p.action_code))];
      const { data: actions } = await supabase
        .from("trade_action_points")
        .select("action_code, action_name")
        .in("action_code", actionCodes);

      const historyWithNames = data.map(point => ({
        ...point,
        action_name: actions?.find(a => a.action_code === point.action_code)?.action_name,
      }));

      setPointsHistory(historyWithNames);
    }
  };

  const fetchChallenges = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    
    const { data, error } = await supabase
      .from("trade_challenges")
      .select(`
        *,
        user_challenge_progress!inner (
          current_progress,
          completed
        )
      `)
      .eq("is_active", true)
      .lte("start_date", today)
      .gte("end_date", today)
      .eq("user_challenge_progress.user_id", currentUser?.id);

    if (error) {
      console.error("Erro ao buscar desafios:", error);
    } else {
      setChallenges(data || []);
    }
  };

  const getLevelColor = (levelNumber: number) => {
    const colors = {
      1: "bg-amber-700",
      2: "bg-gray-400",
      3: "bg-yellow-400",
      4: "bg-purple-500",
      5: "bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600",
    };
    return colors[levelNumber as keyof typeof colors] || "bg-gray-400";
  };

  const getNextLevelPoints = (currentPoints: number) => {
    const levels = [0, 500, 1500, 3000, 5000, 10000];
    for (let i = 0; i < levels.length; i++) {
      if (currentPoints < levels[i]) {
        return { next: levels[i], current: levels[i - 1] || 0 };
      }
    }
    return { next: 10000, current: 5000 };
  };

  const getMedalIcon = (position: number) => {
    if (position === 1) return "🥇";
    if (position === 2) return "🥈";
    if (position === 3) return "🥉";
    return `${position}º`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
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
          <div className="flex gap-2">
            <Button
              variant={periodType === "monthly" ? "default" : "outline"}
              onClick={() => {
                setPeriodType("monthly");
                setPeriodKey(format(new Date(), "yyyy-MM"));
              }}
              size="sm"
            >
              Mensal
            </Button>
            <Button
              variant={periodType === "yearly" ? "default" : "outline"}
              onClick={() => {
                setPeriodType("yearly");
                setPeriodKey(format(new Date(), "yyyy"));
              }}
              size="sm"
            >
              Anual
            </Button>
            <Button
              variant={periodType === "all_time" ? "default" : "outline"}
              onClick={() => {
                setPeriodType("all_time");
                setPeriodKey("all");
              }}
              size="sm"
            >
              Geral
            </Button>
          </div>
        </div>

        {/* Card de Performance do Usuário */}
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              Seu Desempenho
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Pontuação Total</p>
                <p className="text-3xl font-bold text-primary">
                  {userRanking?.total_points || 0}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Posição no Ranking</p>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold">
                    {userRanking?.ranking_position ? getMedalIcon(userRanking.ranking_position) : "-"}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Nível Atual</p>
                <Badge className={`${getLevelColor(userRanking?.level_number || 1)} text-white text-lg px-3 py-1`}>
                  {userRanking?.level_name || "Bronze"}
                </Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Progresso para Próximo Nível</p>
                {userRanking && (() => {
                  const { next, current } = getNextLevelPoints(userRanking.total_points);
                  const progress = ((userRanking.total_points - current) / (next - current)) * 100;
                  return (
                    <div className="space-y-1">
                      <Progress value={progress} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {userRanking.total_points - current} / {next - current} pts
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="ranking" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="ranking">
              <BarChart3 className="h-4 w-4 mr-2" />
              Ranking
            </TabsTrigger>
            <TabsTrigger value="historico">
              <TrendingUp className="h-4 w-4 mr-2" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="desafios">
              <Target className="h-4 w-4 mr-2" />
              Desafios
            </TabsTrigger>
            <TabsTrigger value="recompensas">
              <Gift className="h-4 w-4 mr-2" />
              Recompensas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ranking" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Ranking Geral</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {rankings.map((rank) => (
                    <div
                      key={rank.user_id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        rank.user_id === currentUser?.id ? "border-primary bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-2xl font-bold w-12 text-center">
                          {getMedalIcon(rank.ranking_position || 0)}
                        </div>
                        <div>
                          <p className="font-semibold">{rank.nome || "Usuário"}</p>
                          <p className="text-sm text-muted-foreground">{rank.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className={getLevelColor(rank.level_number)}>
                          {rank.level_name}
                        </Badge>
                        <div className="text-right">
                          <p className="text-xl font-bold text-primary">{rank.total_points}</p>
                          <p className="text-xs text-muted-foreground">pontos</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Pontuação</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pointsHistory.map((point) => (
                    <div key={point.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">
                          {point.action_name || point.action_code}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(point.earned_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">+{point.final_points}</p>
                        {point.multiplier > 1 && (
                          <p className="text-xs text-muted-foreground">
                            Multiplicador: {point.multiplier}x
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="desafios" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {challenges.map((challenge) => {
                const progress = challenge.user_challenge_progress?.[0];
                const progressPercent = progress
                  ? (progress.current_progress / challenge.target_quantity) * 100
                  : 0;

                return (
                  <Card key={challenge.id} className={progress?.completed ? "border-green-500" : ""}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{challenge.challenge_name}</CardTitle>
                          <Badge variant="outline" className="mt-2">
                            {challenge.challenge_type}
                          </Badge>
                        </div>
                        {progress?.completed && (
                          <Badge className="bg-green-500">
                            <Award className="h-3 w-3 mr-1" />
                            Completo
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">{challenge.description}</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progresso</span>
                          <span className="font-medium">
                            {progress?.current_progress || 0} / {challenge.target_quantity}
                          </span>
                        </div>
                        <Progress value={progressPercent} />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Recompensa</span>
                        <span className="font-bold text-primary">+{challenge.bonus_points} pontos</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Termina em: {format(new Date(challenge.end_date), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="recompensas" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recompensas Disponíveis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-8">
                  As recompensas serão configuradas pelo administrador.
                  <br />
                  Continue acumulando pontos para trocar por prêmios em breve!
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default TradePerformance;
