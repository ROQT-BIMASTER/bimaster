import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatarMoeda } from "@/lib/fabrica/pricing-calculator";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, Minus, History, Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtoId: string;
  produtoNome?: string;
}

export function HistoricoPrecoProduto({ open, onOpenChange, produtoId, produtoNome }: Props) {
  const [periodoFiltro, setPeriodoFiltro] = useState("6m");

  const getDataInicio = () => {
    const hoje = new Date();
    switch (periodoFiltro) {
      case "1m": return new Date(hoje.setMonth(hoje.getMonth() - 1));
      case "3m": return new Date(hoje.setMonth(hoje.getMonth() - 3));
      case "6m": return new Date(hoje.setMonth(hoje.getMonth() - 6));
      case "1a": return new Date(hoje.setFullYear(hoje.getFullYear() - 1));
      default: return new Date(hoje.setMonth(hoje.getMonth() - 6));
    }
  };

  const { data: historico, isLoading } = useQuery({
    queryKey: ["historico-preco-produto", produtoId, periodoFiltro],
    queryFn: async () => {
      const dataInicio = getDataInicio().toISOString();

      const { data, error } = await supabase
        .from("fabrica_historico_precos")
        .select(`
          *,
          tabela:tabela_id(nome, codigo)
        `)
        .eq("produto_id", produtoId)
        .gte("data_alteracao", dataInicio)
        .order("data_alteracao", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!produtoId,
  });

  const dadosGrafico = historico?.map((item) => ({
    data: format(new Date(item.data_alteracao), "dd/MM", { locale: ptBR }),
    dataCompleta: format(new Date(item.data_alteracao), "dd/MM/yyyy HH:mm", { locale: ptBR }),
    precoAnterior: item.preco_anterior || 0,
    precoNovo: item.preco_novo || 0,
    tabela: item.tabela?.nome || "N/A",
  })) || [];

  const calcularVariacao = () => {
    if (!historico || historico.length < 2) return null;
    
    const primeiro = historico[0];
    const ultimo = historico[historico.length - 1];
    const precoInicial = primeiro.preco_anterior || primeiro.preco_novo || 0;
    const precoFinal = ultimo.preco_novo || 0;
    
    if (precoInicial === 0) return null;
    
    return ((precoFinal - precoInicial) / precoInicial) * 100;
  };

  const variacao = calcularVariacao();

  const getVariacaoIcon = () => {
    if (!variacao) return <Minus className="h-4 w-4" />;
    if (variacao > 0) return <TrendingUp className="h-4 w-4" />;
    return <TrendingDown className="h-4 w-4" />;
  };

  const getVariacaoColor = () => {
    if (!variacao) return "text-muted-foreground";
    if (variacao > 0) return "text-red-600";
    return "text-green-600";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Preços - {produtoNome || "Produto"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filtro de Período */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Período:</span>
              <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1m">1 Mês</SelectItem>
                  <SelectItem value="3m">3 Meses</SelectItem>
                  <SelectItem value="6m">6 Meses</SelectItem>
                  <SelectItem value="1a">1 Ano</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {variacao !== null && (
              <Badge variant="outline" className={getVariacaoColor()}>
                {getVariacaoIcon()}
                <span className="ml-1">
                  {variacao > 0 ? "+" : ""}{variacao.toFixed(2)}% no período
                </span>
              </Badge>
            )}
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Total de Alterações</p>
                <p className="text-2xl font-bold">{historico?.length || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Preço Inicial</p>
                <p className="text-lg font-bold">
                  {historico?.length ? formatarMoeda(historico[0].preco_anterior || historico[0].preco_novo || 0) : "-"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Preço Atual</p>
                <p className="text-lg font-bold text-primary">
                  {historico?.length ? formatarMoeda(historico[historico.length - 1].preco_novo || 0) : "-"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico */}
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              Carregando histórico...
            </div>
          ) : dadosGrafico.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Evolução do Preço</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={dadosGrafico}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="data" 
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                    />
                    <YAxis 
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => formatarMoeda(v)}
                      className="fill-muted-foreground"
                      width={80}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatarMoeda(value), ""]}
                      labelFormatter={(label, payload) => {
                        const item = payload?.[0]?.payload;
                        return `${item?.dataCompleta || label} - ${item?.tabela || ""}`;
                      }}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="precoNovo" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      name="Preço"
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground border rounded-lg">
              Nenhum histórico encontrado para este período
            </div>
          )}

          {/* Timeline */}
          {historico && historico.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Alterações Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {[...historico].reverse().slice(0, 10).map((item, index) => {
                    const variacao = item.preco_anterior && item.preco_anterior > 0
                      ? ((item.preco_novo - item.preco_anterior) / item.preco_anterior) * 100
                      : 0;
                    
                    return (
                      <div key={item.id || index} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-full ${variacao > 0 ? 'bg-red-100 text-red-600' : variacao < 0 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                            {variacao > 0 ? <TrendingUp className="h-3 w-3" /> : variacao < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {formatarMoeda(item.preco_anterior || 0)} → {formatarMoeda(item.preco_novo || 0)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.tabela?.nome || "Tabela"} • {format(new Date(item.data_alteracao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        {variacao !== 0 && (
                          <Badge variant={variacao > 0 ? "destructive" : "default"} className={variacao < 0 ? "bg-green-600" : ""}>
                            {variacao > 0 ? "+" : ""}{variacao.toFixed(1)}%
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
