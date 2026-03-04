import { useState, useEffect, ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { useEventExpenses, EXPENSE_CATEGORIES } from "@/hooks/useEventExpenses";
import { useUserEmpresas, usePrimaryEmpresa } from "@/hooks/useUserEmpresas";
import { useApproverProfiles, sendApproverNotification } from "@/hooks/useApproverProfiles";
import { Loader2, Building, SplitSquareVertical, Trash2, Barcode, ChevronDown, ChevronUp, Bell } from "lucide-react";
import { ExpenseAttachments } from "./ExpenseAttachments";
import { ExpenseReceiptScanner } from "@/components/ai/ExpenseReceiptScanner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DOCUMENT_TYPES = [
  { value: "orcamento", label: "Orçamento" },
  { value: "nf", label: "Nota Fiscal" },
  { value: "nfse", label: "NFS-e (Serviços)" },
  { value: "boleto", label: "Boleto Bancário" },
  { value: "recibo", label: "Recibo" },
  { value: "fatura", label: "Fatura" },
  { value: "outros", label: "Outros" },
];

interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
  uploaded_at: string;
}

interface Parcela {
  numero: number;
  valor: number;
  dueDate: string;
  boletoBarcode: string;
  attachments: Attachment[];
  documentType: string;
  tempId: string;
}

