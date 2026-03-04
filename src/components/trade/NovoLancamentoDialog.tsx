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
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Target, Building, Loader2, Clock, SplitSquareVertical, Trash2 } from "lucide-react";
import { FornecedorCombobox } from "./FornecedorCombobox";
import { LojaCombobox } from "./LojaCombobox";
import { getSafeErrorMessage } from "@/lib/utils/sanitize";
import { NovaLojaDialog } from "./NovaLojaDialog";
import { NovaContaContabilDialog } from "./NovaContaContabilDialog";
import { NovaVerbaDialog } from "./NovaVerbaDialog";
import { useQuery } from "@tanstack/react-query";
import { useUserEmpresas, usePrimaryEmpresa, useAllEmpresas } from "@/hooks/useUserEmpresas";
import { ExpenseReceiptScanner } from "@/components/ai/ExpenseReceiptScanner";
import { Separator } from "@/components/ui/separator";
import { ExpenseAttachments } from "@/components/events/ExpenseAttachments";
import { TRADE_EXPENSE_CATEGORIES } from "./tradeExpenseCategories";
import { Badge } from "@/components/ui/badge";

interface Parcela {
  numero: number;
  valor: number;
  dueDate: string;
}

interface NovoLancamentoDialogProps {
  onSuccess: () => void;
}

