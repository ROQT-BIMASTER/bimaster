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
import { useQuery } from "@tanstack/react-query";
import { useUserEmpresas, useAllEmpresas } from "@/hooks/useUserEmpresas";
import { Building, Target, Loader2, Clock } from "lucide-react";
import { FornecedorCombobox } from "./FornecedorCombobox";
import { LojaCombobox } from "./LojaCombobox";

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
  
  const { data: userEmpresas = [], isLoading: loadingUserEmpresas } = useUserEmpresas();
  const { data: allEmpresas = [], isLoading: loadingAllEmpresas } = useAllEmpresas();

  // Fallback: se user_empresas estiver vazio, usar todas as empresas ativas
  const empresasDisponiveis = userEmpresas.length > 0
    ? userEmpresas.map(ue => ({ id: ue.empresa_id, nome: ue.empresa.nome, is_primary: ue.is_primary }))
    : allEmpresas.map(e => ({ id: e.id, nome: e.nome, is_primary: false }));
  const loadingEmpresas = loadingUserEmpresas || (userEmpresas.length === 0 && loadingAllEmpresas);
  
  const [entryDate, setEntryDate] = useState("");
  const [entryType, setEntryType] = useState("expense");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [valorPrevisto, setValorPrevisto] = useState("");
  const [category, setCategory] = useState("none");
  const [description, setDescription] = useState("");
  const [storeId, setStoreId] = useState("none");
  const [budgetId, setBudgetId] = useState("none");
  const [campaignId, setCampaignId] = useState("none");
  const [fornecedorId, setFornecedorId] = useState("none");
  const [empresaId, setEmpresaId] = useState("");
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [documentType, setDocumentType] = useState("none");

  // Buscar campanhas
  const { data: campaigns = [] } = useQuery({
    queryKey: ['edit-lancamento-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_campaigns")
        .select("id, name, code, status")
        .or("status.in.(active,approved)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  // fornecedores query removed - handled by FornecedorCombobox

  useEffect(() => {
    if (open && entryId) {
      loadData();
      loadEntryData();
    }
  }, [open, entryId]);

  const loadData = async () => {
    try {
      const [acRes, stRes, bgRes] = await Promise.all([
        supabase.from("trade_chart_of_accounts").select("id, code, name").eq("is_active", true),
        supabase.from("stores").select("id, name, code, cnpj").eq("status", "active"),
        supabase.from("trade_budgets").select("id, name, code").eq("status", "active"),
      ]);
      if (acRes.data) setAccounts(acRes.data);
      if (stRes.data) setStores(stRes.data);
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
      setStoreId(data.store_id || "none");
      setBudgetId(data.budget_id || "none");
      setCampaignId(data.campaign_id || "none");
      setFornecedorId(data.fornecedor_id || "none");
      setEmpresaId(data.empresa_id?.toString() || "");
      setDocumentType(data.document_type || "none");
      
      const savedAttachments = data.attachments;
      if (Array.isArray(savedAttachments) && savedAttachments.length > 0) {
        setAttachments(savedAttachments as any[]);
        setNotes(data.notes || "");
      } else {
        const notesText = data.notes || "";
        const photoSection = notesText.split("Fotos/Evidências:")[1];
        setNotes(photoSection ? notesText.split("Fotos/Evidências:")[0].trim() : notesText);
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
      const selectedEmpresa = empresasDisponiveis.find(
        e => e.id.toString() === empresaId
      );

      // Resolver fornecedor
      let supplierName: string | null = null;
      let supplierDocument: string | null = null;
      const hasFornecedor = fornecedorId !== "none";

      if (hasFornecedor) {
        const { data: fornData } = await supabase
          .from("fabrica_fornecedores")
          .select("razao_social, nome_fantasia, cnpj")
          .eq("id", fornecedorId)
          .single();
        if (fornData) {
          supplierName = fornData.nome_fantasia || fornData.razao_social || null;
          supplierDocument = fornData.cnpj || null;
        }
      }

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
          store_id: storeId !== "none" ? storeId : null,
          budget_id: budgetId !== "none" ? budgetId : null,
          campaign_id: campaignId !== "none" ? campaignId : null,
          fornecedor_id: hasFornecedor ? fornecedorId : null,
          entity_type: hasFornecedor ? "fornecedor" : null,
          supplier_name: supplierName,
          supplier_document: supplierDocument,
          empresa_id: selectedEmpresa?.id || null,
          empresa_nome: selectedEmpresa?.nome || null,
          notes: notes.trim() || null,
          attachments: attachments,
          approval_status: "pending",
          rejected_reason: null,
          document_type: documentType !== "none" ? documentType : null,
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Lançamento Financeiro</DialogTitle>
          <DialogDescription>
            Edite os dados e resubmeta para aprovação
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="py-8 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Carregando dados...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Filial */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                Filial *
              </Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingEmpresas ? "Carregando filiais..." : "Selecione a filial"} />
                </SelectTrigger>
                <SelectContent>
                  {empresasDisponiveis.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>
                      {emp.nome}
                      {emp.is_primary ? " (Principal)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Categoria */}
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione a categoria</SelectItem>
                  {TRADE_EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Textarea
                placeholder="Descreva o lançamento..."
                className="min-h-[60px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {/* Valores */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Previsto (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={valorPrevisto}
                  onChange={(e) => setValorPrevisto(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Realizado (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Data */}
            <div className="space-y-2">
              <Label>Data da Despesa *</Label>
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                required
              />
            </div>

            {/* Fornecedor */}
            <FornecedorCombobox
              value={fornecedorId}
              onChange={setFornecedorId}
              enabled={open}
            />

            {/* Vinculações */}
            <div className="space-y-1 pt-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Vinculações</h4>
              <Separator />
            </div>

            {/* Conta Contábil */}
            <div className="space-y-2">
              <Label>Conta Contábil *</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
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

            {/* Loja/PDV */}
            <LojaCombobox
              value={storeId}
              onChange={setStoreId}
              stores={stores}
            />

            {/* Verba */}
            <div className="space-y-2">
              <Label>Verba</Label>
              <Select value={budgetId} onValueChange={setBudgetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma verba</SelectItem>
                  {budgets.map((budget) => (
                    <SelectItem key={budget.id} value={budget.id}>
                      {budget.code} - {budget.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Campanha */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Campanha
              </Label>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vincular a uma campanha (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma campanha</SelectItem>
                  {campaigns.map((campaign: any) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.code} - {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de Documento */}
            <div className="space-y-2">
              <Label>Tipo de Documento</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione o tipo</SelectItem>
                  <SelectItem value="orcamento">Orçamento</SelectItem>
                  <SelectItem value="nf">Nota Fiscal</SelectItem>
                  <SelectItem value="nfse">NFS-e (Serviços)</SelectItem>
                  <SelectItem value="boleto">Boleto Bancário</SelectItem>
                  <SelectItem value="recibo">Recibo</SelectItem>
                </SelectContent>
              </Select>
              {documentType === "orcamento" && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Lançamentos com orçamento ficam sinalizados como pendentes de NF
                </p>
              )}
            </div>

            {/* Anexos */}
            <div className="space-y-1 pt-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Documentos Anexos</h4>
              <Separator />
            </div>

            <ExpenseAttachments
              expenseId={entryId}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              bucket="trade-expense-docs"
            />

            {/* Observações */}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Informações adicionais..."
                className="min-h-[50px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
