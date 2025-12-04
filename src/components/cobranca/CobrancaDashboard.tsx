import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  Users, 
  Clock, 
  TrendingUp, 
  Target,
  AlertTriangle,
  CheckCircle,
  Handshake,
  Phone,
  BarChart3
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";

interface CobrancaKPIs {
  totalVencido: number;
  totalClientes: number;
  totalTitulos: number;
  acordosAtivos: number;
  acordosValor: number;
  recuperadoMes: number;
  metaRecuperacao: number;
  contatosRealizados: number;
  taxaSucesso: number;
  ticketMedio: number;
  diasMedioAtraso: number;
  aging: {
    ate30: number;
    de31a60: number;
    de61a90: number;
    mais90: number;
  };
}

interface Props {
  kpis: CobrancaKPIs;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export function CobrancaDashboard({ kpis }: Props) {
  const agingData = useMemo(() => [
    { name: '0-30 dias', value: kpis.aging.ate30, color: 'hsl(var(--chart-1))' },
    { name: '31-60 dias', value: kpis.aging.de31a60, color: 'hsl(var(--chart-2))' },
    { name: '61-90 dias', value: kpis.aging.de61a90, color: 'hsl(var(--chart-3))' },
    { name: '+90 dias', value: kpis.aging.mais90, color: 'hsl(var(--destructive))' },
  ], [kpis.aging]);

  const taxaRecuperacao = kpis.metaRecuperacao > 0 
    ? Math.min(100, (kpis.recuperadoMes / kpis.metaRecuperacao) * 100) 
    : 0;

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <div className="space-y-6">
      {/* KPIs Principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-destructive/30 bg-gradient-to-br from-destructive/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inadimplente</CardTitle>
            <DollarSign className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(kpis.totalVencido)}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                {kpis.totalTitulos} títulos
              </Badge>
              <Badge variant="outline" className="text-xs">
                {kpis.totalClientes} clientes
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recuperado no Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(kpis.recuperadoMes)}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={taxaRecuperacao} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground">
                {taxaRecuperacao.toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Meta: {formatCurrency(kpis.metaRecuperacao)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acordos Ativos</CardTitle>
            <Handshake className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.acordosAtivos}</div>
            <div className="text-sm text-muted-foreground">
              {formatCurrency(kpis.acordosValor)} em acordos
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eficiência</CardTitle>
            <Target className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.taxaSucesso.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">
              {kpis.contatosRealizados} contatos realizados
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Aging por Faixa */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Aging por Faixa de Atraso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingData} layout="vertical">
                  <XAxis type="number" tickFormatter={(value) => `R$ ${(value/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={80} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {agingData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Distribuição por Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Métricas de Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Dias Médio de Atraso</span>
                </div>
                <span className="font-bold text-orange-500">{kpis.diasMedioAtraso} dias</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Ticket Médio</span>
                </div>
                <span className="font-bold">{formatCurrency(kpis.ticketMedio)}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Contatos/Dia (média)</span>
                </div>
                <span className="font-bold">{Math.round(kpis.contatosRealizados / 22)}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Taxa de Conversão</span>
                </div>
                <span className="font-bold text-green-500">{kpis.taxaSucesso.toFixed(1)}%</span>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium">Alertas</span>
                </div>
                <div className="space-y-2">
                  {kpis.aging.mais90 > 0 && (
                    <div className="text-xs p-2 bg-destructive/10 rounded-md text-destructive">
                      {formatCurrency(kpis.aging.mais90)} com +90 dias de atraso
                    </div>
                  )}
                  {kpis.acordosAtivos === 0 && kpis.totalClientes > 5 && (
                    <div className="text-xs p-2 bg-orange-500/10 rounded-md text-orange-600">
                      Nenhum acordo ativo - considere renegociações
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