export function NovoLancamentoDialog({ onSuccess }: NovoLancamentoDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  
  const { data: userEmpresas = [], isLoading: loadingUserEmpresas } = useUserEmpresas();
  const { data: allEmpresas = [], isLoading: loadingAllEmpresas } = useAllEmpresas();
  const { primaryEmpresa } = usePrimaryEmpresa();

  const empresasDisponiveis = userEmpresas.length > 0
    ? userEmpresas.map(ue => ({ id: ue.empresa_id, nome: ue.empresa.nome, is_primary: ue.is_primary }))
    : allEmpresas.map(e => ({ id: e.id, nome: e.nome, is_primary: false }));
  const loadingEmpresas = loadingUserEmpresas || (userEmpresas.length === 0 && loadingAllEmpresas);
  
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [entryType, setEntryType] = useState("expense");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [valorPrevisto, setValorPrevisto] = useState("");
  const [category, setCategory] = useState("none");
  const [description, setDescription] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [storeId, setStoreId] = useState("none");
  const [budgetId, setBudgetId] = useState("none");
  const [notes, setNotes] = useState("");
  const [documentType, setDocumentType] = useState("none");
  const [campaignId, setCampaignId] = useState("none");
  const [empresaId, setEmpresaId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("none");
  
  // Parcelas
  const [parcelamentoAtivo, setParcelamentoAtivo] = useState(false);
  const [numParcelas, setNumParcelas] = useState(2);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  
  // Attachments
  const [attachments, setAttachments] = useState<any[]>([]);
  const [tempEntryId] = useState(() => crypto.randomUUID());
  
  const [isNovaLojaOpen, setIsNovaLojaOpen] = useState(false);
  const [isNovaContaOpen, setIsNovaContaOpen] = useState(false);
  const [isNovaVerbaOpen, setIsNovaVerbaOpen] = useState(false);

  useEffect(() => {
    if (!empresaId && empresasDisponiveis.length > 0) {
      const primary = empresasDisponiveis.find(e => e.is_primary);
      setEmpresaId((primary || empresasDisponiveis[0]).id.toString());
    }
  }, [empresasDisponiveis, empresaId]);

  const { data: campaigns = [] } = useQuery({
    queryKey: ['lancamento-campaigns'],
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

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

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

  // Gerar parcelas quando ativar parcelamento ou mudar valor/quantidade
  useEffect(() => {
    if (!parcelamentoAtivo || !amount) {
      setParcelas([]);
      return;
    }
    
    const total = parseFloat(amount);
    if (isNaN(total) || total <= 0 || numParcelas < 2) {
      setParcelas([]);
      return;
    }

    const valorParcela = Math.floor((total / numParcelas) * 100) / 100;
    const resto = Math.round((total - valorParcela * numParcelas) * 100) / 100;
    
    const novasParcelas: Parcela[] = [];
    const baseDate = entryDate ? new Date(entryDate + "T12:00:00") : new Date();
    
    for (let i = 0; i < numParcelas; i++) {
      const dueDate = new Date(baseDate);
      dueDate.setMonth(dueDate.getMonth() + (i + 1));
      
      novasParcelas.push({
        numero: i + 1,
        valor: i === 0 ? valorParcela + resto : valorParcela,
        dueDate: dueDate.toISOString().split("T")[0],
      });
    }
    
    setParcelas(novasParcelas);
  }, [parcelamentoAtivo, amount, numParcelas, entryDate]);

  const updateParcelaDueDate = (index: number, date: string) => {
    setParcelas(prev => prev.map((p, i) => 
      i === index ? { ...p, dueDate: date } : p
    ));
  };

  const updateParcelaValor = (index: number, valor: string) => {
    setParcelas(prev => prev.map((p, i) => 
      i === index ? { ...p, valor: parseFloat(valor) || 0 } : p
    ));
  };

  const moveAttachmentsToFinalPath = async (finalEntryId: string) => {
    if (attachments.length === 0) return attachments;

    const movedAttachments = [];
    for (const att of attachments) {
      const urlParts = att.url.split("/trade-expense-docs/");
      if (urlParts.length > 1) {
        const oldPath = urlParts[1];
        const fileName = oldPath.split("/").pop();
        const newPath = `${finalEntryId}/${fileName}`;
        try {
          await supabase.storage.from("trade-expense-docs").move(oldPath, newPath);
          const { data: signedData } = await supabase.storage
            .from("trade-expense-docs")
            .createSignedUrl(newPath, 31536000);
          movedAttachments.push({ ...att, url: signedData?.signedUrl || att.url });
        } catch {
          movedAttachments.push(att);
        }
      } else {
        movedAttachments.push(att);
      }
    }
    return movedAttachments;
  };

  const resetForm = () => {
    setEntryDate(new Date().toISOString().split("T")[0]);
    setEntryType("expense");
    setAccountId("");
    setAmount("");
    setValorPrevisto("");
    setCategory("none");
    setDescription("");
    setReferenceNumber("");
    setStoreId("none");
    setBudgetId("none");
    setCampaignId("none");
    setFornecedorId("none");
    setNotes("");
    setAttachments([]);
    setDocumentType("none");
    setParcelamentoAtivo(false);
    setNumParcelas(2);
    setParcelas([]);
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

    // Validar parcelas
    if (parcelamentoAtivo && parcelas.length > 0) {
      const totalParcelas = parcelas.reduce((s, p) => s + p.valor, 0);
      const diff = Math.abs(totalParcelas - parseFloat(amount));
      if (diff > 0.02) {
        toast.error(`A soma das parcelas (R$ ${totalParcelas.toFixed(2)}) difere do valor total (R$ ${parseFloat(amount).toFixed(2)})`);
        return;
      }
      
      for (const p of parcelas) {
        if (!p.dueDate) {
          toast.error(`Defina a data de vencimento da parcela ${p.numero}`);
          return;
        }
        if (p.valor <= 0) {
          toast.error(`O valor da parcela ${p.numero} deve ser maior que zero`);
          return;
        }
      }
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const selectedEmpresa = empresasDisponiveis.find(
        e => e.id.toString() === empresaId
      );

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

      const baseData = {
        entry_date: entryDate,
        account_id: accountId,
        entry_type: entryType,
        category: category !== "none" ? category : null,
        description: description.trim(),
        reference_number: referenceNumber.trim() || null,
        store_id: storeId !== "none" ? storeId : null,
        budget_id: budgetId !== "none" ? budgetId : null,
        campaign_id: campaignId !== "none" ? campaignId : null,
        notes: notes.trim() || null,
        status: "pending",
        approval_status: "pending",
        created_by: user.id,
        empresa_id: selectedEmpresa?.id || null,
        empresa_nome: selectedEmpresa?.nome || null,
        entity_type: hasFornecedor ? "fornecedor" : null,
        fornecedor_id: hasFornecedor ? fornecedorId : null,
        supplier_name: supplierName,
        supplier_document: supplierDocument,
        document_type: documentType !== "none" ? documentType : null,
      };

      if (parcelamentoAtivo && parcelas.length > 0) {
        // Criar múltiplas entradas (uma por parcela)
        const groupId = crypto.randomUUID().slice(0, 8).toUpperCase();
        
        const entries = parcelas.map((parcela) => ({
          ...baseData,
          amount: parcela.valor,
          valor_previsto: parcela.valor,
          due_date: parcela.dueDate,
          reference_number: `PARC-${groupId}-${parcela.numero}/${parcelas.length}`,
          description: `${description.trim()} (Parcela ${parcela.numero}/${parcelas.length})`,
          attachments: parcela.numero === 1 ? attachments : [],
        }));

        const { data: inserted, error } = await supabase
          .from("trade_financial_entries")
          .insert(entries)
          .select("id");

        if (error) throw error;

        // Mover anexos para a primeira parcela
        if (inserted && inserted.length > 0 && attachments.length > 0) {
          const finalAttachments = await moveAttachmentsToFinalPath(inserted[0].id);
          await supabase.from("trade_financial_entries")
            .update({ attachments: finalAttachments })
            .eq("id", inserted[0].id);
        }

        toast.success(`${parcelas.length} parcelas criadas! Aguardando aprovação.`);
      } else {
        // Lançamento único (fluxo original)
        const { data: inserted, error } = await supabase.from("trade_financial_entries").insert({
          ...baseData,
          amount: parseFloat(amount),
          valor_previsto: valorPrevisto ? parseFloat(valorPrevisto) : null,
          attachments: attachments,
        }).select("id").single();

        if (error) throw error;

        if (inserted && attachments.length > 0) {
          const finalAttachments = await moveAttachmentsToFinalPath(inserted.id);
          await supabase.from("trade_financial_entries")
            .update({ attachments: finalAttachments })
            .eq("id", inserted.id);
        }

        toast.success("Lançamento criado! Aguardando aprovação.");
      }

      resetForm();
      setOpen(false);
      onSuccess();
    } catch (error) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const totalParcelasValor = parcelas.reduce((s, p) => s + p.valor, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Lançamento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Lançamento Financeiro</DialogTitle>
          <DialogDescription>
            Crie um novo lançamento que será submetido para aprovação
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Scanner IA */}
          <ExpenseReceiptScanner
            onFieldsExtracted={(fields) => {
              if (fields.description) setDescription(fields.description);
              if (fields.total_value) setAmount(fields.total_value.toString());
              if (fields.emission_date) setEntryDate(fields.emission_date);
            }}
          />
          <Separator />

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

          {/* Parcelamento */}
          <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 cursor-pointer">
                <SplitSquareVertical className="h-4 w-4 text-primary" />
                Parcelar valor
              </Label>
              <Switch
                checked={parcelamentoAtivo}
                onCheckedChange={setParcelamentoAtivo}
                disabled={!amount || parseFloat(amount) <= 0}
              />
            </div>

            {parcelamentoAtivo && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Número de Parcelas</Label>
                  <Select value={numParcelas.toString()} onValueChange={(v) => setNumParcelas(parseInt(v))}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                        <SelectItem key={n} value={n.toString()}>
                          {n}x de R$ {(parseFloat(amount || "0") / n).toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {parcelas.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Parcelas e Vencimentos</Label>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {parcelas.map((parcela, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="w-12 justify-center text-xs shrink-0">
                            {parcela.numero}/{parcelas.length}
                          </Badge>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="h-8 w-28 text-xs"
                            value={parcela.valor}
                            onChange={(e) => updateParcelaValor(idx, e.target.value)}
                          />
                          <Input
                            type="date"
                            className="h-8 flex-1 text-xs"
                            value={parcela.dueDate}
                            onChange={(e) => updateParcelaDueDate(idx, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                    
                    {/* Totalização */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t">
                      <span className="text-muted-foreground">Total parcelas:</span>
                      <span className={`font-medium ${Math.abs(totalParcelasValor - parseFloat(amount || "0")) > 0.02 ? 'text-destructive' : 'text-emerald-600'}`}>
                        R$ {totalParcelasValor.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
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

          {/* Seção: Vinculações */}
          <div className="space-y-1 pt-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Vinculações</h4>
            <Separator />
          </div>

          {/* Conta Contábil */}
          <div className="space-y-2">
            <Label>Conta Contábil *</Label>
            <div className="flex gap-2">
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="flex-1">
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
              <Button type="button" variant="outline" size="icon" onClick={() => setIsNovaContaOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Loja/PDV */}
          <LojaCombobox
            value={storeId}
            onChange={setStoreId}
            stores={stores}
            onAddNew={() => setIsNovaLojaOpen(true)}
          />

          {/* Verba */}
          <div className="space-y-2">
            <Label>Verba</Label>
            <div className="flex gap-2">
              <Select value={budgetId} onValueChange={setBudgetId}>
                <SelectTrigger className="flex-1">
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
              <Button type="button" variant="outline" size="icon" onClick={() => setIsNovaVerbaOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
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

          {/* Seção: Anexos */}
          <div className="space-y-1 pt-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Documentos Anexos</h4>
            <Separator />
          </div>

          <ExpenseAttachments
            expenseId={tempEntryId}
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading 
                ? "Criando..." 
                : parcelamentoAtivo && parcelas.length > 0
                  ? `Criar ${parcelas.length} Parcelas`
                  : "Criar Lançamento"
              }
            </Button>
          </div>
        </form>
      </DialogContent>

      <NovaLojaDialog
        open={isNovaLojaOpen}
        onOpenChange={setIsNovaLojaOpen}
        onSuccess={(newStoreId) => {
          if (newStoreId) setStoreId(newStoreId);
          loadData();
        }}
      />

      <NovaContaContabilDialog
        open={isNovaContaOpen}
        onOpenChange={setIsNovaContaOpen}
        onSuccess={(newAccountId) => {
          if (newAccountId) setAccountId(newAccountId);
          loadData();
        }}
      />

      <NovaVerbaDialog
        open={isNovaVerbaOpen}
        onOpenChange={setIsNovaVerbaOpen}
        onSuccess={(newBudgetId) => {
          if (newBudgetId) setBudgetId(newBudgetId);
          loadData();
        }}
      />
    </Dialog>
  );
}