interface NovaDespesaEventoDialogProps {
  eventId: string;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function NovaDespesaEventoDialog({ 
  eventId, 
  children, 
  open, 
  onOpenChange 
}: NovaDespesaEventoDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;

  const { createExpense } = useEventExpenses(eventId);
  const { data: userEmpresas = [] } = useUserEmpresas();
  const { primaryEmpresa } = usePrimaryEmpresa();
  const { data: approvers = [] } = useApproverProfiles();

  const [notifyApproverId, setNotifyApproverId] = useState("");

  const [formData, setFormData] = useState({
    category: "outros",
    description: "",
    valor_previsto: "",
    valor_realizado: "",
    expense_date: "",
    empresa_id: "",
  });

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [tempExpenseId] = useState(() => crypto.randomUUID());

  // Parcelamento state
  const [parcelado, setParcelado] = useState(false);
  const [numParcelas, setNumParcelas] = useState(2);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [expandedParcela, setExpandedParcela] = useState<number | null>(null);

  // Pre-selecionar filial principal
  useEffect(() => {
    if (primaryEmpresa && !formData.empresa_id) {
      setFormData(prev => ({ 
        ...prev, 
        empresa_id: primaryEmpresa.id.toString() 
      }));
    }
  }, [primaryEmpresa]);

  // Generate parcelas when toggled or count changes
  useEffect(() => {
    if (parcelado) {
      const totalValue = parseFloat(formData.valor_realizado) || parseFloat(formData.valor_previsto) || 0;
      const valorParcela = totalValue > 0 ? parseFloat((totalValue / numParcelas).toFixed(2)) : 0;
      
      const newParcelas: Parcela[] = Array.from({ length: numParcelas }, (_, i) => {
        const existing = parcelas[i];
        return {
          numero: i + 1,
          valor: existing?.valor ?? valorParcela,
          dueDate: existing?.dueDate ?? "",
          boletoBarcode: existing?.boletoBarcode ?? "",
          attachments: existing?.attachments ?? [],
          documentType: existing?.documentType ?? (i === 0 ? "orcamento" : "boleto"),
          tempId: existing?.tempId ?? crypto.randomUUID(),
        };
      });
      setParcelas(newParcelas);
    } else {
      setParcelas([]);
    }
  }, [parcelado, numParcelas]);

  const updateParcela = (index: number, field: keyof Parcela, value: any) => {
    setParcelas(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const selectedEmpresa = userEmpresas.find(
        ue => ue.empresa_id.toString() === formData.empresa_id
      );

      if (parcelado && parcelas.length > 0) {
        // Create multiple entries with shared installment_group_id
        const groupId = crypto.randomUUID();
        
        for (const parcela of parcelas) {
          const expenseData = await createExpense.mutateAsync({
            event_id: eventId,
            category: formData.category,
            description: formData.description ? `${formData.description} (Parcela ${parcela.numero}/${parcelas.length})` : `Parcela ${parcela.numero}/${parcelas.length}`,
            valor_previsto: parcela.valor,
            valor_realizado: parcela.valor,
            expense_date: parcela.dueDate || formData.expense_date || undefined,
            empresa_id: selectedEmpresa?.empresa_id,
            empresa_nome: selectedEmpresa?.empresa.nome,
          });

          if (expenseData?.id) {
            // Update with installment fields and attachments
            const updatePayload: Record<string, any> = {
              installment_group_id: groupId,
              installment_number: parcela.numero,
              installment_total: parcelas.length,
              boleto_barcode: parcela.boletoBarcode || null,
              document_type: parcela.documentType || null,
            };

            if (parcela.attachments.length > 0) {
              const movedAttachments = await moveAttachments(parcela.attachments, parcela.tempId, expenseData.id);
              updatePayload.attachments = JSON.parse(JSON.stringify(movedAttachments));
            }

            await supabase
              .from("corporate_event_expenses")
              .update(updatePayload)
              .eq("id", expenseData.id);
          }
        }
      } else {
        // Single expense (original flow)
        const expenseData = await createExpense.mutateAsync({
          event_id: eventId,
          category: formData.category,
          description: formData.description || undefined,
          valor_previsto: formData.valor_previsto ? parseFloat(formData.valor_previsto) : undefined,
          valor_realizado: formData.valor_realizado ? parseFloat(formData.valor_realizado) : undefined,
          expense_date: formData.expense_date || undefined,
          empresa_id: selectedEmpresa?.empresa_id,
          empresa_nome: selectedEmpresa?.empresa.nome,
        });

        if (attachments.length > 0 && expenseData?.id) {
          const movedAttachments = await moveAttachments(attachments, tempExpenseId, expenseData.id);
          await supabase
            .from("corporate_event_expenses")
            .update({ attachments: JSON.parse(JSON.stringify(movedAttachments)) })
            .eq("id", expenseData.id);
        }
      }

      // Send push notification to selected approver
      if (notifyApproverId) {
        const valor = parseFloat(formData.valor_realizado) || parseFloat(formData.valor_previsto) || 0;
        await sendApproverNotification(notifyApproverId, formData.description, valor);
      }

      setIsOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error creating expense:", error);
      toast.error("Erro ao criar despesa");
    }
  };

  const moveAttachments = async (atts: Attachment[], fromId: string, toId: string): Promise<Attachment[]> => {
    const moved: Attachment[] = [];
    for (const attachment of atts) {
      try {
        const urlObj = new URL(attachment.url);
        const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
        if (pathMatch) {
          const bucket = pathMatch[1];
          const oldPath = decodeURIComponent(pathMatch[2]);
          const newPath = oldPath.replace(fromId, toId);
          const { error: moveError } = await supabase.storage.from(bucket).move(oldPath, newPath);
          if (!moveError) {
            moved.push({ ...attachment, url: attachment.url.replace(fromId, toId) });
            continue;
          }
        }
        moved.push(attachment);
      } catch {
        moved.push(attachment);
      }
    }
    return moved;
  };

  const resetForm = () => {
    setFormData({
      category: "outros",
      description: "",
      valor_previsto: "",
      valor_realizado: "",
      expense_date: "",
      empresa_id: primaryEmpresa?.id.toString() || "",
    });
    setAttachments([]);
    setParcelado(false);
    setNumParcelas(2);
    setParcelas([]);
    setNotifyApproverId("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Despesa do Evento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Scanner IA de Comprovante */}
          <div className="space-y-2">
            <ExpenseReceiptScanner
              onFieldsExtracted={(fields) => {
                setFormData((prev) => ({
                  ...prev,
                  category: fields.suggested_category || prev.category,
                  description: fields.description || prev.description,
                  valor_realizado: fields.total_value?.toString() || prev.valor_realizado,
                  expense_date: fields.emission_date || prev.expense_date,
                }));
              }}
            />
            <Separator />
          </div>

          {/* Seletor de Filial */}
          <div className="space-y-2">
            <Label htmlFor="empresa_id" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Filial *
            </Label>
            <Select
              value={formData.empresa_id}
              onValueChange={(value) => setFormData({ ...formData, empresa_id: value })}
            >
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

          <div className="space-y-2">
            <Label htmlFor="category">Categoria *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
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
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descreva a despesa..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor_previsto">Valor Previsto (R$)</Label>
              <Input
                id="valor_previsto"
                type="number"
                step="0.01"
                min="0"
                value={formData.valor_previsto}
                onChange={(e) => setFormData({ ...formData, valor_previsto: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor_realizado">Valor Realizado (R$)</Label>
              <Input
                id="valor_realizado"
                type="number"
                step="0.01"
                min="0"
                value={formData.valor_realizado}
                onChange={(e) => setFormData({ ...formData, valor_realizado: e.target.value })}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense_date">Data da Despesa</Label>
            <Input
              id="expense_date"
              type="date"
              value={formData.expense_date}
              onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
            />
          </div>

          {/* Parcelamento Toggle */}
          <Separator />
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 cursor-pointer">
              <SplitSquareVertical className="h-4 w-4" />
              Parcelar valor
            </Label>
            <Switch checked={parcelado} onCheckedChange={setParcelado} />
          </div>

          {parcelado && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Número de parcelas</Label>
                <Select value={numParcelas.toString()} onValueChange={(v) => setNumParcelas(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                      <SelectItem key={n} value={n.toString()}>{n}x</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                {parcelas.map((parcela, index) => (
                  <Collapsible
                    key={parcela.tempId}
                    open={expandedParcela === index}
                    onOpenChange={(open) => setExpandedParcela(open ? index : null)}
                  >
                    <div className="border rounded-lg">
                      <CollapsibleTrigger asChild>
                        <button type="button" className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {parcela.numero}/{parcelas.length}
                            </Badge>
                            <span className="text-sm font-medium">
                              R$ {parcela.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                            {parcela.dueDate && (
                              <span className="text-xs text-muted-foreground">
                                Venc: {new Date(parcela.dueDate + "T12:00:00").toLocaleDateString("pt-BR")}
                              </span>
                            )}
                          </div>
                          {expandedParcela === index ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="p-3 pt-0 space-y-3 border-t">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Valor (R$)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={parcela.valor}
                                onChange={(e) => updateParcela(index, "valor", parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Vencimento</Label>
                              <Input
                                type="date"
                                value={parcela.dueDate}
                                onChange={(e) => updateParcela(index, "dueDate", e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Tipo de Documento</Label>
                            <Select
                              value={parcela.documentType}
                              onValueChange={(v) => updateParcela(index, "documentType", v)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DOCUMENT_TYPES.map((dt) => (
                                  <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1">
                              <Barcode className="h-3 w-3" />
                              Linha Digitável
                            </Label>
                            <Input
                              value={parcela.boletoBarcode}
                              onChange={(e) => updateParcela(index, "boletoBarcode", e.target.value)}
                              placeholder="Cole a linha digitável do boleto"
                              className="font-mono text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Anexos da Parcela</Label>
                            <ExpenseAttachments
                              expenseId={parcela.tempId}
                              attachments={parcela.attachments}
                              onAttachmentsChange={(atts) => updateParcela(index, "attachments", atts)}
                            />
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            </div>
          )}

          {/* Attachments Section (only when not parcelado) */}
          {!parcelado && (
            <div className="space-y-2 pt-2 border-t">
              <Label>Documentos Anexos</Label>
              <ExpenseAttachments
                expenseId={tempExpenseId}
                attachments={attachments}
                onAttachmentsChange={setAttachments}
              />
            </div>
          )}

          {/* Notificar Aprovador */}
          <Separator />
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notificar Aprovador (opcional)
            </Label>
            <Select value={notifyApproverId} onValueChange={setNotifyApproverId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione quem será notificado" />
              </SelectTrigger>
              <SelectContent>
                {approvers.map((approver) => (
                  <SelectItem key={approver.id} value={approver.id}>
                    {approver.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createExpense.isPending}>
              {createExpense.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Despesa
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
