import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useCorporateEvents } from "@/hooks/useCorporateEvents";
import { NovoEventoDialog } from "@/components/events/NovoEventoDialog";
import { SolicitarVerbaEventoDialog } from "@/components/events/SolicitarVerbaEventoDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Plus, 
  Search, 
  Calendar, 
  DollarSign, 
  Clock,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  Eye,
  Building,
  Lock,
  TrendingUp,
  Wallet,
  FileCheck
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { usePendingEvents } from "@/hooks/usePendingEvents";

export default function CorporateEvents() {
  const navigate = useNavigate();
  const { events, isLoading } = useCorporateEvents();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [solicitarVerbaOpen, setSolicitarVerbaOpen] = useState(false);
  const { isAdminOrSupervisor } = useUserRole();
  const { data: pendingEvents } = usePendingEvents();
  const pendingCount = pendingEvents?.length || 0;

  const filteredEvents = events.filter(event =>
    event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: any; label: string; icon: any }> = {
      draft: { variant: "outline", label: "Rascunho", icon: Clock },
      pending_approval: { variant: "secondary", label: "Aguardando Aprovação", icon: Clock },
      approved: { variant: "default", label: "Aprovado", icon: CheckCircle },
      in_progress: { variant: "default", label: "Em Andamento", icon: TrendingUp },
      completed: { variant: "secondary", label: "Concluído", icon: CheckCircle },
      cancelled: { variant: "destructive", label: "Cancelado", icon: XCircle },
    };

    const { variant, label, icon: Icon } = config[status] || config.draft;

    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

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

  // Métricas
  const totalEvents = events.length;
  const activeEvents = events.filter(e => e.status === "approved" || e.status === "in_progress").length;
  const totalBudget = events.reduce((sum, e) => sum + (e.budget_amount || 0), 0);
  const totalCost = events.reduce((sum, e) => sum + (e.actual_cost || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleBreadcrumb
          moduleName="Eventos Corporativos"
          moduleHref="/dashboard/eventos"
          currentPage="Gestão de Eventos"
        />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Eventos Corporativos</h1>
            <p className="text-muted-foreground mt-1">
              Gestão de eventos com controle de orçamento e despesas
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/dashboard/eventos/dashboard")}>
              <TrendingUp className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            {isAdminOrSupervisor && (
              <Button variant="outline" onClick={() => navigate("/dashboard/eventos/aprovacoes")} className="relative">
                <FileCheck className="mr-2 h-4 w-4" />
                Aprovações
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </Button>
            )}
            <Button variant="outline" onClick={() => setSolicitarVerbaOpen(true)}>
              <Wallet className="mr-2 h-4 w-4" />
              Solicitar Verba
            </Button>
            <NovoEventoDialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Evento
              </Button>
            </NovoEventoDialog>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Eventos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{totalEvents}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Eventos Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                <span className="text-2xl font-bold">{activeEvents}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Orçamento Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">
                  R$ {totalBudget.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Custo Realizado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-amber-500" />
                <span className="text-2xl font-bold">
                  R$ {totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtro e Tabela */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Lista de Eventos</CardTitle>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar eventos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhum evento encontrado</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? "Tente ajustar sua busca" : "Crie um novo evento para começar"}
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
                    <TableHead>Custo Real</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow key={event.id} className="cursor-pointer hover:bg-muted/50">
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
                      <TableCell>{getEventTypeLabel(event.event_type)}</TableCell>
                      <TableCell>
                        {event.event_date && format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })}
                        {event.end_date && event.end_date !== event.event_date && (
                          <span className="text-muted-foreground">
                            {" - "}{format(new Date(event.end_date), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        R$ {(event.budget_amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <span className={event.actual_cost > event.budget_amount ? "text-destructive font-medium" : ""}>
                          R$ {(event.actual_cost || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(event.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/dashboard/eventos/${event.id}`)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver Detalhes
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Solicitação de Verba */}
        <SolicitarVerbaEventoDialog
          open={solicitarVerbaOpen}
          onOpenChange={setSolicitarVerbaOpen}
          onSuccess={() => {}}
        />
      </div>
    </DashboardLayout>
  );
}
