import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Activity,
  Calendar,
  Target
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { format, subDays, startOfDay, isAfter, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Atividade {
  id: string;
  tipo: string;
  resultado: string | null;
  data_atividade: string;
  proximo_followup: string | null;
}

interface Stats {
  total: number;
  concluidas: number;
  pendentes: number;
  atrasadas: number;
  taxaConclusao: number;
}

export const TaskDashboard = () => {
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    concluidas: 0,
    pendentes: 0,
    atrasadas: 0,
    taxaConclusao: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from("atividades")
        .select("*")
        .order("data_atividade", { ascending: false });

      if (error) throw error;

      const ativs = data || [];
      setAtividades(ativs);

      const hoje = new Date();
      const concluidas = ativs.filter(a => a.resultado === "positivo").length;
      const pendentes = ativs.filter(a => !a.resultado).length;
      const atrasadas = ativs.filter(a => 
        a.proximo_followup && 
        isBefore(new Date(a.proximo_followup), hoje) &&
        !a.resultado
      ).length;

      setStats({
        total: ativs.length,
        concluidas,
        pendentes,
        atrasadas,
        taxaConclusao: ativs.length > 0 ? Math.round((concluidas / ativs.length) * 100) : 0,
      });
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getAtividadesPorTipo = () => {
    const tipos = ["ligacao", "email", "reuniao", "visita"];
    const labels: Record<string, string> = {
      ligacao: "Ligações",
      email: "E-mails",
      reuniao: "Reuniões",
      visita: "Visitas",
    };

    return tipos.map(tipo => ({
      name: labels[tipo],
      value: atividades.filter(a => a.tipo === tipo).length,
    }));
  };

  const getAtividadesPorDia = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      return format(startOfDay(date), 'yyyy-MM-dd');
    });

    return last7Days.map(date => ({
      date: format(new Date(date), 'dd/MM', { locale: ptBR }),
      count: atividades.filter(a => 
        format(new Date(a.data_atividade), 'yyyy-MM-dd') === date
      ).length,
    }));
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

  if (loading) {
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
                  data={getAtividadesPorTipo()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getAtividadesPorTipo().map((entry, index) => (
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
            <CardTitle>Atividades - Últimos 7 Dias</CardTitle>
            <CardDescription>Volume de atividades por dia</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getAtividadesPorDia()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
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
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
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
