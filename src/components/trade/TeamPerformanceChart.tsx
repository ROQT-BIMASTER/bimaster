import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Trophy, Medal } from "lucide-react";
import { toast } from "sonner";
import { ProfileAvatarUpload } from "@/components/shared/ProfileAvatarUpload";

interface TeamMemberStats {
  id: string;
  nome: string;
  email: string;
  role: string;
  avatar_url: string | null;
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchTeamPerformance();
  }, []);

  const fetchTeamPerformance = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      let teamMemberIds: string[] = [];

      if (roleData?.role === 'admin' || roleData?.role === 'gerente') {
        const { data: profiles } = await (supabase
          .from("profiles")
          .select("id") as any)
          .eq("status", "ativo")
          .neq("departamento_id", "9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130");
        teamMemberIds = profiles?.map((p: any) => p.id) || [];
      } else if (roleData?.role === 'supervisor') {
        const { data: subordinados } = await supabase
          .rpc('get_subordinados', { _user_id: user.id });
        if (subordinados) {
          teamMemberIds = subordinados.map((s: any) => s.subordinado_id);
        }
        teamMemberIds.push(user.id);
      }

      if (teamMemberIds.length === 0) {
        setStats([]);
        setLoading(false);
        return;
      }

      // Buscar visitas
      const { data: visits, error: visitsError } = await supabase
        .from("visits")
        .select("user_id, status")
        .in("user_id", teamMemberIds);
      if (visitsError) throw visitsError;

      // Buscar profiles com avatar_url
      const { data: profiles, error: profilesError } = await (supabase
        .from("profiles")
        .select("id, nome, email, avatar_url") as any)
        .in("id", teamMemberIds);
      if (profilesError) throw profilesError;

      // Buscar roles
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", teamMemberIds);

      const memberStats: TeamMemberStats[] = (profiles || []).map((profile: any) => {
        const userVisits = visits?.filter(v => v.user_id === profile.id) || [];
        const concluidas = userVisits.filter(v => v.status === 'completed').length;
        const total = userVisits.length;
        const em_andamento = userVisits.filter(v => v.status === 'in_progress').length;
        const agendadas = userVisits.filter(v => v.status === 'scheduled').length;
        const canceladas = userVisits.filter(v => v.status === 'cancelled').length;
        const userRole = userRoles?.find(r => r.user_id === profile.id);

        return {
          id: profile.id,
          nome: profile.nome,
          email: profile.email || '',
          role: userRole?.role || 'vendedor',
          avatar_url: profile.avatar_url,
          total_visitas: total,
          concluidas,
          em_andamento,
          agendadas,
          canceladas,
          taxa_conclusao: total > 0 ? Math.round((concluidas / total) * 100) : 0,
        };
      });

      // Ordenar por taxa de conclusão
      memberStats.sort((a, b) => b.taxa_conclusao - a.taxa_conclusao);
      setStats(memberStats);
    } catch (error) {
      console.error("Erro ao buscar performance:", error);
      toast.error("Erro ao carregar dados de performance");
    } finally {
      setLoading(false);
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

  const chartData = stats.map(member => ({
    nome: member.nome.split(' ')[0],
    Concluídas: member.concluidas,
    'Em Andamento': member.em_andamento,
    Agendadas: member.agendadas,
    total: member.total_visitas,
    taxa: member.taxa_conclusao,
  }));

  const getRankMedal = (position: number) => {
    if (position === 1) return "🥇";
    if (position === 2) return "🥈";
    if (position === 3) return "🥉";
    return `${position}º`;
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: "Admin",
      gerente: "Gerente",
      supervisor: "Supervisor",
      vendedor: "Vendedor",
      promotor: "Promotor",
    };
    return labels[role] || role;
  };

  return (
    <div className="space-y-6">
      {/* Ranking da Equipe */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Ranking da Equipe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.map((member, idx) => {
              const isCurrentUser = member.id === currentUserId;
              return (
                <div
                  key={member.id}
                  className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                    idx === 0 ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800" :
                    idx === 1 ? "bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-700" :
                    idx === 2 ? "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800" :
                    isCurrentUser ? "bg-primary/5 border-primary/20" :
                    "bg-card border-border"
                  }`}
                >
                  {/* Posição */}
                  <div className="w-10 text-center shrink-0">
                    <span className={`text-lg font-bold ${idx < 3 ? "" : "text-muted-foreground"}`}>
                      {getRankMedal(idx + 1)}
                    </span>
                  </div>

                  {/* Avatar */}
                  <ProfileAvatarUpload
                    userId={member.id}
                    currentAvatarUrl={member.avatar_url}
                    userName={member.nome}
                    size="md"
                    editable={isCurrentUser}
                    onUploadComplete={() => fetchTeamPerformance()}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{member.nome}</span>
                      {isCurrentUser && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">Você</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {getRoleLabel(member.role)}
                      </Badge>
                      <span>{member.total_visitas} visitas</span>
                      <span>•</span>
                      <span className="text-green-600">{member.concluidas} concluídas</span>
                    </div>
                  </div>

                  {/* Taxa de conclusão */}
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold">{member.taxa_conclusao}%</div>
                    <div className="text-[10px] text-muted-foreground">conclusão</div>
                  </div>

                  {/* Barra de progresso */}
                  <div className="w-20 shrink-0">
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${member.taxa_conclusao}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Barras */}
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
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend
                wrapperStyle={{
                  paddingTop: '20px',
                  color: 'hsl(var(--foreground))',
                }}
              />
              <Bar dataKey="Concluídas" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Em Andamento" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Agendadas" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cards Individuais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((member, idx) => (
          <Card key={member.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-3">
                <ProfileAvatarUpload
                  userId={member.id}
                  currentAvatarUrl={member.avatar_url}
                  userName={member.nome}
                  size="sm"
                  editable={member.id === currentUserId}
                  onUploadComplete={() => fetchTeamPerformance()}
                />
                <div className="flex-1 min-w-0">
                  <span className="truncate block">{member.nome}</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    {getRoleLabel(member.role)}
                  </span>
                </div>
                <span className="text-lg shrink-0">{getRankMedal(idx + 1)}</span>
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
