import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, TrendingUp, Info } from "lucide-react";
import { sanitizeText } from "@/lib/utils/sanitize";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BudgetEvidenceSection, formatEvidenceNotes } from "./BudgetEvidenceSection";

interface UploadedFile {
  name: string;
  path: string;
  url: string;
  type: string;
  size: number;
}

interface BudgetInfo {
  id: string;
  code: string;
  name: string;
  total_amount: number;
  spent_amount: number;
  reserved_amount: number;
  period_start: string;
  period_end: string;
}

interface SolicitarComplementoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  budget: BudgetInfo | null;
  campaignName?: string;
  campaignId?: string;
  estimatedCost?: number;
}

export function SolicitarComplementoDialog({
  open,
  onOpenChange,
  onSuccess,
  budget,
  campaignName,
  campaignId,
  estimatedCost = 0,
}: SolicitarComplementoDialogProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [complementAmount, setComplementAmount] = useState("");
  const [justification, setJustification] = useState("");
  
  // Estados para evidências
  const [linkedCampaignId, setLinkedCampaignId] = useState<string | null>(null);
  const [linkedEntryId, setLinkedEntryId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

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

  // Calcular valores
  const availableBalance = budget 
    ? budget.total_amount - (budget.spent_amount || 0) - (budget.reserved_amount || 0)
    : 0;
  const deficit = Math.max(0, estimatedCost - availableBalance);

  // Pré-preencher com o déficit e campanha quando o dialog abrir
  useEffect(() => {
    if (open && deficit > 0) {
      setComplementAmount(deficit.toFixed(2));
      setJustification("");
      // Pré-vincular a campanha se vier do contexto
      if (campaignId) {
        setLinkedCampaignId(campaignId);
      }
    }
  }, [open, deficit, campaignId]);

  // Limpar quando fechar
  useEffect(() => {
    if (!open) {
      setLinkedCampaignId(null);
      setLinkedEntryId(null);
      setUploadedFiles([]);
    }
  }, [open]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!budget || !currentUser) return;
    
    setIsSubmitting(true);

    try {
      const amount = parseFloat(complementAmount);
      
      if (!amount || amount <= 0) {
        throw new Error("Valor do complemento deve ser maior que zero");
      }

      const userNotes = sanitizeText(justification);
      
      // Formatar notas com evidências
      const baseNotes = `Complemento de saldo para verba ${budget.code} - ${budget.name}. ${campaignName ? `Solicitado para campanha: ${campaignName}.` : ''} Déficit identificado: ${formatCurrency(deficit)}. ${userNotes ? `Justificativa: ${userNotes}` : ''}`;
      
      const notes = formatEvidenceNotes(
        baseNotes,
        linkedCampaignId,
        campaignName || null,
        linkedEntryId,
        uploadedFiles.length
      );

      // Gerar código único para o complemento
      const complementCode = `${budget.code}-COMP-${Date.now().toString(36).toUpperCase().slice(-4)}`;

      const { data: budgetData, error } = await supabase.from("trade_budgets").insert({
        name: `Complemento - ${budget.name}`,
        code: complementCode,
        total_amount: amount,
        period_start: budget.period_start,
        period_end: budget.period_end,
        notes,
        approval_status: "pending",
        status: "inactive",
        requested_by: currentUser.id,
        requester_name: currentUser.nome,
        requester_email: currentUser.email,
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
          uploaded_by: currentUser.id,
        }));

        const { error: docError } = await supabase
          .from("trade_budget_documents")
          .insert(documentsToInsert);

        if (docError) {
          console.error("Erro ao salvar documentos:", docError);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['trade-budgets'] });
      queryClient.invalidateQueries({ queryKey: ['trade-pending-budgets'] });

      toast.success("Solicitação de complemento enviada para aprovação do financeiro!");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar solicitação");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!budget) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Solicitar Complemento de Saldo
          </DialogTitle>
          <DialogDescription>
            Solicite um aumento de saldo para a verba selecionada
          </DialogDescription>
        </DialogHeader>

        {/* Informações da verba atual */}
        <div className="p-4 bg-muted/50 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Verba Selecionada</span>
            <Badge variant="outline">{budget.code}</Badge>
          </div>
          <p className="font-semibold">{budget.name}</p>
          
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div>
              <span className="text-xs text-muted-foreground">Saldo Atual</span>
              <p className="font-medium text-orange-600">{formatCurrency(availableBalance)}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Custo Campanha</span>
              <p className="font-medium">{formatCurrency(estimatedCost)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded text-destructive">
            <Info className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">
              Déficit: {formatCurrency(deficit)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="complement_amount">Valor do Complemento Solicitado *</Label>
            <Input
              id="complement_amount"
              type="number"
              step="0.01"
              min="0.01"
              max="10000000"
              value={complementAmount}
              onChange={(e) => setComplementAmount(e.target.value)}
              placeholder="0.00"
              required
            />
            <p className="text-xs text-muted-foreground">
              Pré-preenchido com o valor do déficit. Ajuste se necessário.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="justification">Justificativa</Label>
            <Textarea
              id="justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Descreva o motivo do complemento..."
              rows={2}
              maxLength={500}
            />
          </div>

          {/* Seção de Evidências */}
          <BudgetEvidenceSection
            linkedCampaignId={linkedCampaignId}
            onCampaignChange={setLinkedCampaignId}
            linkedEntryId={linkedEntryId}
            onEntryChange={setLinkedEntryId}
            uploadedFiles={uploadedFiles}
            onFilesChange={setUploadedFiles}
            campaignName={campaignName}
          />

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            <p>
              💡 A solicitação será enviada ao departamento financeiro. 
              Após aprovação, o saldo ficará disponível automaticamente.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
              Solicitar Complemento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
