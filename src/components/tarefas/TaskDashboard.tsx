import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle2, 
  Clock, 
  Activity,
  Calendar,
  Target
} from "lucide-react";
import { 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAtividadesStats, getAtividadesPorTipo } from "@/hooks/useAtividadesData";

export const TaskDashboard = () => {
  const { toast } = useToast();
  const { data, isLoading, error } = useAtividadesStats();

  // Processar dados para gráficos usando useMemo para evitar recálculos
  const atividadesPorTipo = useMemo(() => {
    if (!data?.atividades) return [];
    return getAtividadesPorTipo(data.atividades);
  }, [data?.atividades]);

  const atividadesPorDia = useMemo(() => {
    if (!data?.atividades) return [];
    
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = subDays(new Date(), 29 - i);
      return format(startOfDay(date), 'yyyy-MM-dd');
    });

    return last30Days.map(date => ({
      date: format(new Date(date), 'dd/MM', { locale: ptBR }),
      count: data.atividades.filter(a => 
        format(new Date(a.data_atividade), 'yyyy-MM-dd') === date
      ).length,
    }));
  }, [data?.atividades]);

  // Mostrar erro se houver
  if (error) {
    toast({
      title: "Erro",
      description: "Não foi possível carregar os dados",
      variant: "destructive",
    });
  }

  const stats = data?.stats || {
    total: 0,
    concluidas: 0,
    pendentes: 0,
    atrasadas: 0,
    taxaConclusao: 0,
  };

  const COLORS = ['hsl(217, 91%, 60%)', 'hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(280, 65%, 60%)'];

  const statCards = [
    {
      title: "Total de Tarefas",
      value: stats.total,
      icon: Activity,
      description: "Todas as atividades",
    },
    {
      title: "Concluídas",
      value: stats.concluidas,
      icon: CheckCircle2,
      description: "Com resultado positivo",
      color: "text-success",
    },
    {
      title: "Pendentes",
      value: stats.pendentes,
      icon: Clock,
      description: "Aguardando conclusão",
      color: "text-warning",
    },
    {
      title: "Atrasadas",
      value: stats.atrasadas,
      icon: Calendar,
      description: "Follow-ups vencidos",
      color: "text-destructive",
    },
  ];

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
        <p className="mt-2 text-sm text-muted-foreground">Carregando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color || 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Atividades por Tipo</CardTitle>
            <CardDescription>Distribuição de atividades realizadas</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={atividadesPorTipo}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {atividadesPorTipo.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atividades - Últimos 30 Dias</CardTitle>
            <CardDescription>Linha do tempo de atividades registradas</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={atividadesPorDia}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-card border rounded-lg p-3 shadow-lg">
                          <p className="font-semibold">{payload[0].payload.date}</p>
                          <p className="text-sm">Atividades: {payload[0].value}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Taxa de Conclusão
          </CardTitle>
          <CardDescription>Percentual de atividades concluídas com sucesso</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold">{stats.taxaConclusao}%</div>
            <div className="flex-1">
              <div className="h-4 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-success transition-all duration-500"
                  style={{ width: `${stats.taxaConclusao}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {stats.concluidas} de {stats.total} tarefas concluídas
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
