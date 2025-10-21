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
import { Upload, X } from "lucide-react";
import { getSafeErrorMessage } from "@/lib/utils/sanitize";

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
  const [description, setDescription] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [storeId, setStoreId] = useState("");
  const [budgetId, setBudgetId] = useState("");
  const [notes, setNotes] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

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
      setDescription(data.description || "");
      setReferenceNumber(data.reference_number || "");
      setStoreId(data.store_id || "");
      setBudgetId(data.budget_id || "");
      setDocumentUrl(data.document_url || "");
      
      // Extrair fotos das observações se existirem
      const notesText = data.notes || "";
      const photoSection = notesText.split("Fotos/Evidências:")[1];
      if (photoSection) {
        const urls = photoSection
          .split("\n")
          .filter(line => line.trim().match(/^\d+\.\s+https?:\/\//))
          .map(line => line.replace(/^\d+\.\s+/, "").trim());
        setUploadedPhotos(urls);
        setNotes(notesText.split("Fotos/Evidências:")[0].trim());
      } else {
        setNotes(notesText);
        setUploadedPhotos([]);
      }
    } catch (error) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoadingData(false);
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
        
        const { error: uploadError } = await supabase.storage
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
      let finalNotes = notes.trim();
      if (uploadedPhotos.length > 0) {
        const photosSection = `\n\nFotos/Evidências:\n${uploadedPhotos.map((url, i) => `${i + 1}. ${url}`).join('\n')}`;
        finalNotes = finalNotes ? finalNotes + photosSection : photosSection.trim();
      }

      const { error } = await supabase
        .from("trade_financial_entries")
        .update({
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

            <div className="space-y-2">
              <Label>Fotos/Evidências</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => document.getElementById("photo-upload-edit")?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Enviando..." : "Adicionar Fotos"}
                </Button>
                <input
                  id="photo-upload-edit"
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