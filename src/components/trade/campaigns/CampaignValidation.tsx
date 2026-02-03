import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, Clock, AlertTriangle, Loader2, FileText, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

interface CampaignValidationProps {
  campaignId: string;
  campaign: {
    validation_status: string;
    validation_notes: string | null;
    status: string;
  };
}

export function CampaignValidation({ campaignId, campaign }: CampaignValidationProps) {
  const queryClient = useQueryClient();
  const [validationNotes, setValidationNotes] = useState(campaign.validation_notes || "");

  // Tour guiado para validação
  const startTour = () => {
    const driverObj = driver({
      showProgress: true,
      progressText: "{{current}} de {{total}}",
      nextBtnText: "Próximo",
      prevBtnText: "Anterior",
      doneBtnText: "Concluir",
      steps: [
        {
          element: '[data-tour="validation-status"]',
          popover: {
            title: "Status de Validação",
            description: "Aqui você vê o status geral da campanha e pode aprovar ou rejeitar toda a campanha.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: '[data-tour="pending-alert"]',
          popover: {
            title: "Alerta de Pendências",
            description: "Este alerta mostra quantos itens ainda precisam ser validados antes de aprovar a campanha.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: '[data-tour="supervisor-notes"]',
          popover: {
            title: "Observações do Supervisor",
            description: "Registre aqui suas observações sobre a validação. Em caso de rejeição, o motivo é obrigatório.",
            side: "top",
            align: "start",
          },
        },
        {
          element: '[data-tour="approve-campaign"]',
          popover: {
            title: "Aprovar Campanha",
            description: "Clique aqui para aprovar a campanha inteira. Recomendamos validar os itens pendentes antes.",
            side: "right",
            align: "start",
          },
        },
        {
          element: '[data-tour="reject-campaign"]',
          popover: {
            title: "Rejeitar Campanha",
            description: "Use para rejeitar a campanha. É obrigatório informar o motivo nas observações.",
            side: "left",
            align: "start",
          },
        },
        {
          element: '[data-tour="pending-items"]',
          popover: {
            title: "Itens Pendentes",
            description: "Lista todos os lançamentos e gastos que precisam de validação individual.",
            side: "top",
            align: "start",
          },
        },
        {
          element: '[data-tour="tabs-sell"]',
          popover: {
            title: "Aba Sell In/Out",
            description: "Mostra os lançamentos de vendas pendentes de aprovação.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: '[data-tour="tabs-expenses"]',
          popover: {
            title: "Aba Gastos",
            description: "Mostra os gastos e despesas da campanha pendentes de aprovação.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: '[data-tour="approve-all"]',
          popover: {
            title: "Aprovar Todos",
            description: "Aprova todos os itens pendentes da aba selecionada de uma só vez.",
            side: "left",
            align: "start",
          },
        },
      ],
    });

    driverObj.drive();
    localStorage.setItem("campaign-validation-tour-seen", "true");
  };

  // Auto-iniciar tour na primeira visita
  useEffect(() => {
    const tourSeen = localStorage.getItem("campaign-validation-tour-seen");
    if (!tourSeen) {
      const timer = setTimeout(() => {
        startTour();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  // Buscar entradas de Sell pendentes
  const { data: pendingSellEntries = [] } = useQuery({
    queryKey: ["pending-sell-entries", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_campaign_sellout_entries")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("validation_status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Buscar gastos pendentes
  const { data: pendingExpenses = [] } = useQuery({
    queryKey: ["pending-expenses", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_campaign_expenses")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("status", "pendente")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Mutação para aprovar campanha
  const approveCampaign = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("trade_campaigns")
        .update({
          validation_status: "approved",
          validation_notes: validationNotes,
          validated_by: user?.id,
          validated_at: new Date().toISOString(),
          status: "approved",
        })
        .eq("id", campaignId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade-campaign-detail", campaignId] });
      toast.success("Campanha aprovada com sucesso!");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Mutação para rejeitar campanha
  const rejectCampaign = useMutation({
    mutationFn: async () => {
      if (!validationNotes.trim()) {
        throw new Error("Informe o motivo da rejeição");
      }

      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("trade_campaigns")
        .update({
          validation_status: "rejected",
          validation_notes: validationNotes,
          validated_by: user?.id,
          validated_at: new Date().toISOString(),
        })
        .eq("id", campaignId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade-campaign-detail", campaignId] });
      toast.success("Campanha rejeitada");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Mutação para aprovar todos os itens pendentes
  const approveAllPending = useMutation({
    mutationFn: async (type: "sell" | "expenses") => {
      const { data: { user } } = await supabase.auth.getUser();

      if (type === "sell") {
        const { error } = await supabase
          .from("trade_campaign_sellout_entries")
          .update({
            validation_status: "approved",
            validated_by: user?.id,
            validated_at: new Date().toISOString(),
          })
          .eq("campaign_id", campaignId)
          .eq("validation_status", "pending");

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("trade_campaign_expenses")
          .update({
            status: "aprovado",
            approved_by: user?.id,
            approved_at: new Date().toISOString(),
          })
          .eq("campaign_id", campaignId)
          .eq("status", "pendente");

        if (error) throw error;
      }
    },
    onSuccess: (_, type) => {
      queryClient.invalidateQueries({ queryKey: ["pending-sell-entries", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["pending-expenses", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["trade-campaign-detail", campaignId] });
      toast.success(`${type === "sell" ? "Entradas de Sell" : "Gastos"} aprovados!`);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const getValidationStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Aprovada</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejeitada</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
    }
  };

  const totalPendingItems = pendingSellEntries.length + pendingExpenses.length;

  return (
    <div className="space-y-6">
      {/* Status Geral */}
      <Card data-tour="validation-status">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Status de Validação
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={startTour}
                  title="Iniciar tour guiado"
                >
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </CardTitle>
              <CardDescription>Validação geral da campanha pelo supervisor</CardDescription>
            </div>
            {getValidationStatusBadge(campaign.validation_status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {totalPendingItems > 0 && (
            <div data-tour="pending-alert" className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                Existem {totalPendingItems} itens pendentes de validação
              </span>
            </div>
          )}

          <div data-tour="supervisor-notes" className="space-y-2">
            <Label htmlFor="validation_notes">Observações do Supervisor</Label>
            <Textarea
              id="validation_notes"
              value={validationNotes}
              onChange={(e) => setValidationNotes(e.target.value)}
              placeholder="Adicione observações sobre a validação..."
              rows={3}
            />
          </div>

          <div className="flex gap-3">
            <Button
              data-tour="approve-campaign"
              onClick={() => approveCampaign.mutate()}
              disabled={approveCampaign.isPending || campaign.validation_status === "approved"}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveCampaign.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <CheckCircle className="h-4 w-4 mr-2" />
              Aprovar Campanha
            </Button>
            <Button
              data-tour="reject-campaign"
              variant="destructive"
              onClick={() => rejectCampaign.mutate()}
              disabled={rejectCampaign.isPending || campaign.validation_status === "rejected"}
            >
              {rejectCampaign.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <XCircle className="h-4 w-4 mr-2" />
              Rejeitar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Itens Pendentes */}
      <Card data-tour="pending-items">
        <CardHeader>
          <CardTitle className="text-lg">Itens Pendentes de Validação</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="sell">
            <TabsList>
              <TabsTrigger data-tour="tabs-sell" value="sell">
                Sell In/Out
                {pendingSellEntries.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{pendingSellEntries.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger data-tour="tabs-expenses" value="expenses">
                Gastos
                {pendingExpenses.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{pendingExpenses.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sell" className="mt-4">
              {pendingSellEntries.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p>Todos os lançamentos de Sell estão validados</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <Button
                      data-tour="approve-all"
                      size="sm"
                      onClick={() => approveAllPending.mutate("sell")}
                      disabled={approveAllPending.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Aprovar Todos
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingSellEntries.map((entry: any) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <Badge variant="outline">
                              {entry.entry_type === "sell_in" ? "Sell In" : "Sell Out"}
                            </Badge>
                          </TableCell>
                          <TableCell>{entry.period === "anterior" ? "Anterior" : "Atual"}</TableCell>
                          <TableCell>{entry.store_name || "-"}</TableCell>
                          <TableCell>{format(new Date(entry.entry_date), "dd/MM/yyyy")}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(entry.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="expenses" className="mt-4">
              {pendingExpenses.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p>Todos os gastos estão validados</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => approveAllPending.mutate("expenses")}
                      disabled={approveAllPending.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Aprovar Todos
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Realizado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingExpenses.map((expense: any) => (
                        <TableRow key={expense.id}>
                          <TableCell>
                            <Badge variant="outline">{expense.category}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(expense.valor_realizado)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
