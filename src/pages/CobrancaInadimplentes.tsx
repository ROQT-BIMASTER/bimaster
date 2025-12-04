import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertCircle, 
  ArrowLeft, 
  Phone, 
  Mail, 
  MessageCircle, 
  FileText, 
  TrendingUp, 
  Handshake,
  Users,
  DollarSign,
  Clock
} from "lucide-react";
import { InadimplenteDrawer } from "@/components/cobranca/InadimplenteDrawer";

interface ContaVencida {
  id: string;
  cliente_codigo: string;
  cliente_nome: string;
  empresa_nome: string;
  numero_documento: string;
  parcela: number;
  valor_aberto: number;
  valor_original: number;
  data_vencimento: string;
  dias_atraso: number;
  vendedor_nome: string;
}

interface ClienteAgrupado {
  cliente_codigo: string;
  cliente_nome: string;
  total_aberto: number;
  total_titulos: number;
  dias_medio_atraso: number;
  maior_atraso: number;
  contas: ContaVencida[];
  ultima_cobranca?: {
    tipo_acao: string;
    data_acao: string;
    status: string;
  };
}

export default function CobrancaInadimplentes() {
  const [searchCliente, setSearchCliente] = useState("");
  const [filterEmpresa, setFilterEmpresa] = useState<string>("all");
  const [filterDiasAtraso, setFilterDiasAtraso] = useState<string>("all");
  const [selectedCliente, setSelectedCliente] = useState<ClienteAgrupado | null>(null);

  // Query contas vencidas
  const { data: contasVencidas, isLoading, refetch } = useQuery({
    queryKey: ['contas-vencidas', filterEmpresa, filterDiasAtraso],
    queryFn: async () => {
      let query = supabase
        .from('contas_receber')
        .select('*')
        .eq('status', 'vencido')
        .gt('valor_aberto', 0)
        .order('dias_atraso', { ascending: false });

      if (filterEmpresa !== 'all') {
        query = query.eq('empresa_id', parseInt(filterEmpresa));
      }

      if (filterDiasAtraso !== 'all') {
        const diasMin = parseInt(filterDiasAtraso);
        query = query.gte('dias_atraso', diasMin);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as ContaVencida[];
    }
  });

  // Query últimas cobranças por cliente
  const { data: ultimasCobrancas } = useQuery({
    queryKey: ['ultimas-cobrancas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas')
        .select('cliente_codigo, tipo_acao, data_acao, status')
        .order('data_acao', { ascending: false });
      
      if (error) throw error;
      
      // Agrupar por cliente (pegar apenas a última)
      const porCliente: Record<string, any> = {};
      data?.forEach(c => {
        if (!porCliente[c.cliente_codigo]) {
          porCliente[c.cliente_codigo] = c;
        }
      });
      return porCliente;
    }
  });

  // Agrupar contas por cliente
  const clientesAgrupados: ClienteAgrupado[] = contasVencidas
    ? Object.values(
        contasVencidas.reduce((acc: Record<string, ClienteAgrupado>, conta) => {
          const key = conta.cliente_codigo;
          if (!acc[key]) {
            acc[key] = {
              cliente_codigo: conta.cliente_codigo,
              cliente_nome: conta.cliente_nome,
              total_aberto: 0,
              total_titulos: 0,
              dias_medio_atraso: 0,
              maior_atraso: 0,
              contas: [],
              ultima_cobranca: ultimasCobrancas?.[key]
            };
          }
          acc[key].total_aberto += conta.valor_aberto || 0;
          acc[key].total_titulos++;
          acc[key].contas.push(conta);
          acc[key].maior_atraso = Math.max(acc[key].maior_atraso, conta.dias_atraso || 0);
          return acc;
        }, {})
      )
        .map(cliente => ({
          ...cliente,
          dias_medio_atraso: Math.round(
            cliente.contas.reduce((sum, c) => sum + (c.dias_atraso || 0), 0) / cliente.contas.length
          )
        }))
        .filter(cliente => 
          cliente.cliente_nome?.toLowerCase().includes(searchCliente.toLowerCase())
        )
        .sort((a, b) => b.total_aberto - a.total_aberto)
    : [];

  // Calcular KPIs
  const kpis = {
    totalVencido: clientesAgrupados.reduce((sum, c) => sum + c.total_aberto, 0),
    totalClientes: clientesAgrupados.length,
    totalTitulos: clientesAgrupados.reduce((sum, c) => sum + c.total_titulos, 0),
    acordosAtivos: 0 // TODO: calcular acordos ativos
  };

  // Empresas únicas
  const empresas = Array.from(
    new Set(contasVencidas?.map(c => JSON.stringify({ id: c.empresa_nome, nome: c.empresa_nome })) || [])
  ).map(e => JSON.parse(e));

  const getDiasAtrasoBadge = (dias: number) => {
    if (dias >= 90) return <Badge variant="destructive">+90 dias</Badge>;
    if (dias >= 60) return <Badge className="bg-orange-500">60-90 dias</Badge>;
    if (dias >= 30) return <Badge className="bg-yellow-500 text-black">30-60 dias</Badge>;
    return <Badge variant="secondary">{dias} dias</Badge>;
  };

  const getUltimaCobrancaInfo = (cliente: ClienteAgrupado) => {
    if (!cliente.ultima_cobranca) {
      return <span className="text-xs text-muted-foreground">Sem registro</span>;
    }
    const { tipo_acao, data_acao, status } = cliente.ultima_cobranca;
    const tipoIcons: Record<string, any> = {
      telefone: Phone,
      email: Mail,
      whatsapp: MessageCircle,
    };
    const Icon = tipoIcons[tipo_acao] || FileText;
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        {new Date(data_acao).toLocaleDateString('pt-BR')} - {status}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <AlertCircle className="h-8 w-8 text-destructive" />
              Cobrança de Inadimplentes
            </h1>
            <p className="text-muted-foreground">Gestão de cobranças e acordos</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard/financeiro">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Módulo Financeiro
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard/financeiro/contas-a-receber">
                  Contas a Receber
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Vencido</CardTitle>
              <DollarSign className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpis.totalVencido)}
              </div>
              <p className="text-xs text-muted-foreground">Em aberto vencido</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes Inadimplentes</CardTitle>
              <Users className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalClientes}</div>
              <p className="text-xs text-muted-foreground">Com títulos vencidos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Títulos Vencidos</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalTitulos}</div>
              <p className="text-xs text-muted-foreground">Total de títulos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Recuperação</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">--</div>
              <p className="text-xs text-muted-foreground">Último mês</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Cliente</label>
                <Input
                  placeholder="Buscar cliente..."
                  value={searchCliente}
                  onChange={(e) => setSearchCliente(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Empresa</label>
                <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {empresas.map((emp, idx) => (
                      <SelectItem key={idx} value={emp.id}>{emp.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Dias de Atraso</label>
                <Select value={filterDiasAtraso} onValueChange={setFilterDiasAtraso}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="1">1+ dias</SelectItem>
                    <SelectItem value="15">15+ dias</SelectItem>
                    <SelectItem value="30">30+ dias</SelectItem>
                    <SelectItem value="60">60+ dias</SelectItem>
                    <SelectItem value="90">90+ dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Inadimplentes */}
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-center">
                <div className="animate-pulse">Carregando inadimplentes...</div>
              </CardContent>
            </Card>
          ) : clientesAgrupados.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Handshake className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <p className="text-muted-foreground">Nenhum cliente inadimplente encontrado</p>
              </CardContent>
            </Card>
          ) : (
            clientesAgrupados.map((cliente) => (
              <Card 
                key={cliente.cliente_codigo} 
                className="hover:border-primary/50 cursor-pointer transition-colors"
                onClick={() => setSelectedCliente(cliente)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${cliente.maior_atraso >= 90 ? 'bg-red-500' : cliente.maior_atraso >= 60 ? 'bg-orange-500' : cliente.maior_atraso >= 30 ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                        <h3 className="font-semibold">{cliente.cliente_nome}</h3>
                        {getDiasAtrasoBadge(cliente.maior_atraso)}
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{cliente.total_titulos} título(s)</span>
                        <span>•</span>
                        <span>Atraso médio: {cliente.dias_medio_atraso} dias</span>
                        <span>•</span>
                        {getUltimaCobrancaInfo(cliente)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-destructive">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cliente.total_aberto)}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Ação de telefone
                          }}
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Ação de email
                          }}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Ação de whatsapp
                          }}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Drawer de detalhes */}
      <InadimplenteDrawer 
        cliente={selectedCliente}
        open={!!selectedCliente}
        onClose={() => setSelectedCliente(null)}
        onRefresh={refetch}
      />
    </DashboardLayout>
  );
}
