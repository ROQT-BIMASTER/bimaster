import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { getSafeErrorMessage } from "@/lib/utils/sanitize";

interface NovoLancamentoDialogProps {
  onSuccess: () => void;
}

export function NovoLancamentoDialog({ onSuccess }: NovoLancamentoDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    entry_date: new Date().toISOString().split("T")[0],
    entry_type: "expense",
    account_id: "",
    amount: "",
    description: "",
    reference_number: "",
    store_id: "",
    budget_id: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    try {
      const [accountsRes, storesRes, budgetsRes] = await Promise.all([
        supabase.from("trade_chart_of_accounts").select("*").eq("is_active", true).order("code"),
        supabase.from("stores").select("id, name, code").eq("active", true).order("name"),
        supabase.from("trade_budgets").select("id, name, code").eq("status", "active").order("code"),
      ]);

      if (accountsRes.data) setAccounts(accountsRes.data);
      if (storesRes.data) setStores(storesRes.data);
      if (budgetsRes.data) setBudgets(budgetsRes.data);
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.entry_date || !formData.account_id || !formData.amount || !formData.description) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (parseFloat(formData.amount) <= 0) {
      toast.error("Valor deve ser maior que zero");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("trade_financial_entries").insert({
        entry_date: formData.entry_date,
        account_id: formData.account_id,
        entry_type: formData.entry_type,
        amount: parseFloat(formData.amount),
        description: formData.description.trim(),
        reference_number: formData.reference_number.trim() || null,
        store_id: formData.store_id || null,
        budget_id: formData.budget_id || null,
        notes: formData.notes.trim() || "",
        status: "pending",
        approval_status: "pending",
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Lançamento criado! Aguardando aprovação.");
      setFormData({
        entry_date: new Date().toISOString().split("T")[0],
        entry_type: "expense",
        account_id: "",
        amount: "",
        description: "",
        reference_number: "",
        store_id: "",
        budget_id: "",
        notes: "",
      });
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Lançamento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Lançamento Financeiro</DialogTitle>
          <DialogDescription>
            Crie um novo lançamento que será submetido para aprovação
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entry_date">Data *</Label>
              <Input
                id="entry_date"
                type="date"
                value={formData.entry_date}
                onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                max={new Date().toISOString().split("T")[0]}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entry_type">Tipo *</Label>
              <Select
                value={formData.entry_type}
                onValueChange={(value) => setFormData({ ...formData, entry_type: value })}
              >
                <SelectTrigger id="entry_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="budget_allocation">Alocação de Verba</SelectItem>
                  <SelectItem value="investment">Investimento</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="revenue">Receita</SelectItem>
                  <SelectItem value="adjustment">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account_id">Conta Contábil *</Label>
            <Select
              value={formData.account_id}
              onValueChange={(value) => setFormData({ ...formData, account_id: value })}
            >
              <SelectTrigger id="account_id">
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.code} - {account.name}
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
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference_number">Nº Referência</Label>
              <Input
                id="reference_number"
                placeholder="DOC-2024-001"
                value={formData.reference_number}
                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Textarea
              id="description"
              placeholder="Descreva o lançamento..."
              className="min-h-[80px]"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="store_id">Loja</Label>
              <Select
                value={formData.store_id}
                onValueChange={(value) => setFormData({ ...formData, store_id: value })}
              >
                <SelectTrigger id="store_id">
                  <SelectValue placeholder="Selecione (opcional)" />
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

            <div className="space-y-2">
              <Label htmlFor="budget_id">Verba</Label>
              <Select
                value={formData.budget_id}
                onValueChange={(value) => setFormData({ ...formData, budget_id: value })}
              >
                <SelectTrigger id="budget_id">
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {budgets.map((budget) => (
                    <SelectItem key={budget.id} value={budget.id}>
                      {budget.code} - {budget.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Informações adicionais..."
              className="min-h-[60px]"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              Criar Lançamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
