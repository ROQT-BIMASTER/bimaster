import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Package, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { NovaOrdemProducaoDialog } from "@/components/fabrica/NovaOrdemProducaoDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { TourButton } from "@/components/tour/TourButton";
import { FABRICA_ORDENS_TOUR_ID, fabricaOrdensTourSteps } from "@/components/tour/tours/fabricaOrdensTour";

export default function FabricaOrdensProducao() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: ordens, isLoading } = useQuery({
    queryKey: ["fabrica-ordens-producao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_ordens_producao")
        .select(`
          *,
          fabrica_produtos (nome, codigo),
          fabrica_formulas (versao)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pendente: { variant: "secondary", label: "Pendente" },
      em_producao: { variant: "default", label: "Em Produção" },
      concluida: { variant: "default", label: "Concluída", className: "bg-success" },
      cancelada: { variant: "destructive", label: "Cancelada" },
    };

    const config = variants[status] || variants.pendente;
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const calcularProgresso = (op: any) => {
    if (!op.quantidade_planejada) return 0;
    return (
      ((op.quantidade_produzida || 0) / op.quantidade_planejada) * 100
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div data-tour="ordens-header" className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Ordens de Produção
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie as ordens de produção
            </p>
          </div>
          <Button data-tour="ordens-nova" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Ordem
          </Button>
        </div>

        {/* KPIs */}
        <div data-tour="ordens-kanban" className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {ordens?.filter((o) => o.status === "pendente").length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Em Produção
              </CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {ordens?.filter((o) => o.status === "em_producao").length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {ordens?.filter((o) => o.status === "concluida").length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Taxa Conclusão
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {ordens && ordens.length > 0
                  ? Math.round(
                      (ordens.filter((o) => o.status === "concluida").length /
                        ordens.length) *
                        100
                    )
                  : 0}
                %
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Ordens */}
        <Card>
          <CardHeader>
            <CardTitle>Ordens de Produção</CardTitle>
          </CardHeader>
          <CardContent>
            {ordens && ordens.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead className="text-right">Planejado</TableHead>
                      <TableHead className="text-right">Produzido</TableHead>
                      <TableHead>Progresso</TableHead>
                      <TableHead>Data Prevista</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordens.map((op) => {
                      const progresso = calcularProgresso(op);

                      return (
                        <TableRow key={op.id}>
                          <TableCell className="font-medium">
                            {op.numero}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {op.fabrica_produtos?.nome}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {op.fabrica_produtos?.codigo}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{op.lote || "-"}</TableCell>
                          <TableCell className="text-right">
                            {op.quantidade_planejada}
                          </TableCell>
                          <TableCell className="text-right">
                            {op.quantidade_produzida || 0}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={progresso} className="w-20" />
                              <span className="text-sm font-medium">
                                {progresso.toFixed(0)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {op.data_prevista
                              ? new Date(op.data_prevista).toLocaleDateString(
                                  "pt-BR"
                                )
                              : "-"}
                          </TableCell>
                          <TableCell>{getStatusBadge(op.status)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              Ver Detalhes
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma ordem de produção cadastrada
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <NovaOrdemProducaoDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
      
      <TourButton 
        tourId={FABRICA_ORDENS_TOUR_ID}
        tourSteps={fabricaOrdensTourSteps}
        title="Tour de Ordens de Produção"
        description="Aprenda a gerenciar ordens e apontamentos"
      />
    </DashboardLayout>
  );
}
