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
import { Plus, Upload, X } from "lucide-react";
import { getSafeErrorMessage } from "@/lib/utils/sanitize";
import { NovaLojaDialog } from "./NovaLojaDialog";

interface NovoLancamentoDialogProps {
  onSuccess: () => void;
}

export function NovoLancamentoDialog({ onSuccess }: NovoLancamentoDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [entryType, setEntryType] = useState("expense");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [storeId, setStoreId] = useState("");
  const [budgetId, setBudgetId] = useState("");
  const [notes, setNotes] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  
  const [isNovaLojaOpen, setIsNovaLojaOpen] = useState(false);
  const [isNovaContaOpen, setIsNovaContaOpen] = useState(false);
  const [isNovaVerbaOpen, setIsNovaVerbaOpen] = useState(false);

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError, data } = await supabase.storage
          .from("trade-photos")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("trade-photos")
          .getPublicUrl(fileName);

        return publicUrl;
      });

      const urls = await Promise.all(uploadPromises);
      setUploadedPhotos([...uploadedPhotos, ...urls]);
      toast.success(`${urls.length} foto(s) enviada(s) com sucesso`);
    } catch (error) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (urlToRemove: string) => {
    setUploadedPhotos(uploadedPhotos.filter(url => url !== urlToRemove));
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

      // Combinar URLs de fotos com observações se houver fotos
      let finalNotes = notes.trim();
      if (uploadedPhotos.length > 0) {
        const photosSection = `\n\nFotos/Evidências:\n${uploadedPhotos.map((url, i) => `${i + 1}. ${url}`).join('\n')}`;
        finalNotes = finalNotes ? finalNotes + photosSection : photosSection.trim();
      }

      const { error } = await supabase.from("trade_financial_entries").insert({
        entry_date: entryDate,
        account_id: accountId,
        entry_type: entryType,
        amount: parseFloat(amount),
        description: description.trim(),
        reference_number: referenceNumber.trim() || null,
        store_id: storeId || null,
        budget_id: budgetId || null,
        notes: finalNotes,
        document_url: documentUrl.trim() || null,
        status: "pending",
        approval_status: "pending",
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Lançamento criado! Aguardando aprovação.");
      setEntryDate(new Date().toISOString().split("T")[0]);
      setEntryType("expense");
      setAccountId("");
      setAmount("");
      setDescription("");
      setReferenceNumber("");
      setStoreId("");
      setBudgetId("");
      setNotes("");
      setDocumentUrl("");
      setUploadedPhotos([]);
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$) *</Label>
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

          <div className="space-y-2">
            <Label>Fotos/Evidências</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => document.getElementById("photo-upload")?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Enviando..." : "Adicionar Fotos"}
              </Button>
              <input
                id="photo-upload"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <span className="text-sm text-muted-foreground">
                {uploadedPhotos.length} foto(s)
              </span>
            </div>
            
            {uploadedPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {uploadedPhotos.map((url, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={url}
                      alt={`Evidência ${index + 1}`}
                      className="w-full h-20 object-cover rounded border"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(url)}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
              <Label htmlFor="budget_amount">Valor Total (R$) *</Label>
              <Input
                id="budget_amount"
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
              placeholder="Ex: Verba Marketing Q1"
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
              rows={2}
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
