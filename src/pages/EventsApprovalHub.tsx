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
import { usePendingEventExpenses, type EventWithPendingExpenses } from "@/hooks/usePendingEventExpenses";
import { AprovarEventoDialog } from "@/components/events/AprovarEventoDialog";
import { AprovarDespesasEventoDialog } from "@/components/events/AprovarDespesasEventoDialog";
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
  Building,
  Receipt,
} from "lucide-react";

export default function EventsApprovalHub() {
  const { data: pendingEvents, isLoading: loadingEvents } = usePendingEvents();
  const { data: pendingExpenseGroups, isLoading: loadingExpenses } = usePendingEventExpenses();

  const [selectedEvent, setSelectedEvent] = useState<CorporateEvent | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);

  const [selectedExpenseGroup, setSelectedExpenseGroup] = useState<EventWithPendingExpenses | null>(null);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);

  const totalPendingEvents = pendingEvents?.length || 0;
  const totalBudgetRequested = pendingEvents?.reduce(
    (sum, event) => sum + (event.budget_amount || 0), 
    0
  ) || 0;

  const totalPendingExpenses = pendingExpenseGroups?.reduce(
    (sum, group) => sum + group.total_pending, 0
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

  const handleReviewEvent = (event: CorporateEvent) => {
    setSelectedEvent(event);
    setEventDialogOpen(true);
  };

  const handleReviewExpenses = (group: EventWithPendingExpenses) => {
    setSelectedExpenseGroup(group);
    setExpenseDialogOpen(true);
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
            Revise e aprove eventos e despesas pendentes
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Eventos Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{totalPendingEvents}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Despesas Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{totalPendingExpenses}</span>
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

        {/* Seção 1: Eventos Aguardando Aprovação de Verba */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Eventos Aguardando Aprovação de Verba
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEvents ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : totalPendingEvents === 0 ? (
              <div className="text-center py-8">
                <FileCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <h3 className="text-sm font-medium">Nenhum evento pendente de aprovação</h3>
                <p className="text-xs text-muted-foreground">
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
                            <Lock className="h-3 w-3 text-destructive" />
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
                        <Button size="sm" onClick={() => handleReviewEvent(event)}>
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

        {/* Seção 2: Eventos com Despesas Pendentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Eventos com Despesas Pendentes de Aprovação
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingExpenses ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !pendingExpenseGroups || pendingExpenseGroups.length === 0 ? (
              <div className="text-center py-8">
                <Receipt className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <h3 className="text-sm font-medium">Nenhuma despesa pendente</h3>
                <p className="text-xs text-muted-foreground">
                  Todas as despesas dos eventos foram revisadas
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Despesas Pendentes</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingExpenseGroups.map((group) => (
                    <TableRow key={group.event_id}>
                      <TableCell className="font-mono text-sm">
                        {group.event_code}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{group.event_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {group.total_pending} despesa(s)
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          R$ {group.total_value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => handleReviewExpenses(group)}>
                          Revisar Despesas
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialogs */}
        <AprovarEventoDialog
          event={selectedEvent}
          open={eventDialogOpen}
          onOpenChange={setEventDialogOpen}
        />
        <AprovarDespesasEventoDialog
          eventGroup={selectedExpenseGroup}
          open={expenseDialogOpen}
          onOpenChange={setExpenseDialogOpen}
        />
      </div>
    </DashboardLayout>
  );
}
