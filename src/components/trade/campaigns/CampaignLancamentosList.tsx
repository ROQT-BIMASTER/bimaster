import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Building2,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  CheckCircle,
  XCircle,
  ListFilter,
  ChevronRight,
  Download,
  Upload
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { CampaignLancamentoForm } from "./CampaignLancamentoForm";
import { CampaignLancamentoExport } from "./CampaignLancamentoExport";
import { CampaignLancamentoImport } from "./CampaignLancamentoImport";

interface Campaign {
  id: string;
  code: string;
  name: string;
  campaign_type: string;
  start_date: string;
  end_date: string;
  estimated_cost: number;
  actual_cost?: number | null;
  verba_prevista: number;
  verba_orcada: number;
}

interface Lancamento {
  id: string;
  campaign_id: string;
  customer_id: string | null;
  data_lancamento: string;
  valor_pedido: number;
  tipo_brinde: string | null;
  sell_out_anterior: number;
  sell_out_atual: number;
  crescimento_percentual: number | null;
  roi_percentual: number | null;
  status: string;
  created_at: string;
  cliente_nome?: string;
}

interface CampaignLancamentosListProps {
  campaign: Campaign;
  onSelectLancamento?: (lancamentoId: string) => void;
}

export function CampaignLancamentosList({ campaign, onSelectLancamento }: CampaignLancamentosListProps) {
  const queryClient = useQueryClient();
  const { isAdminOrSupervisor } = useUserRole();
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingLancamentoId, setEditingLancamentoId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [lancamentoToDelete, setLancamentoToDelete] = useState<string | null>(null);

  // Fetch lancamentos for this campaign - filtered by user's clients if not admin/supervisor
  const { data: lancamentos, isLoading } = useQuery({
    queryKey: ["campaign-lancamentos", campaign.id, isAdminOrSupervisor],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // First, get the user's clients (prospects) if not admin/supervisor
      let userClientIds: string[] = [];
      if (!isAdminOrSupervisor) {
        const { data: userClients } = await supabase
          .from("prospects")
          .select("id")
          .eq("vendedor_id", user.id);
        
        userClientIds = userClients?.map(c => c.id) || [];
        
        // If vendedor has no clients, return empty
        if (userClientIds.length === 0) {
          return [];
        }
      }

      const { data: lancamentosData, error } = await supabase
        .from("trade_campaign_lancamentos")
        .select("*")
        .eq("campaign_id", campaign.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter by user's clients if not admin/supervisor
      let filteredLancamentos = lancamentosData || [];
      if (!isAdminOrSupervisor && userClientIds.length > 0) {
        filteredLancamentos = lancamentosData?.filter(l => 
          l.customer_id && userClientIds.includes(l.customer_id)
        ) || [];
      }

      // Fetch customer names
      const customerIds = filteredLancamentos
        ?.map(l => l.customer_id)
        .filter(Boolean) as string[];
      
      let customersMap = new Map<string, string>();
      
      if (customerIds.length > 0) {
        const { data: prospects } = await supabase
          .from("prospects")
          .select("id, nome_empresa")
          .in("id", customerIds);
        
        customersMap = new Map(
          prospects?.map(p => [p.id, p.nome_empresa]) || []
        );
      }

      return filteredLancamentos?.map(l => ({
        ...l,
        cliente_nome: l.customer_id ? customersMap.get(l.customer_id) || "Cliente não encontrado" : "Sem cliente",
      })) as Lancamento[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (lancamentoId: string) => {
      const { error } = await supabase
        .from("trade_campaign_lancamentos")
        .delete()
        .eq("id", lancamentoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-lancamentos"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-lancamentos-selector"] });
      toast.success("Lançamento excluído com sucesso");
      setDeleteDialogOpen(false);
      setLancamentoToDelete(null);
    },
    onError: (error) => {
      console.error("Error deleting lancamento:", error);
      toast.error("Erro ao excluir lançamento");
    },
  });

  const handleNewLancamento = () => {
    setEditingLancamentoId(null);
    setFormDialogOpen(true);
  };

  const handleEditLancamento = (lancamentoId: string) => {
    // Only allow editing own lancamentos if not admin
    if (!isAdminOrSupervisor) {
      const lancamento = lancamentos?.find(l => l.id === lancamentoId);
      if (!lancamento) {
        toast.error("Lançamento não encontrado");
        return;
      }
    }
    setEditingLancamentoId(lancamentoId);
    setFormDialogOpen(true);
  };

  const handleDeleteLancamento = (lancamentoId: string) => {
    if (!isAdminOrSupervisor) {
      toast.error("Apenas administradores podem excluir lançamentos");
      return;
    }
    setLancamentoToDelete(lancamentoId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (lancamentoToDelete) {
      deleteMutation.mutate(lancamentoToDelete);
    }
  };

  const handleSelectLancamento = (lancamentoId: string) => {
    onSelectLancamento?.(lancamentoId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge variant="default" className="bg-green-600 hover:bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Aprovado
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejeitado
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
    }
  };

  const renderTrend = (crescimento: number | null) => {
    if (crescimento == null) return <Minus className="h-4 w-4 text-muted-foreground" />;
    
    if (crescimento > 0) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm font-medium">+{crescimento.toFixed(1)}%</span>
        </div>
      );
    }
    
    if (crescimento < 0) {
      return (
        <div className="flex items-center gap-1 text-red-600">
          <TrendingDown className="h-4 w-4" />
          <span className="text-sm font-medium">{crescimento.toFixed(1)}%</span>
        </div>
      );
    }
    
    return <span className="text-sm text-muted-foreground">0%</span>;
  };

  // Calculate summary
  const summary = {
    total: lancamentos?.length || 0,
    pending: lancamentos?.filter(l => l.status === "pending").length || 0,
    approved: lancamentos?.filter(l => l.status === "approved").length || 0,
    totalValor: lancamentos?.reduce((acc, l) => acc + (l.valor_pedido || 0), 0) || 0,
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ListFilter className="h-5 w-5" />
                Lançamentos da Campanha
              </CardTitle>
              <CardDescription>
                {summary.total} lançamento(s) • {summary.pending} pendente(s) • {summary.approved} aprovado(s)
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setExportDialogOpen(true)} className="gap-2">
                <Download className="h-4 w-4" />
                Exportar Modelo
              </Button>
              <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="gap-2">
                <Upload className="h-4 w-4" />
                Importar Planilha
              </Button>
              <Button onClick={handleNewLancamento} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Lançamento
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {lancamentos && lancamentos.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor Pedido</TableHead>
                    <TableHead>Brinde</TableHead>
                    <TableHead className="text-right">Sell Out Ant.</TableHead>
                    <TableHead className="text-right">Sell Out Atual</TableHead>
                    <TableHead>Crescimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lancamentos.map((lancamento) => (
                    <TableRow 
                      key={lancamento.id} 
                      className="cursor-pointer hover:bg-primary/5"
                      onClick={() => handleSelectLancamento(lancamento.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{lancamento.cliente_nome}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(lancamento.data_lancamento), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(lancamento.valor_pedido)}
                      </TableCell>
                      <TableCell>
                        {lancamento.tipo_brinde ? (
                          <Badge variant="outline">{lancamento.tipo_brinde}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(lancamento.sell_out_anterior)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(lancamento.sell_out_atual)}
                      </TableCell>
                      <TableCell>
                        {renderTrend(lancamento.crescimento_percentual)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(lancamento.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectLancamento(lancamento.id);
                            }}
                            title="Selecionar e continuar"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditLancamento(lancamento.id)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              {isAdminOrSupervisor && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => handleDeleteLancamento(lancamento.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">Nenhum lançamento ainda</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Registre a execução da campanha em diferentes clientes/PDVs
              </p>
              <Button onClick={handleNewLancamento} className="gap-2">
                <Plus className="h-4 w-4" />
                Criar Primeiro Lançamento
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLancamentoId ? "Editar Lançamento" : "Novo Lançamento"}
            </DialogTitle>
          </DialogHeader>
          <CampaignLancamentoForm
            campaign={campaign}
            lancamentoId={editingLancamentoId}
            onSuccess={() => {
              setFormDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ["campaign-lancamentos-selector"] });
            }}
            onCancel={() => setFormDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lançamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Dialog */}
      <CampaignLancamentoExport
        campaignId={campaign.id}
        campaignName={campaign.name}
        campaignCode={campaign.code}
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
      />

      {/* Import Dialog */}
      <CampaignLancamentoImport
        campaignId={campaign.id}
        campaignName={campaign.name}
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
    </>
  );
}
