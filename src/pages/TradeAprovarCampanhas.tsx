import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Target, AlertCircle, RefreshCw, Calendar, DollarSign, Users } from "lucide-react";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";
import { AprovacaoCampanhaDialog } from "@/components/trade/campaigns/AprovacaoCampanhaDialog";
import { usePendingCampaigns } from "@/hooks/useTradeData";
import { useQueryClient } from "@tanstack/react-query";

export default function TradeAprovarCampanhas() {
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const { isAdminOrSupervisor, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading } = usePendingCampaigns();

  useEffect(() => {
    if (roleLoading) return;
    
    if (!isAdminOrSupervisor) {
      toast.error("Acesso negado. Apenas supervisores e administradores podem aprovar campanhas.");
      navigate("/dashboard");
      return;
    }
  }, [isAdminOrSupervisor, roleLoading, navigate]);

  // Forçar refetch ao montar
  useEffect(() => {
    handleRefetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefetch = () => {
    queryClient.invalidateQueries({ queryKey: ['trade-pending-campaigns'] });
  };

  const handleCampaignClick = (campaign: any) => {
    setSelectedCampaign(campaign);
    setCampaignDialogOpen(true);
  };

  const getCampaignTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      sell_in: "Sell-In",
      sell_out: "Sell-Out",
      institucional: "Institucional",
      cooperada: "Cooperada",
      mdf: "MDF",
      midia: "Mídia",
      incentivo: "Incentivo",
      degustacao: "Degustação",
      bonificacao: "Bonificação",
    };
    return labels[type] || type;
  };

  const { pendingCount, totalEstimatedCost, withBudgetCount, withoutBudgetCount } = useMemo(() => {
    const withBudget = campaigns.filter((c: any) => c.budget_id);
    const withoutBudget = campaigns.filter((c: any) => !c.budget_id);
    
    return {
      pendingCount: campaigns.length,
      totalEstimatedCost: campaigns.reduce((sum: number, c: any) => sum + parseFloat(String(c.estimated_cost || 0)), 0),
      withBudgetCount: withBudget.length,
      withoutBudgetCount: withoutBudget.length,
    };
  }, [campaigns]);

  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-muted-foreground">Verificando permissões...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard/trade">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Target className="h-8 w-8 text-primary" />
                Aprovar Campanhas de Trade
              </h1>
              <p className="text-muted-foreground mt-1">
                Revise e aprove as campanhas de Trade Marketing pendentes
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              handleRefetch();
              toast.success("Dados atualizados!");
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <AlertCircle className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Custo Total Estimado</p>
                <p className="text-2xl font-bold">
                  R$ {totalEstimatedCost.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Com Verba</p>
                <p className="text-2xl font-bold">{withBudgetCount}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500/10 rounded-lg">
                <Users className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sem Verba</p>
                <p className="text-2xl font-bold">{withoutBudgetCount}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabela de Campanhas */}
        <Card>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Carregando campanhas pendentes...
            </div>
          ) : pendingCount === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
              <p className="text-lg font-semibold mb-2">Nenhuma campanha pendente</p>
              <p className="text-sm">Todas as campanhas de Trade foram processadas</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Verba</TableHead>
                  <TableHead className="text-right">Custo Estimado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign: any) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {campaign.code}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {campaign.created_by_profile?.nome || "N/A"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {campaign.created_by_profile?.email || ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getCampaignTypeLabel(campaign.campaign_type)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate font-medium" title={campaign.name}>
                        {campaign.name}
                      </div>
                      {campaign.description && (
                        <div className="truncate text-xs text-muted-foreground" title={campaign.description}>
                          {campaign.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(campaign.start_date), "dd/MM/yy")} - {format(new Date(campaign.end_date), "dd/MM/yy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      {campaign.budget ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                          {campaign.budget.code}
                        </span>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          Sem verba
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap">
                      R$ {parseFloat(String(campaign.estimated_cost || 0)).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleCampaignClick(campaign)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Revisar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {selectedCampaign && (
        <AprovacaoCampanhaDialog
          open={campaignDialogOpen}
          onOpenChange={setCampaignDialogOpen}
          campaign={selectedCampaign}
          onSuccess={handleRefetch}
        />
      )}
    </DashboardLayout>
  );
}
