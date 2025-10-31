import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, TrendingUp, Search, ArrowUpDown, Calendar } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<keyof TeamMember>("monthly_points");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [periodFilter, setPeriodFilter] = useState<string>("current");

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

  const handleSort = (column: keyof TeamMember) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const filteredMembers = teamMembers
    .filter(member => {
      if (filterRole !== "all" && member.role !== filterRole) return false;
      if (searchQuery && !member.user_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const aValue = a[sortBy] ?? 0;
      const bValue = b[sortBy] ?? 0;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === "asc" 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      const numA = typeof aValue === 'number' ? aValue : 0;
      const numB = typeof bValue === 'number' ? bValue : 0;
      
      return sortOrder === "asc" ? numA - numB : numB - numA;
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

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Buscar por nome</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Digite o nome..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Função</label>
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por função" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as funções</SelectItem>
                    <SelectItem value="supervisor">Supervisores</SelectItem>
                    <SelectItem value="vendedor">Vendedores</SelectItem>
                    <SelectItem value="promotor">Promotores</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Período</label>
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Mês Atual</SelectItem>
                    <SelectItem value="last">Mês Passado</SelectItem>
                    <SelectItem value="last3">Últimos 3 Meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Desempenho Individual</CardTitle>
                <CardDescription>
                  {filteredMembers.length} {filteredMembers.length === 1 ? 'membro' : 'membros'} da equipe
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchTeamPerformance()}
              >
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => handleSort("monthly_position")}
                      >
                        Posição
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => handleSort("user_name")}
                      >
                        Nome
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => handleSort("monthly_points")}
                      >
                        Pontos
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => handleSort("visits_this_month")}
                      >
                        Visitas
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => handleSort("photos_this_month")}
                      >
                        Fotos
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => handleSort("audits_this_month")}
                      >
                        Auditorias
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => handleSort("avg_compliance")}
                      >
                        Compliance
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
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
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default TradeTeamPerformance;