import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Factory, 
  Package, 
  Layers, 
  ClipboardList, 
  DollarSign, 
  Percent, 
  AlertTriangle,
  TableIcon,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";
import type { FabricaKPIs } from "@/hooks/useFabricaExecutiveDashboard";

interface Props {
  kpis: FabricaKPIs | undefined;
  isLoading: boolean;
}

export function FabricaExecutiveKPIs({ kpis, isLoading }: Props) {
  if (isLoading || !kpis) {
    return (
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-8 bg-muted rounded w-16 mb-2" />
              <div className="h-4 bg-muted rounded w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const getMargemStatus = (margem: number) => {
    if (margem >= 25) return { label: "Saudável", color: "default", icon: TrendingUp };
    if (margem >= 15) return { label: "Moderada", color: "secondary", icon: Minus };
    return { label: "Crítica", color: "destructive", icon: TrendingDown };
  };

  const margemStatus = getMargemStatus(kpis.margemMediaGeral);
  const MargemIcon = margemStatus.icon;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);
  };

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {/* Linha 1: Cadastros */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Produtos Ativos</CardTitle>
          <Factory className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.totalProdutos}</div>
          <p className="text-xs text-muted-foreground">Produtos acabados</p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-amber-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Matérias-Primas</CardTitle>
          <Package className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.totalMPs}</div>
          <p className="text-xs text-muted-foreground">MPs ativas</p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-indigo-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Fórmulas BOM</CardTitle>
          <Layers className="h-4 w-4 text-indigo-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.formulasAtivas}</div>
          <p className="text-xs text-muted-foreground">Fórmulas ativas</p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-orange-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">OPs em Andamento</CardTitle>
          <ClipboardList className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.opsAtivas}</div>
          <p className="text-xs text-muted-foreground">Ordens de produção</p>
        </CardContent>
      </Card>

      {/* Linha 2: Custos e Margens */}
      <Card className="border-l-4 border-l-green-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Custo Médio</CardTitle>
          <DollarSign className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(kpis.custoMedioProducao)}</div>
          <p className="text-xs text-muted-foreground">Por produto</p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-primary">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Margem Média</CardTitle>
          <MargemIcon className={`h-4 w-4 ${
            margemStatus.label === 'Saudável' ? 'text-green-500' : 
            margemStatus.label === 'Crítica' ? 'text-red-500' : 'text-yellow-500'
          }`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.margemMediaGeral.toFixed(1)}%</div>
          <Badge 
            variant={margemStatus.color as any} 
            className="mt-1"
          >
            {margemStatus.label}
          </Badge>
        </CardContent>
      </Card>

      <Card className={`border-l-4 ${kpis.produtosCriticos > 0 ? 'border-l-red-500' : 'border-l-green-500'}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Margem Crítica</CardTitle>
          <AlertTriangle className={`h-4 w-4 ${kpis.produtosCriticos > 0 ? 'text-red-500' : 'text-green-500'}`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.produtosCriticos}</div>
          <p className="text-xs text-muted-foreground">Produtos {"<"} 10% margem</p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-purple-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tabelas de Preço</CardTitle>
          <TableIcon className="h-4 w-4 text-purple-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.tabelasAtivas}</div>
          <p className="text-xs text-muted-foreground">Tabelas ativas</p>
        </CardContent>
      </Card>
    </div>
  );
}
