import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { getSafeErrorMessage } from "@/lib/utils/sanitize";
import { Separator } from "@/components/ui/separator";
import { ExpenseAttachments } from "@/components/events/ExpenseAttachments";
import { TRADE_EXPENSE_CATEGORIES } from "./tradeExpenseCategories";

interface EditarLancamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId: string;
  onSuccess: () => void;
}

export function EditarLancamentoDialog({ 
  open, 
  onOpenChange, 
  entryId, 
  onSuccess 
}: EditarLancamentoDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  
  const [entryDate, setEntryDate] = useState("");
  const [entryType, setEntryType] = useState("expense");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [valorPrevisto, setValorPrevisto] = useState("");
  const [category, setCategory] = useState("none");
  const [description, setDescription] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [storeId, setStoreId] = useState("");
  const [budgetId, setBudgetId] = useState("");
  const [notes, setNotes] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);

  useEffect(() => {
    if (open && entryId) {
      loadData();
      loadEntryData();
    }
  }, [open, entryId]);

  const loadData = async () => {
    try {
      const acRes = await supabase
        .from("trade_chart_of_accounts")
        .select("id, code, name")
        .eq("is_active", true);
      if (acRes.data) setAccounts(acRes.data);

      const stRes = await supabase
        .from("stores")
        .select("id, name, code")
        .eq("status", "active");
      if (stRes.data) setStores(stRes.data);

      const bgRes = await supabase
        .from("trade_budgets")
        .select("id, name, code")
        .eq("status", "active");
      if (bgRes.data) setBudgets(bgRes.data);
    } catch (error) {
      toast.error(getSafeErrorMessage(error));
    }
  };

  const loadEntryData = async () => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from("trade_financial_entries")
        .select("*")
        .eq("id", entryId)
        .single();

      if (error) throw error;
      if (!data) throw new Error("Lançamento não encontrado");

      setEntryDate(data.entry_date);
      setEntryType(data.entry_type);
      setAccountId(data.account_id || "");
      setAmount(data.amount.toString());
      setValorPrevisto(data.valor_previsto ? data.valor_previsto.toString() : "");
      setCategory(data.category || "none");
      setDescription(data.description || "");
      setReferenceNumber(data.reference_number || "");
      setStoreId(data.store_id || "");
      setBudgetId(data.budget_id || "");
      setDocumentUrl(data.document_url || "");
      
      // Load structured attachments
      const savedAttachments = data.attachments;
      if (Array.isArray(savedAttachments) && savedAttachments.length > 0) {
        setAttachments(savedAttachments as any[]);
        setNotes(data.notes || "");
      } else {
        // Legacy: extract photos from notes
        const notesText = data.notes || "";
        const photoSection = notesText.split("Fotos/Evidências:")[1];
        if (photoSection) {
          setNotes(notesText.split("Fotos/Evidências:")[0].trim());
        } else {
          setNotes(notesText);
        }
        setAttachments([]);
      }
    } catch (error) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!entryDate || !accountId || !amount || !description) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (parseFloat(amount) <= 0) {
      toast.error("Valor deve ser maior que zero");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("trade_financial_entries")
        .update({
          entry_date: entryDate,
          account_id: accountId,
          entry_type: entryType,
          amount: parseFloat(amount),
          valor_previsto: valorPrevisto ? parseFloat(valorPrevisto) : null,
          category: category !== "none" ? category : null,
          description: description.trim(),
          reference_number: referenceNumber.trim() || null,
          store_id: storeId || null,
          budget_id: budgetId || null,
          notes: notes.trim() || null,
          document_url: documentUrl.trim() || null,
          attachments: attachments,
          approval_status: "pending",
          rejected_reason: null,
        })
        .eq("id", entryId);

      if (error) throw error;

      toast.success("Lançamento atualizado e resubmetido para aprovação!");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Lançamento Financeiro</DialogTitle>
          <DialogDescription>
            Edite os dados do lançamento pendente
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="py-8 text-center text-muted-foreground">
            Carregando dados...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ===== SEÇÃO: Dados Gerais ===== */}
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados Gerais</h4>
              <Separator />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="entry_date">Data *</Label>
                <Input
                  id="entry_date"
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="entry_type">Tipo *</Label>
                <Select value={entryType} onValueChange={setEntryType}>
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
              <Select value={accountId} onValueChange={setAccountId}>
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

            {/* Categoria */}
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Selecione a categoria (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma categoria</SelectItem>
                  {TRADE_EXPENSE_CATEGORIES.map((cat) => (
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
                placeholder="Descreva o lançamento..."
                className="min-h-[80px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {/* ===== SEÇÃO: Financeiro ===== */}
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Financeiro</h4>
              <Separator />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor_previsto">Valor Previsto (R$)</Label>
                <Input
                  id="valor_previsto"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={valorPrevisto}
                  onChange={(e) => setValorPrevisto(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Valor Realizado (R$) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reference_number">Nº Referência</Label>
                <Input
                  id="reference_number"
                  placeholder="DOC-2024-001"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="store_id">Loja</Label>
                <Select value={storeId} onValueChange={setStoreId}>
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
                <Select value={budgetId} onValueChange={setBudgetId}>
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

            {/* ===== SEÇÃO: Observações e Anexos ===== */}
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Observações e Anexos</h4>
              <Separator />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Informações adicionais..."
                className="min-h-[60px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="document_url">URL do Comprovante/Documento</Label>
              <Input
                id="document_url"
                type="url"
                placeholder="https://..."
                value={documentUrl}
                onChange={(e) => setDocumentUrl(e.target.value)}
              />
            </div>

            {/* Anexos estruturados */}
            <div className="space-y-2">
              <Label>Documentos / Evidências</Label>
              <ExpenseAttachments
                expenseId={entryId}
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                bucket="trade-expense-docs"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || loadingData}>
                {loading ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
