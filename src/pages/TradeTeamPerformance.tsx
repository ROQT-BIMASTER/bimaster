import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";

interface TeamMember {
  user_id: string;
  user_name: string;
  role: string;
  monthly_points: number | null;
  monthly_position: number | null;
  current_level: string | null;
  visits_this_month: number;
  photos_this_month: number;
  audits_this_month: number;
  measurements_this_month: number;
  avg_compliance: number | null;
  last_activity: string | null;
}

const TradeTeamPerformance = () => {
  const { isAdminOrSupervisor } = useUserRole();
  const navigate = useNavigate();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<string>("all");

  useEffect(() => {
    if (!isAdminOrSupervisor) {
      navigate("/dashboard");
      return;
    }
    fetchTeamPerformance();
  }, [isAdminOrSupervisor, navigate]);

  const fetchTeamPerformance = async () => {
    try {
      const { data, error } = await supabase
        .from("team_performance_view")
        .select("*")
        .order("monthly_points", { ascending: false, nullsFirst: false });

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error("Erro ao buscar performance da equipe:", error);
      toast.error("Erro ao carregar dados da equipe");
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = teamMembers.filter(member => {
    if (filterRole === "all") return true;
    return member.role === filterRole;
  });

  const getLevelColor = (level: string | null) => {
    if (!level) return "bg-gray-500";
    switch (level) {
      case 'Bronze': return 'bg-orange-500';
      case 'Prata': return 'bg-gray-400';
      case 'Ouro': return 'bg-yellow-500';
      case 'Platina': return 'bg-blue-400';
      case 'Elite': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getRoleLabel = (role: string) => {
    const labels = {
      'admin': 'Administrador',
      'supervisor': 'Supervisor',
      'vendedor': 'Vendedor',
      'promotor': 'Promotor'
    };
    return labels[role as keyof typeof labels] || role;
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            Performance da Equipe
          </h1>
          <p className="text-muted-foreground">
            Acompanhe o desempenho e produtividade de toda a equipe
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total de Membros</CardDescription>
              <CardTitle className="text-3xl">{filteredMembers.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Visitas Este Mês</CardDescription>
              <CardTitle className="text-3xl">
                {filteredMembers.reduce((acc, m) => acc + m.visits_this_month, 0)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Fotos Este Mês</CardDescription>
              <CardTitle className="text-3xl">
                {filteredMembers.reduce((acc, m) => acc + m.photos_this_month, 0)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Média de Compliance</CardDescription>
              <CardTitle className="text-3xl">
                {(
                  filteredMembers.reduce((acc, m) => acc + (m.avg_compliance || 0), 0) / 
                  (filteredMembers.filter(m => m.avg_compliance).length || 1)
                ).toFixed(0)}%
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Performance Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Desempenho Individual</CardTitle>
                <CardDescription>Métricas detalhadas por membro da equipe</CardDescription>
              </div>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="supervisor">Supervisores</SelectItem>
                  <SelectItem value="vendedor">Vendedores</SelectItem>
                  <SelectItem value="promotor">Promotores</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Posição</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead className="text-right">Pontos</TableHead>
                  <TableHead className="text-right">Visitas</TableHead>
                  <TableHead className="text-right">Fotos</TableHead>
                  <TableHead className="text-right">Auditorias</TableHead>
                  <TableHead className="text-right">Compliance</TableHead>
                  <TableHead>Última Atividade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Nenhum membro da equipe encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMembers.map((member) => (
                    <TableRow key={member.user_id}>
                      <TableCell>
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 font-bold">
                          {member.monthly_position || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{member.user_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getRoleLabel(member.role)}</Badge>
                      </TableCell>
                      <TableCell>
                        {member.current_level && (
                          <Badge className={getLevelColor(member.current_level)}>
                            {member.current_level}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold">{member.monthly_points || 0}</TableCell>
                      <TableCell className="text-right">{member.visits_this_month}</TableCell>
                      <TableCell className="text-right">{member.photos_this_month}</TableCell>
                      <TableCell className="text-right">{member.audits_this_month}</TableCell>
                      <TableCell className="text-right">
                        {member.avg_compliance ? `${member.avg_compliance.toFixed(0)}%` : '-'}
                      </TableCell>
                      <TableCell>
                        {member.last_activity 
                          ? format(new Date(member.last_activity), "dd/MM/yy 'às' HH:mm", { locale: ptBR })
                          : '-'
                        }
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default TradeTeamPerformance;