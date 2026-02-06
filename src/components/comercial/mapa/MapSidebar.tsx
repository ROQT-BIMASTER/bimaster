import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, DollarSign, AlertTriangle, TrendingUp, Eye } from "lucide-react";
import type { MapCliente, MapProspect } from "@/hooks/useCommercialMapData";

interface MapSidebarProps {
  clientes: MapCliente[];
  prospects: MapProspect[];
  visibleClientes: MapCliente[];
  visibleProspects: MapProspect[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);

export const MapSidebar = ({ clientes, prospects, visibleClientes, visibleProspects }: MapSidebarProps) => {
  const stats = useMemo(() => {
    const total = visibleClientes.length;
    const ativos = visibleClientes.filter(c => c.risco === "ativo").length;
    const atencao = visibleClientes.filter(c => c.risco === "atencao").length;
    const alerta = visibleClientes.filter(c => c.risco === "alerta").length;
    const critico = visibleClientes.filter(c => c.risco === "critico").length;
    const inativos = visibleClientes.filter(c => c.risco === "inativo").length;

    const potencial = visibleClientes.reduce((sum, c) => sum + (c.valor_ultima_compra || 0), 0);
    const topClientes = [...visibleClientes]
      .sort((a, b) => (b.valor_ultima_compra || 0) - (a.valor_ultima_compra || 0))
      .slice(0, 5);

    return { total, ativos, atencao, alerta, critico, inativos, potencial, topClientes };
  }, [visibleClientes]);

  return (
    <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-200px)]">
      {/* Viewport Summary */}
      <Card className="border-primary/20">
        <CardHeader className="p-3 pb-1">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Área Visível
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center p-2 bg-muted/50 rounded">
              <p className="text-lg font-bold">{stats.total}</p>
              <p className="text-[10px] text-muted-foreground">Clientes</p>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded">
              <p className="text-lg font-bold">{visibleProspects.length}</p>
              <p className="text-[10px] text-muted-foreground">Prospects</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Potential */}
      <Card>
        <CardHeader className="p-3 pb-1">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-green-500" />
            Potencial
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-1">
          <p className="text-lg font-bold text-green-600">{formatCurrency(stats.potencial)}</p>
          <p className="text-[10px] text-muted-foreground">Soma última compra (viewport)</p>
        </CardContent>
      </Card>

      {/* Risk Distribution */}
      <Card>
        <CardHeader className="p-3 pb-1">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
            Risco
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-1 space-y-1.5">
          {stats.total > 0 ? (
            <>
              <RiskBar label="Ativo" count={stats.ativos} total={stats.total} color="bg-green-500" />
              <RiskBar label="Atenção" count={stats.atencao} total={stats.total} color="bg-yellow-500" />
              <RiskBar label="Alerta" count={stats.alerta} total={stats.total} color="bg-orange-500" />
              <RiskBar label="Crítico" count={stats.critico} total={stats.total} color="bg-red-500" />
              <RiskBar label="Inativo" count={stats.inativos} total={stats.total} color="bg-gray-500" />
            </>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">Sem dados na viewport</p>
          )}
        </CardContent>
      </Card>

      {/* Top Clients */}
      {stats.topClientes.length > 0 && (
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
              Top 5 (viewport)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="space-y-1.5">
              {stats.topClientes.map((c, idx) => (
                <div key={c.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-muted-foreground font-mono">{idx + 1}.</span>
                    <span className="truncate max-w-[120px]">{c.nome}</span>
                  </div>
                  <span className="font-medium text-green-600 whitespace-nowrap">
                    {formatCurrency(c.valor_ultima_compra || 0)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Global Stats */}
      <Card className="bg-muted/30">
        <CardHeader className="p-3 pb-1">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Total Geral
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-1">
          <div className="grid grid-cols-2 gap-1 text-xs">
            <div>
              <span className="text-muted-foreground">Clientes:</span>{" "}
              <span className="font-medium">{clientes.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Prospects:</span>{" "}
              <span className="font-medium">{prospects.length}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

function RiskBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${color} shrink-0`} />
      <span className="text-xs w-14 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
    </div>
  );
}
