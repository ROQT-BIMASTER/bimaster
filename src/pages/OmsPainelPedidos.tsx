import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart, DollarSign, Clock, CheckCircle, XCircle, Search, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { useOmsPedidos, useOmsKpis, OMS_STATUS_CONFIG, type OmsStatus } from "@/hooks/useOmsPedidos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todos os Status" },
  { value: "recebido", label: "Recebido" },
  { value: "credito_pendente", label: "Crédito Pendente" },
  { value: "credito_aprovado", label: "Crédito Aprovado" },
  { value: "enviado_wms", label: "Enviado WMS" },
  { value: "separando", label: "Separando" },
  { value: "faturado", label: "Faturado" },
  { value: "expedido", label: "Expedido" },
  { value: "entregue", label: "Entregue" },
  { value: "rejeitado", label: "Rejeitado" },
  { value: "cancelado", label: "Cancelado" },
];

export default function OmsPainelPedidos() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const { data: kpis, isLoading: kpisLoading } = useOmsKpis();
  const { data: pedidosData, isLoading } = useOmsPedidos({
    status: statusFilter === "all" ? null : (statusFilter as OmsStatus),
    search: search || undefined,
    page,
    pageSize,
  });

  const pedidos = pedidosData?.data ?? [];
  const totalCount = pedidosData?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="OMS — Gestão de Pedidos"
          description="Painel de acompanhamento de pedidos com visão operacional"
        />

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiCard
            title="Total Pedidos"
            value={kpis?.total ?? 0}
            icon={ShoppingCart}
            variant="info"
          />
          <KpiCard
            title="Valor Total"
            value={formatCurrency(kpis?.valorTotal ?? 0)}
            icon={DollarSign}
            variant="default"
          />
          <KpiCard
            title="Pendentes"
            value={kpis?.pendentes ?? 0}
            icon={Clock}
            variant="warning"
          />
          <KpiCard
            title="Faturados"
            value={kpis?.faturados ?? 0}
            icon={CheckCircle}
            variant="success"
          />
          <KpiCard
            title="Cancelados"
            value={kpis?.cancelados ?? 0}
            icon={XCircle}
            variant="destructive"
          />
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nº, cliente ou código..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Nº</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      Carregando pedidos...
                    </TableCell>
                  </TableRow>
                ) : pedidos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      Nenhum pedido encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  pedidos.map((pedido) => {
                    const statusCfg = OMS_STATUS_CONFIG[pedido.status as OmsStatus] ?? OMS_STATUS_CONFIG.recebido;
                    return (
                      <TableRow
                        key={pedido.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/dashboard/oms/pedidos/${pedido.id}`)}
                      >
                        <TableCell className="font-mono font-medium">{pedido.numero}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium truncate max-w-[200px]">{pedido.cliente_nome || pedido.cliente_codigo}</p>
                            <p className="text-xs text-muted-foreground">{pedido.cliente_codigo}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{pedido.vendedor_nome || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-xs", statusCfg.bgClass)}>
                            {statusCfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(pedido.valor_total)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground capitalize">{pedido.canal_origem}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(pedido.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-muted-foreground">
                  {totalCount} pedidos · Página {page + 1} de {totalPages}
                </p>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
