import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { usePendingEvents } from "@/hooks/usePendingEvents";
import { AprovarEventoDialog } from "@/components/events/AprovarEventoDialog";
import { CorporateEvent } from "@/hooks/useCorporateEvents";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Calendar,
  Clock,
  DollarSign,
  User,
  FileCheck,
  Lock,
  Building
} from "lucide-react";

export default function EventsApprovalHub() {
  const { data: pendingEvents, isLoading } = usePendingEvents();
  const [selectedEvent, setSelectedEvent] = useState<CorporateEvent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const totalPending = pendingEvents?.length || 0;
  const totalBudgetRequested = pendingEvents?.reduce(
    (sum, event) => sum + (event.budget_amount || 0), 
    0
  ) || 0;

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      conferencia: "Conferência",
      workshop: "Workshop",
      feira: "Feira",
      interno: "Evento Interno",
      externo: "Evento Externo",
    };
    return labels[type] || type;
  };

  const handleReview = (event: CorporateEvent) => {
    setSelectedEvent(event);
    setDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleBreadcrumb
          moduleName="Eventos Corporativos"
          moduleHref="/dashboard/eventos"
          currentPage="Aprovações"
        />

        <div>
          <h1 className="text-3xl font-bold">Central de Aprovações de Eventos</h1>
          <p className="text-muted-foreground mt-1">
            Revise e aprove eventos pendentes
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Eventos Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{totalPending}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Valor Total Solicitado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">
                  R$ {totalBudgetRequested.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Eventos Pendentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Eventos Aguardando Aprovação
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : totalPending === 0 ? (
              <div className="text-center py-12">
                <FileCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhum evento pendente</h3>
                <p className="text-muted-foreground">
                  Todos os eventos foram processados
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Orçamento</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingEvents?.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          {event.confidential && (
                            <Lock className="h-3 w-3 text-amber-500" />
                          )}
                          {event.code}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{event.name}</div>
                            {event.location && (
                              <div className="text-xs text-muted-foreground">{event.location}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getEventTypeLabel(event.event_type)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {event.event_date 
                            ? format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })
                            : "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          R$ {(event.budget_amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {event.creator?.nome || "Não informado"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => handleReview(event)}>
                          Revisar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Aprovação */}
        <AprovarEventoDialog
          event={selectedEvent}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      </div>
    </DashboardLayout>
  );
}
