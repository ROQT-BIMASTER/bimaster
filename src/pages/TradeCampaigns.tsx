import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Target, TrendingUp, Clock, CheckCircle, XCircle, Eye, Users, List, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { sanitizeText, sanitizeCode, getSafeErrorMessage } from "@/lib/utils/sanitize";
import { CampaignClientTable } from "@/components/trade/campaigns/CampaignClientTable";
import { CampaignResultsPanel } from "@/components/trade/campaigns/CampaignResultsPanel";
import { useUserRole } from "@/hooks/useUserRole";

export default function TradeCampaigns() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCampaignType, setSelectedCampaignType] = useState("");
  const [selectedBudget, setSelectedBudget] = useState("");
  const [selectedResponsible, setSelectedResponsible] = useState("");
  const { isAdmin, isAdminOrSupervisor } = useUserRole();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [campaignsRes, budgetsRes, storesRes, usersRes] = await Promise.all([
        supabase
          .from("trade_campaigns")
          .select(`
            *,
            budget:trade_budgets(name, code, available_amount)
          `)
          .order("created_at", { ascending: false }),
        supabase
          .from("trade_budgets")
          .select("*")
          .eq("status", "active")
          .order("name"),
        supabase
          .from("stores")
          .select("id, name, code")
          .eq("status", "active")
          .order("name"),
        supabase
          .from("profiles")
          .select("id, nome")
          .order("nome"),
      ]);

      if (campaignsRes.data) setCampaigns(campaignsRes.data);
      if (budgetsRes.data) setBudgets(budgetsRes.data);
      if (storesRes.data) setStores(storesRes.data);
      if (usersRes.data) setUsers(usersRes.data);
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const code = sanitizeCode(formData.get("code") as string);
      const name = sanitizeText(formData.get("name") as string);
      const description = sanitizeText(formData.get("description") as string || "");
      const campaign_type = formData.get("campaign_type") as string;
      const budget_id = formData.get("budget_id") as string || null;
      const estimated_cost = parseFloat(formData.get("estimated_cost") as string);
      const target_revenue = formData.get("target_revenue") ? parseFloat(formData.get("target_revenue") as string) : null;
      const start_date = formData.get("start_date") as string;
      const end_date = formData.get("end_date") as string;
      const region = sanitizeText(formData.get("region") as string || "");
      const responsible_user_id = formData.get("responsible_user_id") as string;

      // Validações
      if (!code || code.length < 3) throw new Error("Código deve ter no mínimo 3 caracteres");
      if (!name || name.length < 5) throw new Error("Nome deve ter no mínimo 5 caracteres");
      if (!campaign_type) throw new Error("Tipo de campanha é obrigatório");
      if (!responsible_user_id) throw new Error("Responsável é obrigatório");
      if (!estimated_cost || estimated_cost <= 0) throw new Error("Custo estimado deve ser maior que zero");
      if (new Date(end_date) <= new Date(start_date)) {
        throw new Error("Data de fim deve ser posterior à data de início");
      }

      const { error } = await supabase.from("trade_campaigns").insert({
        code,
        name,
        description,
        campaign_type,
        budget_id,
        estimated_cost,
        target_revenue,
        start_date,
        end_date,
        region,
        responsible_user_id,
        created_by: user.id,
        status: "draft",
      });

      if (error) throw error;

      toast.success("Campanha criada com sucesso!");
      setDialogOpen(false);
      setSelectedCampaignType("");
      setSelectedBudget("");
      setSelectedResponsible("");
      fetchData();
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    }
  };

  const handleSubmitForApproval = async (campaignId: string, estimatedCost: number) => {
    try {
      // Atualizar status da campanha
      const { error: updateError } = await supabase
        .from("trade_campaigns")
        .update({ status: "pending_approval" })
        .eq("id", campaignId);

      if (updateError) throw updateError;

      // Determinar nível de aprovação necessário baseado no valor
      const { data: levels } = await supabase
        .from("trade_approval_levels")
        .select("*")
        .gte("max_approval_amount", estimatedCost)
        .order("level_number", { ascending: true })
        .limit(1);

      const approvalLevel = levels?.[0]?.level_number || 1;

      // Criar registro de aprovação pendente
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error: approvalError } = await supabase
        .from("trade_approvals")
        .insert({
          entity_type: "campaign",
          entity_id: campaignId,
          approval_level: approvalLevel,
          approver_user_id: user!.id, // Em produção, seria o aprovador do nível
          status: "pending",
          amount: estimatedCost,
        });

      if (approvalError) throw approvalError;

      toast.success(`Campanha enviada para aprovação (Nível ${approvalLevel})`);
      fetchData();
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: any; label: string; icon: any }> = {
      draft: { variant: "outline", label: "Rascunho", icon: Clock },
      pending_approval: { variant: "secondary", label: "Aguardando Aprovação", icon: Clock },
      approved: { variant: "default", label: "Aprovada", icon: CheckCircle },
      in_progress: { variant: "default", label: "Em Andamento", icon: TrendingUp },
      completed: { variant: "secondary", label: "Concluída", icon: CheckCircle },
      cancelled: { variant: "destructive", label: "Cancelada", icon: XCircle },
    };

    const { variant, label, icon: Icon } = config[status] || config.draft;

    return (
      <Badge variant={variant}>
        <Icon className="h-3 w-3 mr-1" />
        {label}
      </Badge>
    );
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

  // Métricas gerais
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c => c.status === "in_progress" || c.status === "approved").length;
  const totalInvested = campaigns.reduce((sum, c) => sum + parseFloat(c.actual_cost || 0), 0);
  const totalRevenue = campaigns.reduce((sum, c) => sum + parseFloat(c.actual_revenue || 0), 0);
  const roi = totalInvested > 0 ? ((totalRevenue - totalInvested) / totalInvested) * 100 : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Campanhas Trade Marketing</h1>
            <p className="text-muted-foreground mt-1">
              Gestão completa de campanhas com aprovação hierárquica
            </p>
          </div>
          {isAdminOrSupervisor && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Campanha
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Criar Nova Campanha</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateCampaign} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="code">Código da Campanha</Label>
                      <Input id="code" name="code" placeholder="Ex: CAMP-2025-001" required />
                    </div>
                  <div className="space-y-2">
                    <Label htmlFor="campaign_type">Tipo</Label>
                    <Select value={selectedCampaignType} onValueChange={setSelectedCampaignType}>
                      <SelectTrigger id="campaign_type">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sell_in">Sell-In</SelectItem>
                        <SelectItem value="sell_out">Sell-Out</SelectItem>
                        <SelectItem value="institucional">Institucional</SelectItem>
                        <SelectItem value="cooperada">Cooperada</SelectItem>
                        <SelectItem value="mdf">MDF</SelectItem>
                        <SelectItem value="midia">Mídia</SelectItem>
                        <SelectItem value="incentivo">Incentivo</SelectItem>
                        <SelectItem value="degustacao">Degustação</SelectItem>
                        <SelectItem value="bonificacao">Bonificação</SelectItem>
                      </SelectContent>
                    </Select>
                    <input type="hidden" name="campaign_type" value={selectedCampaignType} />
                  </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Nome da Campanha</Label>
                    <Input id="name" name="name" placeholder="Nome descritivo da campanha" required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea id="description" name="description" placeholder="Detalhes e objetivos da campanha" rows={3} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="budget_id">Verba (Opcional)</Label>
                    <Select value={selectedBudget} onValueChange={setSelectedBudget}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma verba" />
                      </SelectTrigger>
                      <SelectContent>
                        {budgets.map((budget) => (
                          <SelectItem key={budget.id} value={budget.id}>
                            {budget.code} - {budget.name} (Disponível: R$ {parseFloat(budget.available_amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input type="hidden" name="budget_id" value={selectedBudget} />
                  </div>
                    <div className="space-y-2">
                      <Label htmlFor="region">Região</Label>
                      <Input id="region" name="region" placeholder="Ex: Sul, Nordeste" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="estimated_cost">Custo Estimado (R$)</Label>
                      <Input id="estimated_cost" name="estimated_cost" type="number" step="0.01" min="0.01" placeholder="0.00" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="target_revenue">Receita Alvo (R$)</Label>
                      <Input id="target_revenue" name="target_revenue" type="number" step="0.01" min="0" placeholder="0.00" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_date">Data Início</Label>
                      <Input id="start_date" name="start_date" type="date" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_date">Data Fim</Label>
                      <Input id="end_date" name="end_date" type="date" required />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="responsible_user_id">Responsável</Label>
                    <Select value={selectedResponsible} onValueChange={setSelectedResponsible}>
                      <SelectTrigger id="responsible_user_id">
                        <SelectValue placeholder="Selecione o responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input type="hidden" name="responsible_user_id" value={selectedResponsible} />
                  </div>

                  <Button type="submit" className="w-full">Criar Campanha</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Métricas */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Campanhas</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCampaigns}</div>
              <p className="text-xs text-muted-foreground">{activeCampaigns} ativas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Investido</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totalInvested.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Gerada</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ROI Médio</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{roi.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {roi > 0 ? "Positivo" : "Negativo"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Lista, Por Cliente, e Resultados Gerais */}
        <Tabs defaultValue="lista" className="space-y-4">
          <TabsList>
            <TabsTrigger value="lista" className="gap-2">
              <List className="h-4 w-4" />
              Lista de Campanhas
            </TabsTrigger>
            <TabsTrigger value="por-cliente" className="gap-2">
              <Users className="h-4 w-4" />
              Por Cliente
            </TabsTrigger>
            <TabsTrigger value="resultados" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Resultados Gerais
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lista">
            <Card>
              <CardHeader>
                <CardTitle>Todas as Campanhas</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando campanhas...
                  </div>
                ) : campaigns.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma campanha cadastrada
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0">
                      <TableRow className="border-b-2 border-primary/10">
                        <TableHead className="font-semibold">Código</TableHead>
                        <TableHead className="font-semibold">Nome</TableHead>
                        <TableHead className="font-semibold">Tipo</TableHead>
                        <TableHead className="font-semibold">Período</TableHead>
                        <TableHead className="text-right font-semibold">Custo Estimado</TableHead>
                        <TableHead className="text-right font-semibold">Gasto Real</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.map((campaign) => {
                        const percentSpent = campaign.estimated_cost > 0 
                          ? (parseFloat(campaign.actual_cost || 0) / parseFloat(campaign.estimated_cost)) * 100 
                          : 0;

                        return (
                          <TableRow key={campaign.id} className="hover:bg-primary/5 transition-colors even:bg-muted/30">
                            <TableCell className="font-mono text-xs">{campaign.code}</TableCell>
                            <TableCell className="font-medium">{campaign.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {getCampaignTypeLabel(campaign.campaign_type)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(campaign.start_date), "dd/MM/yy")} -{" "}
                              {format(new Date(campaign.end_date), "dd/MM/yy")}
                            </TableCell>
                            <TableCell className="text-right">
                              R$ {parseFloat(campaign.estimated_cost).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="space-y-1">
                                <div>R$ {parseFloat(campaign.actual_cost || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                                <Progress value={percentSpent} className="h-1" />
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => navigate(`/dashboard/trade/financeiro/campanhas/${campaign.id}`)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {campaign.status === "draft" && isAdminOrSupervisor && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSubmitForApproval(campaign.id, campaign.estimated_cost)}
                                  >
                                    Enviar para Aprovação
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="por-cliente">
            <CampaignClientTable />
          </TabsContent>

          <TabsContent value="resultados">
            <CampaignResultsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
