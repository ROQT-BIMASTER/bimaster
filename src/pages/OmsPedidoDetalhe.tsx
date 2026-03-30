import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOmsPedidoDetalhe, useOmsUpdateStatus, OMS_STATUS_CONFIG, type OmsStatus } from "@/hooks/useOmsPedidos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Clock, Package, User, Building, CreditCard } from "lucide-react";
import { useState } from "react";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  recebido: ['credito_pendente', 'credito_aprovado', 'cancelado'],
  credito_pendente: ['credito_aprovado', 'rejeitado'],
  credito_aprovado: ['enviado_wms', 'cancelado'],
  enviado_wms: ['separando'],
  separando: ['faturado'],
  faturado: ['expedido'],
  expedido: ['entregue'],
};

export default function OmsPedidoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useOmsPedidoDetalhe(id);
  const updateStatus = useOmsUpdateStatus();
  const [novoStatus, setNovoStatus] = useState<string>("");

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Carregando pedido...
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Pedido não encontrado
        </div>
      </DashboardLayout>
    );
  }

  const { pedido, itens, statusLog } = data;
  const statusCfg = OMS_STATUS_CONFIG[pedido.status as OmsStatus] ?? OMS_STATUS_CONFIG.recebido;
  const transitions = ALLOWED_TRANSITIONS[pedido.status] ?? [];

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const handleStatusChange = () => {
    if (!novoStatus) return;
    updateStatus.mutate({ pedidoId: pedido.id, novoStatus: novoStatus as OmsStatus });
    setNovoStatus("");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title={`Pedido #${pedido.numero}`}
          description={`${pedido.cliente_nome || pedido.cliente_codigo} · ${statusCfg.label}`}
          backTo="/dashboard/oms"
          backLabel="Voltar ao Painel"
          badges={
            <Badge variant="outline" className={cn("text-sm", statusCfg.bgClass)}>
              {statusCfg.label}
            </Badge>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Info + Items */}
          <div className="lg:col-span-2 space-y-6">
            {/* Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados do Pedido</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Cliente</p>
                      <p className="font-medium">{pedido.cliente_nome || pedido.cliente_codigo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Vendedor</p>
                      <p className="font-medium">{pedido.vendedor_nome || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Valor Total</p>
                      <p className="font-bold text-lg">{formatCurrency(pedido.valor_total)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Canal</p>
                    <p className="font-medium capitalize">{pedido.canal_origem}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Criado em</p>
                    <p className="font-medium">{format(new Date(pedido.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  </div>
                  {pedido.observacao && (
                    <div className="col-span-full">
                      <p className="text-muted-foreground">Observação</p>
                      <p>{pedido.observacao}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Itens ({itens.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Preço Unit.</TableHead>
                      <TableHead className="text-right">Desc %</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Nenhum item
                        </TableCell>
                      </TableRow>
                    ) : (
                      itens.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="font-medium">{item.produto_nome || item.produto_codigo}</p>
                            <p className="text-xs text-muted-foreground">{item.produto_codigo}</p>
                          </TableCell>
                          <TableCell className="text-right">{item.quantidade}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.preco_unitario)}</TableCell>
                          <TableCell className="text-right">{item.desconto_percentual}%</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(item.valor_total)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Right: Status + Timeline */}
          <div className="space-y-6">
            {/* Status Change */}
            {transitions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Alterar Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select value={novoStatus} onValueChange={setNovoStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione novo status" />
                    </SelectTrigger>
                    <SelectContent>
                      {transitions.map((s) => {
                        const cfg = OMS_STATUS_CONFIG[s as OmsStatus];
                        return (
                          <SelectItem key={s} value={s}>{cfg?.label || s}</SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Button
                    className="w-full"
                    disabled={!novoStatus || updateStatus.isPending}
                    onClick={handleStatusChange}
                  >
                    {updateStatus.isPending ? "Atualizando..." : "Confirmar"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statusLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma transição registrada</p>
                ) : (
                  <div className="space-y-4">
                    {statusLog.map((log, i) => {
                      const cfg = OMS_STATUS_CONFIG[log.status_novo as OmsStatus];
                      return (
                        <div key={log.id} className="relative pl-6">
                          {i < statusLog.length - 1 && (
                            <div className="absolute left-[9px] top-6 w-px h-full bg-border" />
                          )}
                          <div className={cn("absolute left-0 top-1 w-[18px] h-[18px] rounded-full border-2 bg-card", cfg?.bgClass ? 'border-current' : 'border-border')} />
                          <div>
                            <p className="font-medium text-sm">{cfg?.label || log.status_novo}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                            </p>
                            {log.observacao && <p className="text-xs mt-1">{log.observacao}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
