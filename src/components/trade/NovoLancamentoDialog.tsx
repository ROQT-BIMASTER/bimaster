import { useState, useEffect, useMemo } from "react";
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
import { Plus, Target, Building, Users, Truck, Search } from "lucide-react";
import { getSafeErrorMessage } from "@/lib/utils/sanitize";
import { NovaLojaDialog } from "./NovaLojaDialog";
import { useQuery } from "@tanstack/react-query";
import { useUserEmpresas, usePrimaryEmpresa } from "@/hooks/useUserEmpresas";
import { ExpenseReceiptScanner } from "@/components/ai/ExpenseReceiptScanner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { ExpenseAttachments } from "@/components/events/ExpenseAttachments";
import { TRADE_EXPENSE_CATEGORIES } from "./tradeExpenseCategories";

interface NovoLancamentoDialogProps {
  onSuccess: () => void;
}

export function NovoLancamentoDialog({ onSuccess }: NovoLancamentoDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  
  const { data: userEmpresas = [] } = useUserEmpresas();
  const { primaryEmpresa } = usePrimaryEmpresa();
  
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
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
  const [campaignId, setCampaignId] = useState("none");
  const [empresaId, setEmpresaId] = useState("");
  
  // Attachments (structured)
  const [attachments, setAttachments] = useState<any[]>([]);
  const [tempEntryId] = useState(() => crypto.randomUUID());
  
  // Entity type: cliente or fornecedor
  const [entityType, setEntityType] = useState<"none" | "cliente" | "fornecedor">("none");
  const [clienteId, setClienteId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [entitySearch, setEntitySearch] = useState("");
  
  const [isNovaLojaOpen, setIsNovaLojaOpen] = useState(false);
  const [isNovaContaOpen, setIsNovaContaOpen] = useState(false);
  const [isNovaVerbaOpen, setIsNovaVerbaOpen] = useState(false);

  // Pre-selecionar filial principal
  useEffect(() => {
    if (primaryEmpresa && !empresaId) {
      setEmpresaId(primaryEmpresa.id.toString());
    }
  }, [primaryEmpresa]);

  // Buscar campanhas ativas/aprovadas para vincular
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

  // Buscar clientes para seleção
  const { data: clientes = [] } = useQuery({
    queryKey: ['lancamento-clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, codigo, cnpj")
        .order("nome")
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: open && entityType === "cliente",
  });

  // Buscar fornecedores para seleção
  const { data: fornecedores = [] } = useQuery({
    queryKey: ['lancamento-fornecedores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_fornecedores")
        .select("id, razao_social, nome_fantasia, cnpj")
        .eq("ativo", true)
        .order("razao_social")
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: open && entityType === "fornecedor",
  });

  // Filtrar entidades por busca
  const filteredClientes = useMemo(() => {
    if (!entitySearch.trim()) return clientes.slice(0, 50);
    const term = entitySearch.toLowerCase();
    return clientes.filter(c =>
      c.nome?.toLowerCase().includes(term) ||
      c.codigo?.toLowerCase().includes(term) ||
      c.cnpj?.includes(term)
    ).slice(0, 50);
  }, [clientes, entitySearch]);

  const filteredFornecedores = useMemo(() => {
    if (!entitySearch.trim()) return fornecedores.slice(0, 50);
    const term = entitySearch.toLowerCase();
    return fornecedores.filter(f =>
      f.razao_social?.toLowerCase().includes(term) ||
      f.nome_fantasia?.toLowerCase().includes(term) ||
      f.cnpj?.includes(term)
    ).slice(0, 50);
  }, [fornecedores, entitySearch]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    try {
      // @ts-ignore - Bypass TypeScript recursion issue with Supabase types
      const acRes = await supabase
        .from("trade_chart_of_accounts")
        .select("id, code, name")
        .eq("is_active", true);
      if (acRes.data) setAccounts(acRes.data);

      // @ts-ignore - Bypass TypeScript recursion issue with Supabase types
      const stRes = await supabase
        .from("stores")
        .select("id, name, code")
        .eq("status", "active");
      if (stRes.data) setStores(stRes.data);

      // @ts-ignore - Bypass TypeScript recursion issue with Supabase types  
      const bgRes = await supabase
        .from("trade_budgets")
        .select("id, name, code")
        .eq("status", "active");
      if (bgRes.data) setBudgets(bgRes.data);
    } catch (error) {
      toast.error(getSafeErrorMessage(error));
    }
  };

  const moveAttachmentsToFinalPath = async (finalEntryId: string) => {
    if (attachments.length === 0) return attachments;

    const movedAttachments = [];
    for (const att of attachments) {
      // Extract the temp path from URL
      const urlParts = att.url.split("/trade-expense-docs/");
      if (urlParts.length > 1) {
        const oldPath = urlParts[1];
        const fileName = oldPath.split("/").pop();
        const newPath = `${finalEntryId}/${fileName}`;

        try {
          await supabase.storage.from("trade-expense-docs").move(oldPath, newPath);
          const { data: urlData } = supabase.storage.from("trade-expense-docs").getPublicUrl(newPath);
          movedAttachments.push({ ...att, url: urlData.publicUrl });
        } catch {
          // If move fails, keep original
          movedAttachments.push(att);
        }
      } else {
        movedAttachments.push(att);
      }
    }
    return movedAttachments;
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Obter empresa selecionada
      const selectedEmpresa = userEmpresas.find(
        ue => ue.empresa_id.toString() === empresaId
      );

      // Resolver dados da entidade selecionada
      let supplierName: string | null = null;
      let supplierDocument: string | null = null;

      if (entityType === "fornecedor" && fornecedorId) {
        const forn = fornecedores.find(f => f.id === fornecedorId);
        supplierName = forn?.nome_fantasia || forn?.razao_social || null;
        supplierDocument = forn?.cnpj || null;
      } else if (entityType === "cliente" && clienteId) {
        const cli = clientes.find(c => c.id === clienteId);
        supplierName = cli?.nome || null;
        supplierDocument = cli?.cnpj || null;
      }

      const { data: inserted, error } = await supabase.from("trade_financial_entries").insert({
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
        campaign_id: campaignId && campaignId !== "none" ? campaignId : null,
        notes: notes.trim() || null,
        document_url: documentUrl.trim() || null,
        status: "pending",
        approval_status: "pending",
        created_by: user.id,
        empresa_id: selectedEmpresa?.empresa_id || null,
        empresa_nome: selectedEmpresa?.empresa.nome || null,
        entity_type: entityType !== "none" ? entityType : null,
        cliente_id: entityType === "cliente" && clienteId ? clienteId : null,
        fornecedor_id: entityType === "fornecedor" && fornecedorId ? fornecedorId : null,
        supplier_name: supplierName,
        supplier_document: supplierDocument,
        attachments: attachments,
      }).select("id").single();

      if (error) throw error;

      // Move attachments to final path
      if (inserted && attachments.length > 0) {
        const finalAttachments = await moveAttachmentsToFinalPath(inserted.id);
        await supabase.from("trade_financial_entries")
          .update({ attachments: finalAttachments })
          .eq("id", inserted.id);
      }

      toast.success("Lançamento criado! Aguardando aprovação.");
      // Reset form
      setEntryDate(new Date().toISOString().split("T")[0]);
      setEntryType("expense");
      setAccountId("");
      setAmount("");
      setValorPrevisto("");
      setCategory("none");
      setDescription("");
      setReferenceNumber("");
      setStoreId("");
      setBudgetId("");
      setCampaignId("none");
      setEntityType("none");
      setClienteId("");
      setFornecedorId("");
      setEntitySearch("");
      setNotes("");
      setDocumentUrl("");
      setAttachments([]);
      setOpen(false);
      onSuccess();
    } catch (error) {
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
          {/* Scanner IA de Comprovantes */}
          <ExpenseReceiptScanner
            onFieldsExtracted={(fields) => {
              if (fields.description) setDescription(fields.description);
              if (fields.total_value) setAmount(fields.total_value.toString());
              if (fields.emission_date) setEntryDate(fields.emission_date);
            }}
          />

          {/* ===== SEÇÃO: Dados Gerais ===== */}
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados Gerais</h4>
            <Separator />
          </div>

          {/* Seletor de Filial */}
          <div className="space-y-2">
            <Label htmlFor="empresa_id" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Filial *
            </Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a filial" />
              </SelectTrigger>
              <SelectContent>
                {userEmpresas.map((ue) => (
                  <SelectItem key={ue.empresa_id} value={ue.empresa_id.toString()}>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      {ue.empresa.nome}
                      {ue.is_primary && (
                        <span className="text-xs text-primary">(Principal)</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <div className="flex gap-2">
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id="account_id" className="flex-1">
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNovaContaOpen(true)}
                title="Cadastrar nova conta contábil"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
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

          <div className="space-y-2">
            <Label htmlFor="reference_number">Nº Referência</Label>
            <Input
              id="reference_number"
              placeholder="DOC-2024-001"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="store_id">Loja</Label>
              <div className="flex gap-2">
                <Select value={storeId} onValueChange={setStoreId}>
                  <SelectTrigger id="store_id" className="flex-1">
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsNovaLojaOpen(true)}
                  title="Cadastrar nova loja"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget_id">Verba</Label>
              <div className="flex gap-2">
                <Select value={budgetId} onValueChange={setBudgetId}>
                  <SelectTrigger id="budget_id" className="flex-1">
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsNovaVerbaOpen(true)}
                  title="Cadastrar nova verba"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* ===== SEÇÃO: Entidade ===== */}
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Entidade</h4>
            <Separator />
          </div>

          {/* Seletor de Cliente / Fornecedor */}
          <div className="space-y-3 rounded-lg border p-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-primary" />
              Cliente ou Fornecedor
            </Label>
            
            <RadioGroup
              value={entityType}
              onValueChange={(val) => {
                setEntityType(val as "none" | "cliente" | "fornecedor");
                setClienteId("");
                setFornecedorId("");
                setEntitySearch("");
              }}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="none" id="entity-none" />
                <Label htmlFor="entity-none" className="text-sm font-normal cursor-pointer">Nenhum</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cliente" id="entity-cliente" />
                <Label htmlFor="entity-cliente" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> Cliente
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fornecedor" id="entity-fornecedor" />
                <Label htmlFor="entity-fornecedor" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5" /> Fornecedor
                </Label>
              </div>
            </RadioGroup>

            {entityType !== "none" && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={entityType === "cliente" ? "Buscar cliente por nome, código ou CNPJ..." : "Buscar fornecedor por nome ou CNPJ..."}
                    value={entitySearch}
                    onChange={(e) => setEntitySearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {entityType === "cliente" && (
                  <Select value={clienteId || "none"} onValueChange={(v) => setClienteId(v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum cliente</SelectItem>
                      {filteredClientes.map((cli) => (
                        <SelectItem key={cli.id} value={cli.id}>
                          {cli.codigo} - {cli.nome} {cli.cnpj ? `(${cli.cnpj})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {entityType === "fornecedor" && (
                  <Select value={fornecedorId || "none"} onValueChange={(v) => setFornecedorId(v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum fornecedor</SelectItem>
                      {filteredFornecedores.map((forn) => (
                        <SelectItem key={forn.id} value={forn.id}>
                          {forn.nome_fantasia || forn.razao_social} {forn.cnpj ? `(${forn.cnpj})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <p className="text-xs text-muted-foreground">
                  {entityType === "cliente" 
                    ? "Vincule este lançamento a um cliente de trade" 
                    : "Vincule este lançamento a um fornecedor"}
                </p>
              </div>
            )}
          </div>

          {/* Vincular a uma Campanha */}
          <div className="space-y-2">
            <Label htmlFor="campaign_id" className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Vincular a uma Campanha
            </Label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger id="campaign_id">
                <SelectValue placeholder="Selecione uma campanha (opcional)" />
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
            <p className="text-xs text-muted-foreground">
              Vincule este lançamento a uma campanha existente para rastreabilidade
            </p>
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
            <p className="text-xs text-muted-foreground">
              Cole a URL do documento armazenado (Google Drive, Dropbox, etc.)
            </p>
          </div>

          {/* Anexos estruturados */}
          <div className="space-y-2">
            <Label>Documentos / Evidências</Label>
            <ExpenseAttachments
              expenseId={tempEntryId}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              bucket="trade-expense-docs"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar Lançamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <NovaLojaDialog
        open={isNovaLojaOpen}
        onOpenChange={setIsNovaLojaOpen}
        onSuccess={(newStoreId) => {
          if (newStoreId) {
            setStoreId(newStoreId);
          }
          loadData();
        }}
      />

      <NovaContaContabilDialog
        open={isNovaContaOpen}
        onOpenChange={setIsNovaContaOpen}
        onSuccess={(newAccountId) => {
          if (newAccountId) {
            setAccountId(newAccountId);
          }
          loadData();
        }}
      />

      <NovaVerbaDialog
        open={isNovaVerbaOpen}
        onOpenChange={setIsNovaVerbaOpen}
        onSuccess={(newBudgetId) => {
          if (newBudgetId) {
            setBudgetId(newBudgetId);
          }
          loadData();
        }}
      />
    </Dialog>
  );
}

// Dialog para Nova Conta Contábil
interface NovaContaContabilDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newAccountId?: string) => void;
}

function NovaContaContabilDialog({ open, onOpenChange, onSuccess }: NovaContaContabilDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    account_type: "expense",
    centro_custo: "",
    departamento: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.code || !formData.name) {
      toast.error("Código e nome são obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("trade_chart_of_accounts")
        .insert({
          code: formData.code.trim(),
          name: formData.name.trim(),
          account_type: formData.account_type,
          centro_custo: formData.centro_custo.trim() || null,
          departamento: formData.departamento.trim() || null,
          description: formData.description.trim() || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Conta contábil cadastrada com sucesso!");
      onSuccess?.(data?.id);
      onOpenChange(false);
      setFormData({ code: "", name: "", account_type: "expense", centro_custo: "", departamento: "", description: "" });
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Conta Contábil</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="account_code">Código *</Label>
              <Input
                id="account_code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Ex: 1.01.001"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_type">Tipo *</Label>
              <Select 
                value={formData.account_type} 
                onValueChange={(value) => setFormData({ ...formData, account_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asset">Ativo</SelectItem>
                  <SelectItem value="liability">Passivo</SelectItem>
                  <SelectItem value="equity">Patrimônio Líquido</SelectItem>
                  <SelectItem value="revenue">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account_name">Nome *</Label>
            <Input
              id="account_name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Material de Marketing"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="centro_custo">Centro de Custo</Label>
              <Input
                id="centro_custo"
                value={formData.centro_custo}
                onChange={(e) => setFormData({ ...formData, centro_custo: e.target.value })}
                placeholder="Ex: CC-01 Marketing"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="departamento">Departamento</Label>
              <Input
                id="departamento"
                value={formData.departamento}
                onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                placeholder="Ex: Marketing"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account_description">Descrição</Label>
            <Textarea
              id="account_description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Informações adicionais..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Conta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Dialog para Nova Verba
interface NovaVerbaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newBudgetId?: string) => void;
}

function NovaVerbaDialog({ open, onOpenChange, onSuccess }: NovaVerbaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    total_amount: "",
    period_start: "",
    period_end: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.code || !formData.name || !formData.total_amount || !formData.period_start || !formData.period_end) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (new Date(formData.period_end) <= new Date(formData.period_start)) {
      toast.error("Data final deve ser posterior à data inicial");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("trade_budgets")
        .insert({
          code: formData.code.trim(),
          name: formData.name.trim(),
          total_amount: parseFloat(formData.total_amount),
          period_start: formData.period_start,
          period_end: formData.period_end,
          description: formData.description.trim() || null,
          status: "active",
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Verba cadastrada com sucesso!");
      onSuccess?.(data?.id);
      onOpenChange(false);
      setFormData({ code: "", name: "", total_amount: "", period_start: "", period_end: "", description: "" });
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Verba</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget_code">Código *</Label>
              <Input
                id="budget_code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Ex: VB-2024-001"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget_total">Valor Total (R$) *</Label>
              <Input
                id="budget_total"
                type="number"
                step="0.01"
                value={formData.total_amount}
                onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                placeholder="0,00"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget_name">Nome *</Label>
            <Input
              id="budget_name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Verba Trade Q1 2024"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="period_start">Início *</Label>
              <Input
                id="period_start"
                type="date"
                value={formData.period_start}
                onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="period_end">Fim *</Label>
              <Input
                id="period_end"
                type="date"
                value={formData.period_end}
                onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget_description">Descrição</Label>
            <Textarea
              id="budget_description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Informações adicionais..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Verba"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
