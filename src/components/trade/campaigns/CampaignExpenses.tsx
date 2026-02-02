import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Loader2, CheckCircle, XCircle, Clock, AlertTriangle, Receipt, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";

interface CampaignExpensesProps {
  campaignId: string;
  verbaOrcada: number;
  lancamentoId?: string | null;
}

interface Expense {
  id: string;
  category: string;
  description: string;
  valor_previsto: number;
  valor_orcado: number;
  valor_realizado: number;
  status: string;
  expense_date: string | null;
  notes: string | null;
  created_at: string;
}

const EXPENSE_CATEGORIES = [
  { value: "material", label: "Material Promocional" },
  { value: "brinde", label: "Brindes" },
  { value: "degustacao", label: "Degustação" },
  { value: "logistica", label: "Logística" },
  { value: "midia", label: "Mídia" },
  { value: "servico", label: "Serviço Terceirizado" },
  { value: "equipamento", label: "Equipamentos" },
  { value: "outro", label: "Outros" },
];

export function CampaignExpenses({ campaignId, verbaOrcada, lancamentoId }: CampaignExpensesProps) {
  const queryClient = useQueryClient();
  const { isAdminOrSupervisor } = useUserRole();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("material");

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["campaign-expenses", campaignId, lancamentoId],
    queryFn: async () => {
      let query = supabase
        .from("trade_campaign_expenses")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });

      // Filter by lancamento if provided
      if (lancamentoId) {
        query = query.eq("lancamento_id", lancamentoId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Expense[];
    },
  });

  const createExpense = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("trade_campaign_expenses")
        .insert({
          campaign_id: campaignId,
          lancamento_id: lancamentoId || null,
          category: formData.get("category") as string,
          description: formData.get("description") as string,
          valor_previsto: parseFloat(formData.get("valor_previsto") as string) || 0,
          valor_orcado: parseFloat(formData.get("valor_orcado") as string) || 0,
          valor_realizado: parseFloat(formData.get("valor_realizado") as string) || 0,
          expense_date: formData.get("expense_date") as string || null,
          notes: formData.get("notes") as string || null,
          created_by: user.id,
          status: "pendente",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-expenses", campaignId, lancamentoId] });
      queryClient.invalidateQueries({ queryKey: ["trade-campaign-detail", campaignId] });
      toast.success("Gasto registrado com sucesso!");
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const updateExpenseStatus = useMutation({
    mutationFn: async ({ expenseId, status }: { expenseId: string; status: string }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("trade_campaign_expenses")
        .update({
          status,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", expenseId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-expenses", campaignId, lancamentoId] });
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

  const getCategoryLabel = (category: string) => {
    return EXPENSE_CATEGORIES.find(c => c.value === category)?.label || category;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "aprovado":
        return <Badge variant="default" className="bg-green-600 hover:bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case "rejeitado":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      case "pago":
        return <Badge className="bg-blue-600 hover:bg-blue-600"><Receipt className="h-3 w-3 mr-1" />Pago</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    createExpense.mutate(new FormData(e.currentTarget));
  };

  // Calcular totais
  const totalPrevisto = expenses.reduce((sum, e) => sum + e.valor_previsto, 0);
  const totalOrcado = expenses.reduce((sum, e) => sum + e.valor_orcado, 0);
  const totalRealizado = expenses.filter(e => e.status === "aprovado" || e.status === "pago")
    .reduce((sum, e) => sum + e.valor_realizado, 0);
  
  const saldoDisponivel = verbaOrcada - totalRealizado;
  const percentualUtilizado = verbaOrcada > 0 ? (totalRealizado / verbaOrcada) * 100 : 0;

  // Show message when no lancamento selected
  if (!lancamentoId) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Selecione um Lançamento</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Vá para a aba "Lançamento" e selecione um cliente para registrar gastos.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo de Verbas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-tour="expenses-verba-cards">
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Verba Orçada</p>
              <p className="text-2xl font-bold">{formatCurrency(verbaOrcada)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Previsto</p>
              <p className="text-2xl font-bold text-muted-foreground">{formatCurrency(totalPrevisto)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Realizado (Aprovado)</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(totalRealizado)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className={saldoDisponivel < 0 ? "border-destructive bg-destructive/5" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saldo Disponível</p>
                <p className={`text-2xl font-bold ${saldoDisponivel < 0 ? 'text-destructive' : 'text-green-600'}`}>
                  {formatCurrency(saldoDisponivel)}
                </p>
              </div>
              {saldoDisponivel < 0 && <AlertTriangle className="h-5 w-5 text-destructive" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Progresso */}
      <Card data-tour="expenses-progress">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Utilização do Orçamento</span>
              <span className={`font-medium ${percentualUtilizado > 100 ? 'text-destructive' : ''}`}>
                {percentualUtilizado.toFixed(1)}%
              </span>
            </div>
            <Progress value={Math.min(percentualUtilizado, 100)} className={percentualUtilizado > 100 ? "[&>div]:bg-destructive" : ""} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatCurrency(totalRealizado)} utilizado</span>
              <span>{formatCurrency(verbaOrcada)} total</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Gastos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Controle de Gastos</CardTitle>
          <Button onClick={() => setDialogOpen(true)} size="sm" data-tour="declare-expense-button">
            <Plus className="h-4 w-4 mr-2" />
            Declarar Gasto
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum gasto registrado para este lançamento
            </div>
          ) : (
            <Table data-tour="expenses-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Previsto</TableHead>
                  <TableHead className="text-right">Orçado</TableHead>
                  <TableHead className="text-right">Realizado</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdminOrSupervisor && <TableHead>Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      <Badge variant="outline">{getCategoryLabel(expense.category)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(expense.valor_previsto)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(expense.valor_orcado)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(expense.valor_realizado)}
                    </TableCell>
                    <TableCell>{getStatusBadge(expense.status)}</TableCell>
                    {isAdminOrSupervisor && (
                      <TableCell>
                        {expense.status === "pendente" && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-green-600"
                              onClick={() => updateExpenseStatus.mutate({ expenseId: expense.id, status: "aprovado" })}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-destructive"
                              onClick={() => updateExpenseStatus.mutate({ expenseId: expense.id, status: "rejeitado" })}
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

      {/* Dialog de Novo Gasto */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Declarar Gasto do Lançamento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select name="category" value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição *</Label>
              <Textarea
                id="description"
                name="description"
                required
                placeholder="Descreva o gasto..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor_previsto">Previsto (R$)</Label>
                <Input
                  id="valor_previsto"
                  name="valor_previsto"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="valor_orcado">Orçado (R$)</Label>
                <Input
                  id="valor_orcado"
                  name="valor_orcado"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="valor_realizado">Realizado (R$) *</Label>
                <Input
                  id="valor_realizado"
                  name="valor_realizado"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense_date">Data do Gasto</Label>
              <Input
                id="expense_date"
                name="expense_date"
                type="date"
                defaultValue={new Date().toISOString().split("T")[0]}
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
              <Button type="submit" disabled={createExpense.isPending}>
                {createExpense.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Registrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
