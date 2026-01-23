import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, TrendingUp, TrendingDown, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";

interface CampaignSellComparisonProps {
  campaignId: string;
  campaign: {
    sell_in_anterior: number;
    sell_in_atual: number;
    sell_out_anterior: number;
    sell_out_atual: number;
    crescimento_percentual: number | null;
  };
}

interface SellEntry {
  id: string;
  store_id: string | null;
  store_name: string | null;
  entry_type: string;
  period: string;
  amount: number;
  quantity: number | null;
  entry_date: string;
  validation_status: string;
  notes: string | null;
  created_at: string;
}

export function CampaignSellComparison({ campaignId, campaign }: CampaignSellComparisonProps) {
  const queryClient = useQueryClient();
  const { isAdminOrSupervisor } = useUserRole();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [entryType, setEntryType] = useState<string>("sell_out");
  const [period, setPeriod] = useState<string>("atual");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["campaign-sell-entries", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_campaign_sellout_entries")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as SellEntry[];
    },
  });

  const { data: stores = [] } = useQuery({
    queryKey: ["stores-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, code")
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const createEntry = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const storeId = formData.get("store_id") as string;
      const selectedStore = stores.find(s => s.id === storeId);

      const { error } = await supabase
        .from("trade_campaign_sellout_entries")
        .insert({
          campaign_id: campaignId,
          store_id: storeId || null,
          store_name: selectedStore?.name || null,
          entry_type: formData.get("entry_type") as string,
          period: formData.get("period") as string,
          amount: parseFloat(formData.get("amount") as string),
          quantity: formData.get("quantity") ? parseInt(formData.get("quantity") as string) : null,
          entry_date: formData.get("entry_date") as string,
          notes: formData.get("notes") as string || null,
          created_by: user.id,
          validation_status: "pending",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-sell-entries", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["trade-campaign-detail", campaignId] });
      toast.success("Entrada registrada com sucesso!");
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const updateValidation = useMutation({
    mutationFn: async ({ entryId, status }: { entryId: string; status: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("trade_campaign_sellout_entries")
        .update({
          validation_status: status,
          validated_by: user?.id,
          validated_at: new Date().toISOString(),
        })
        .eq("id", entryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-sell-entries", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["trade-campaign-detail", campaignId] });
      toast.success("Status atualizado!");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    createEntry.mutate(new FormData(e.currentTarget));
  };

  // Calcular totais por tipo e período
  const totals = {
    sell_in_anterior: entries
      .filter(e => e.entry_type === "sell_in" && e.period === "anterior" && e.validation_status === "approved")
      .reduce((sum, e) => sum + e.amount, 0),
    sell_in_atual: entries
      .filter(e => e.entry_type === "sell_in" && e.period === "atual" && e.validation_status === "approved")
      .reduce((sum, e) => sum + e.amount, 0),
    sell_out_anterior: entries
      .filter(e => e.entry_type === "sell_out" && e.period === "anterior" && e.validation_status === "approved")
      .reduce((sum, e) => sum + e.amount, 0),
    sell_out_atual: entries
      .filter(e => e.entry_type === "sell_out" && e.period === "atual" && e.validation_status === "approved")
      .reduce((sum, e) => sum + e.amount, 0),
  };

  return (
    <div className="space-y-6">
      {/* Resumo Comparativo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sell In</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Período Anterior</p>
                <p className="text-xl font-bold">{formatCurrency(campaign.sell_in_anterior)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Período Atual</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(campaign.sell_in_atual)}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              {campaign.sell_in_atual >= campaign.sell_in_anterior ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-sm font-medium ${campaign.sell_in_atual >= campaign.sell_in_anterior ? 'text-green-600' : 'text-red-600'}`}>
                {campaign.sell_in_anterior > 0 
                  ? `${(((campaign.sell_in_atual - campaign.sell_in_anterior) / campaign.sell_in_anterior) * 100).toFixed(1)}%`
                  : "N/A"
                }
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sell Out</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Período Anterior</p>
                <p className="text-xl font-bold">{formatCurrency(campaign.sell_out_anterior)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Período Atual</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(campaign.sell_out_atual)}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              {(campaign.crescimento_percentual || 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-sm font-medium ${(campaign.crescimento_percentual || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {campaign.crescimento_percentual !== null 
                  ? `${campaign.crescimento_percentual >= 0 ? '+' : ''}${campaign.crescimento_percentual.toFixed(1)}%`
                  : "N/A"
                }
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Entradas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Lançamentos de Sell In/Out</CardTitle>
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Novo Lançamento
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum lançamento registrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdminOrSupervisor && <TableHead>Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {entry.entry_type === "sell_in" ? "Sell In" : "Sell Out"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {entry.period === "anterior" ? "Anterior" : "Atual"}
                    </TableCell>
                    <TableCell>{entry.store_name || "-"}</TableCell>
                    <TableCell>{format(new Date(entry.entry_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(entry.amount)}
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.validation_status)}</TableCell>
                    {isAdminOrSupervisor && (
                      <TableCell>
                        {entry.validation_status === "pending" && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-green-600"
                              onClick={() => updateValidation.mutate({ entryId: entry.id, status: "approved" })}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-red-600"
                              onClick={() => updateValidation.mutate({ entryId: entry.id, status: "rejected" })}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Novo Lançamento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Lançamento de Sell In/Out</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select name="entry_type" value={entryType} onValueChange={setEntryType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sell_in">Sell In</SelectItem>
                    <SelectItem value="sell_out">Sell Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Período</Label>
                <Select name="period" value={period} onValueChange={setPeriod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anterior">Anterior</SelectItem>
                    <SelectItem value="atual">Atual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Loja (Opcional)</Label>
              <Select name="store_id">
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.code} - {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Valor (R$) *</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="entry_date">Data *</Label>
                <Input
                  id="entry_date"
                  name="entry_date"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade (Unidades)</Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                min="0"
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Input
                id="notes"
                name="notes"
                placeholder="Observações opcionais..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createEntry.isPending}>
                {createEntry.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Registrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
