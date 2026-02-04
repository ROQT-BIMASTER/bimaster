import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, PartyPopper } from "lucide-react";
import { sanitizeText, sanitizeCode } from "@/lib/utils/sanitize";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BudgetDocumentUpload } from "@/components/trade/budgets/BudgetDocumentUpload";

interface UploadedFile {
  name: string;
  path: string;
  url: string;
  type: string;
  size: number;
}

interface SolicitarVerbaEventoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  eventId?: string;
  eventName?: string;
}

export function SolicitarVerbaEventoDialog({
  open,
  onOpenChange,
  onSuccess,
  eventId,
  eventName,
}: SolicitarVerbaEventoDialogProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [linkedEventId, setLinkedEventId] = useState<string | null>(eventId || null);

  // Buscar dados do usuário logado
  const { data: currentUser } = useQuery({
    queryKey: ['current-user-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome, email')
        .eq('id', user.id)
        .maybeSingle();
      
      return {
        id: user.id,
        email: user.email || profile?.email || '',
        nome: profile?.nome || user.user_metadata?.full_name || '',
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Buscar eventos para vincular
  const { data: events = [] } = useQuery({
    queryKey: ['events-for-budget-link'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corporate_events")
        .select("id, name, code, status")
        .in("status", ["draft", "pending_approval", "approved", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  // Preencher automaticamente quando o usuário for carregado
  useEffect(() => {
    if (currentUser && open) {
      setRequesterName(currentUser.nome);
      setRequesterEmail(currentUser.email);
    }
  }, [currentUser, open]);

  // Atualizar linkedEventId quando eventId mudar
  useEffect(() => {
    if (eventId) {
      setLinkedEventId(eventId);
    }
  }, [eventId]);

  // Limpar campos quando fechar
  useEffect(() => {
    if (!open) {
      setUploadedFiles([]);
      setAccountId(null);
      if (!eventId) {
        setLinkedEventId(null);
      }
    }
  }, [open, eventId]);

  // Buscar contas contábeis ativas
  const { data: accounts } = useQuery({
    queryKey: ['chart-of-accounts-active-budgets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_chart_of_accounts")
        .select("id, code, name")
        .eq("is_active", true)
        .eq("permite_lancamento", true)
        .order("code");
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Buscar nome do evento vinculado
  const selectedEvent = events.find(e => e.id === linkedEventId);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      const name = sanitizeText(formData.get("name") as string);
      const code = sanitizeCode(formData.get("code") as string);
      const total_amount = parseFloat(formData.get("total_amount") as string);
      const period_start = formData.get("period_start") as string;
      const period_end = formData.get("period_end") as string;
      const userNotes = sanitizeText(formData.get("notes") as string || "");

      // Formatar notas com referência ao evento
      let notes = userNotes.trim();
      const evidences: string[] = [];
      
      if (linkedEventId) {
        evidences.push(`[evento:${linkedEventId}]`);
        if (selectedEvent) {
          evidences.push(`Evento vinculado: ${selectedEvent.code} - ${selectedEvent.name}`);
        }
      }
      
      if (uploadedFiles.length > 0) {
        evidences.push(`Documentos anexados: ${uploadedFiles.length}`);
      }
      
      if (evidences.length > 0) {
        notes = notes + (notes ? "\n\n---\nEvidências:\n" : "Evidências:\n") + evidences.join("\n");
      }

      // Validações
      if (!name || name.length < 3) {
        throw new Error("Nome deve ter no mínimo 3 caracteres");
      }
      if (!code || code.length < 2) {
        throw new Error("Código deve ter no mínimo 2 caracteres");
      }
      if (!total_amount || total_amount <= 0) {
        throw new Error("Valor deve ser maior que zero");
      }
      if (new Date(period_end) <= new Date(period_start)) {
        throw new Error("Data de fim deve ser posterior à data de início");
      }

      const { data: budgetData, error } = await supabase.from("trade_budgets").insert({
        name,
        code,
        total_amount,
        period_start,
        period_end,
        notes,
        approval_status: "pending",
        status: "inactive",
        requested_by: user.id,
        requester_name: requesterName,
        requester_email: requesterEmail,
        account_id: accountId || null,
      }).select("id").single();

      if (error) throw error;

      // Salvar documentos vinculados ao budget
      if (uploadedFiles.length > 0 && budgetData?.id) {
        const documentsToInsert = uploadedFiles.map(file => ({
          budget_id: budgetData.id,
          file_name: file.name,
          file_path: file.path,
          file_url: file.url,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user.id,
        }));

        const { error: docError } = await supabase
          .from("trade_budget_documents")
          .insert(documentsToInsert);

        if (docError) {
          console.error("Erro ao salvar documentos:", docError);
        }
      }

      // Se tem evento vinculado, atualizar o budget_id do evento
      if (linkedEventId && budgetData?.id) {
        await supabase
          .from("corporate_events")
          .update({ budget_id: budgetData.id })
          .eq("id", linkedEventId);
      }

      queryClient.invalidateQueries({ queryKey: ['trade-budgets'] });
      queryClient.invalidateQueries({ queryKey: ['trade-pending-budgets'] });
      queryClient.invalidateQueries({ queryKey: ['corporate-events'] });
      
      toast.success("Solicitação de verba enviada para aprovação!");
      onOpenChange(false);
      onSuccess?.();
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar solicitação");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-primary" />
            Solicitar Verba para Evento
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dados do Solicitante - Preenchidos automaticamente */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="requester_name">Solicitante</Label>
              <Input
                id="requester_name"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                placeholder="Nome do solicitante"
                readOnly
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="requester_email">E-mail</Label>
              <Input
                id="requester_email"
                type="email"
                value={requesterEmail}
                onChange={(e) => setRequesterEmail(e.target.value)}
                placeholder="email@empresa.com"
                readOnly
                className="bg-background"
              />
            </div>
          </div>

          {/* Vincular Evento */}
          <div className="space-y-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <Label htmlFor="linked_event" className="flex items-center gap-2">
              <PartyPopper className="h-4 w-4 text-primary" />
              Vincular a um Evento *
            </Label>
            <Select
              value={linkedEventId || "none"}
              onValueChange={(value) => setLinkedEventId(value === "none" ? null : value)}
            >
              <SelectTrigger id="linked_event">
                <SelectValue placeholder="Selecione o evento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum evento (verba geral)</SelectItem>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.code} - {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {eventName && !linkedEventId && (
              <p className="text-xs text-muted-foreground">
                💡 Contexto: Esta solicitação é para o evento "{eventName}"
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Verba *</Label>
              <Input
                id="name"
                name="name"
                placeholder="Ex: Verba Conferência 2026"
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Código *</Label>
              <Input
                id="code"
                name="code"
                placeholder="Ex: EVT-2026-01"
                required
                maxLength={20}
                style={{ textTransform: 'uppercase' }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="total_amount">Valor Total Solicitado *</Label>
            <Input
              id="total_amount"
              name="total_amount"
              type="number"
              step="0.01"
              min="0.01"
              max="10000000"
              placeholder="0.00"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="period_start">Data Início *</Label>
              <Input
                id="period_start"
                name="period_start"
                type="date"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period_end">Data Fim *</Label>
              <Input
                id="period_end"
                name="period_end"
                type="date"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account_id">Conta Contábil (Opcional)</Label>
            <Select value={accountId || "none"} onValueChange={(val) => setAccountId(val === "none" ? null : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma conta contábil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não especificada</SelectItem>
                {accounts?.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O departamento financeiro poderá revisar na aprovação
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Justificativa</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Descreva a justificativa para esta verba..."
              rows={3}
              maxLength={1000}
            />
          </div>

          {/* Upload de Documentos */}
          <div className="space-y-2">
            <Label className="text-sm">Documentos de Apoio (Opcional)</Label>
            <BudgetDocumentUpload
              files={uploadedFiles}
              onFilesChange={setUploadedFiles}
              maxFiles={5}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Solicitar Verba
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
