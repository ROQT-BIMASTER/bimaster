import { useState, ReactNode } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEventExpenses, EXPENSE_CATEGORIES } from "@/hooks/useEventExpenses";
import { Loader2 } from "lucide-react";
import { ExpenseAttachments } from "./ExpenseAttachments";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
  uploaded_at: string;
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

  const [formData, setFormData] = useState({
    category: "outros",
    description: "",
    valor_previsto: "",
    valor_realizado: "",
    expense_date: "",
  });

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [tempExpenseId] = useState(() => crypto.randomUUID());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Create the expense with attachments
      const expenseData = await createExpense.mutateAsync({
        event_id: eventId,
        category: formData.category,
        description: formData.description || undefined,
        valor_previsto: formData.valor_previsto ? parseFloat(formData.valor_previsto) : undefined,
        valor_realizado: formData.valor_realizado ? parseFloat(formData.valor_realizado) : undefined,
        expense_date: formData.expense_date || undefined,
      });

      // If we have attachments, update the expense with them
      if (attachments.length > 0 && expenseData?.id) {
        // Move files from temp folder to actual expense folder
        const movedAttachments: Attachment[] = [];
        
        for (const attachment of attachments) {
          // Update the attachment URL to reflect the actual expense ID
          const newUrl = attachment.url.replace(tempExpenseId, expenseData.id);
          movedAttachments.push({ ...attachment, url: newUrl });
        }

        await supabase
          .from("corporate_event_expenses")
          .update({ attachments: JSON.parse(JSON.stringify(movedAttachments)) })
          .eq("id", expenseData.id);
      }

      setIsOpen(false);
      setFormData({
        category: "outros",
        description: "",
        valor_previsto: "",
        valor_realizado: "",
        expense_date: "",
      });
      setAttachments([]);
    } catch (error) {
      console.error("Error creating expense:", error);
      toast.error("Erro ao criar despesa");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Despesa do Evento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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

          {/* Attachments Section */}
          <div className="space-y-2 pt-2 border-t">
            <Label>Documentos Anexos</Label>
            <ExpenseAttachments
              expenseId={tempExpenseId}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
            />
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
