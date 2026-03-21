import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ClipboardList, Package, MapPin, Hash, Truck, XCircle } from "lucide-react";
import { useMinhasSolicitacoes, type MaterialSolicitacaoStatus } from "@/hooks/useTradeMateriais";
import { formatRelativeTime } from "@/lib/formatters";

const statusConfig: Record<MaterialSolicitacaoStatus, { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" | "outline" | "ghost" }> = {
  pendente: { label: "Pendente", variant: "warning" },
  aprovado: { label: "Aprovado", variant: "success" },
  recusado: { label: "Recusado", variant: "destructive" },
  em_separacao: { label: "Em Separação", variant: "default" },
  enviado: { label: "Enviado", variant: "secondary" },
  entregue: { label: "Entregue", variant: "success" },
};

export default function MinhasSolicitacoes() {
  const { data: solicitacoes, isLoading } = useMinhasSolicitacoes();

  return (
    <DashboardLayout>
      <div className="space-y-4 pb-20 sm:pb-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard/trade">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Minhas Solicitações</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Acompanhe seus pedidos de materiais</p>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && (!solicitacoes || solicitacoes.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium">Nenhuma solicitação</p>
            <p className="text-sm text-muted-foreground mt-1">Você ainda não fez nenhuma solicitação de materiais.</p>
          </div>
        )}

        {/* List */}
        {solicitacoes && solicitacoes.length > 0 && (
          <div className="space-y-3">
            {solicitacoes.map((sol) => {
              const cfg = statusConfig[sol.status] || statusConfig.pendente;
              const protocolo = sol.obs_interna || sol.id.slice(0, 8).toUpperCase();
              const material = sol.trade_materiais;

              return (
                <Card key={sol.id} className="rounded-xl">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      {/* Material info */}
                      <div className="flex gap-3 flex-1 min-w-0">
                        {material?.foto_url ? (
                          <img
                            src={material.foto_url}
                            alt={material.nome}
                            className="h-14 w-14 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{material?.nome || "Material"}</p>
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                            <Hash className="h-3 w-3" />
                            <span className="font-mono">{protocolo}</span>
                          </div>
                          {sol.loja_nome && (
                            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{sol.loja_nome}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status badge */}
                      <Badge variant={cfg.variant} className="flex-shrink-0 text-[10px]">
                        {cfg.label}
                      </Badge>
                    </div>

                    {/* Footer info */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-muted-foreground">
                      <span>Qtd: {sol.quantidade}</span>
                      <span>{formatRelativeTime(sol.created_at)}</span>
                    </div>

                    {/* Rejection reason */}
                    {sol.status === "recusado" && sol.motivo_recusa && (
                      <div className="mt-2 flex items-start gap-1.5 text-xs text-destructive bg-destructive/10 rounded-lg p-2">
                        <XCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                        <span>{sol.motivo_recusa}</span>
                      </div>
                    )}

                    {/* Tracking code */}
                    {sol.codigo_rastreio && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-lg p-2">
                        <Truck className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>Rastreio: <span className="font-mono font-medium">{sol.codigo_rastreio}</span></span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
