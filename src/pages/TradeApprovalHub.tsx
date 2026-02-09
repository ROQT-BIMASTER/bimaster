import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, Target, FileText, Shield } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { AprovacaoCampanhaDialog } from "@/components/trade/campaigns/AprovacaoCampanhaDialog";
import { AprovarLancamentoDialog } from "@/components/trade/AprovarLancamentoDialog";
import { EnviarFinanceiroTradeDialog } from "@/components/trade/EnviarFinanceiroTradeDialog";
import { usePendingCampaigns, usePendingFinancialEntries, usePendingInvestments } from "@/hooks/useTradeData";
import { useQueryClient } from "@tanstack/react-query";
import { ApprovalKPICards } from "@/components/trade/approvals/ApprovalKPICards";
import { CampaignsApprovalTable } from "@/components/trade/approvals/CampaignsApprovalTable";
import { EntriesApprovalTable } from "@/components/trade/approvals/EntriesApprovalTable";
import { invalidateTradeApprovalQueries } from "@/lib/trade-utils";

export default function TradeApprovalHub() {
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [selectedEntryType, setSelectedEntryType] = useState<"entry" | "investment">("entry");
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [sendFinancialEntry, setSendFinancialEntry] = useState<any>(null);
  const [sendFinancialDialogOpen, setSendFinancialDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("campanhas");
  
  const { isAdminOrSupervisor, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading: campaignsLoading } = usePendingCampaigns();
  const { data: entries = [], isLoading: entriesLoading } = usePendingFinancialEntries();
  const { data: investments = [], isLoading: investmentsLoading } = usePendingInvestments();

  const isLoading = campaignsLoading || entriesLoading || investmentsLoading;

  useEffect(() => {
    if (roleLoading) return;
    
    if (!isAdminOrSupervisor) {
      toast.error("Acesso negado. Apenas supervisores e administradores podem aprovar itens.");
      navigate("/dashboard");
      return;
    }
  }, [isAdminOrSupervisor, roleLoading, navigate]);

  useEffect(() => {
    handleRefetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefetch = () => {
    invalidateTradeApprovalQueries(queryClient);
  };

  const handleCampaignClick = (campaign: any) => {
    setSelectedCampaign(campaign);
    setCampaignDialogOpen(true);
  };

  const handleEntryClick = (item: any, type: "entry" | "investment") => {
    setSelectedEntry(item);
    setSelectedEntryType(type);
    setEntryDialogOpen(true);
  };

  const metrics = useMemo(() => {
    const totalCampaignsCost = campaigns.reduce(
      (sum: number, c: any) => sum + parseFloat(String(c.estimated_cost || 0)), 
      0
    );
    const totalEntriesAmount = 
      entries.reduce((sum: number, e: any) => sum + parseFloat(String(e.amount || 0)), 0) +
      investments.reduce((sum: number, i: any) => sum + parseFloat(String(i.amount || 0)), 0);

    return {
      campaignsCount: campaigns.length,
      entriesCount: entries.length,
      investmentsCount: investments.length,
      totalCampaignsCost,
      totalEntriesAmount,
    };
  }, [campaigns, entries, investments]);

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
                <Shield className="h-8 w-8 text-primary" />
                Centro de Aprovações Trade
              </h1>
              <p className="text-muted-foreground mt-1">
                Revise e aprove campanhas, lançamentos e investimentos de Trade Marketing
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

        {/* KPI Cards */}
        <ApprovalKPICards {...metrics} />

        {/* Tabs com conteúdo */}
        <Card className="overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="border-b px-4">
              <TabsList className="h-12 bg-transparent gap-2">
                <TabsTrigger 
                  value="campanhas" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2"
                >
                  <Target className="h-4 w-4" />
                  Campanhas
                  {metrics.campaignsCount > 0 && (
                    <span className="ml-1 bg-orange-500 text-white text-xs rounded-full px-2 py-0.5">
                      {metrics.campaignsCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="lancamentos"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Lançamentos
                  {(metrics.entriesCount + metrics.investmentsCount) > 0 && (
                    <span className="ml-1 bg-orange-500 text-white text-xs rounded-full px-2 py-0.5">
                      {metrics.entriesCount + metrics.investmentsCount}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="campanhas" className="m-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Carregando campanhas pendentes...
                </div>
              ) : (
                <CampaignsApprovalTable 
                  campaigns={campaigns}
                  onReviewClick={handleCampaignClick}
                />
              )}
            </TabsContent>

            <TabsContent value="lancamentos" className="m-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Carregando lançamentos pendentes...
                </div>
              ) : (
                <EntriesApprovalTable 
                  entries={entries}
                  investments={investments}
                  onReviewClick={handleEntryClick}
                />
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      {/* Dialogs */}
      {selectedCampaign && (
        <AprovacaoCampanhaDialog
          open={campaignDialogOpen}
          onOpenChange={setCampaignDialogOpen}
          campaign={selectedCampaign}
          onSuccess={handleRefetch}
        />
      )}

      {selectedEntry && (
        <AprovarLancamentoDialog
          open={entryDialogOpen}
          onOpenChange={setEntryDialogOpen}
          entry={selectedEntry}
          type={selectedEntryType}
          onSuccess={handleRefetch}
          onApproveAndSend={(entry) => {
            setSendFinancialEntry(entry);
            setSendFinancialDialogOpen(true);
          }}
        />
      )}

      {sendFinancialEntry && (
        <EnviarFinanceiroTradeDialog
          entry={sendFinancialEntry}
          open={sendFinancialDialogOpen}
          onOpenChange={setSendFinancialDialogOpen}
          onSuccess={handleRefetch}
        />
      )}
    </DashboardLayout>
  );
}
