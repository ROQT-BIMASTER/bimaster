import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Paperclip, Link2, FileText, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BudgetDocumentUpload } from "./budgets/BudgetDocumentUpload";

interface UploadedFile {
  name: string;
  path: string;
  url: string;
  type: string;
  size: number;
}

interface BudgetEvidenceSectionProps {
  linkedCampaignId?: string | null;
  onCampaignChange: (id: string | null) => void;
  linkedEntryId?: string | null;
  onEntryChange: (id: string | null) => void;
  uploadedFiles: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  showCampaignLink?: boolean;
  showEntryLink?: boolean;
  showUpload?: boolean;
  campaignName?: string; // Pré-selecionada do contexto
}

export function BudgetEvidenceSection({
  linkedCampaignId,
  onCampaignChange,
  linkedEntryId,
  onEntryChange,
  uploadedFiles,
  onFilesChange,
  showCampaignLink = true,
  showEntryLink = true,
  showUpload = true,
  campaignName,
}: BudgetEvidenceSectionProps) {
  // Buscar campanhas pendentes de verba ou não finalizadas
  const { data: campaigns = [] } = useQuery({
    queryKey: ['evidence-campaigns-pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_campaigns")
        .select("id, name, code, status, approval_status")
        .or("status.in.(draft,active,pending),approval_status.eq.pending_approval")
        .neq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  // Buscar lançamentos pendentes de aprovação
  const { data: entries = [] } = useQuery({
    queryKey: ['evidence-entries-pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_financial_entries")
        .select("id, description, reference_number, amount, entry_date, approval_status")
        .or("approval_status.eq.pending,approval_status.is.null")
        .order("entry_date", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
    enabled: showEntryLink,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR");
  };

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-dashed">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Paperclip className="h-4 w-4" />
        Evidências de Necessidade (Opcional)
      </div>

      {/* Vincular Campanha */}
      {showCampaignLink && (
        <div className="space-y-2">
          <Label htmlFor="linked_campaign" className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4 text-primary" />
            Vincular a uma Campanha
          </Label>
          <Select
            value={linkedCampaignId || "none"}
            onValueChange={(value) => onCampaignChange(value === "none" ? null : value)}
          >
            <SelectTrigger id="linked_campaign">
              <SelectValue placeholder="Selecione uma campanha (opcional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma campanha</SelectItem>
              {campaigns.map((campaign: any) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.code} - {campaign.name}
                  {campaign.approval_status === "pending_approval" && " 🕐"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {campaignName && !linkedCampaignId && (
            <p className="text-xs text-muted-foreground">
              💡 Contexto: Esta solicitação é relacionada à campanha "{campaignName}"
            </p>
          )}
        </div>
      )}

      {/* Vincular Lançamento/Despesa */}
      {showEntryLink && (
        <div className="space-y-2">
          <Label htmlFor="linked_entry" className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-blue-600" />
            Vincular a um Lançamento/Despesa
          </Label>
          <Select
            value={linkedEntryId || "none"}
            onValueChange={(value) => onEntryChange(value === "none" ? null : value)}
          >
            <SelectTrigger id="linked_entry">
              <SelectValue placeholder="Selecione um lançamento (opcional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum lançamento</SelectItem>
              {entries.map((entry: any) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.reference_number || formatDate(entry.entry_date)} - {entry.description?.substring(0, 35)}... ({formatCurrency(entry.amount)})
                  {entry.approval_status === "pending" && " 🕐"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Separador */}
      {(showCampaignLink || showEntryLink) && showUpload && (
        <div className="flex items-center gap-2 py-2">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">OU</span>
          <Separator className="flex-1" />
        </div>
      )}

      {/* Upload de Documentos */}
      {showUpload && (
        <BudgetDocumentUpload
          files={uploadedFiles}
          onFilesChange={onFilesChange}
          maxFiles={5}
        />
      )}

      {/* Info sobre evidências */}
      {(linkedCampaignId || linkedEntryId || uploadedFiles.length > 0) && (
        <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
          <Link2 className="inline h-3 w-3 mr-1" />
          {linkedCampaignId && "Campanha vinculada. "}
          {linkedEntryId && "Lançamento vinculado. "}
          {uploadedFiles.length > 0 && `${uploadedFiles.length} documento(s) anexado(s).`}
        </div>
      )}
    </div>
  );
}

// Função auxiliar para formatar evidências no campo notes
export function formatEvidenceNotes(
  userNotes: string,
  linkedCampaignId: string | null,
  linkedCampaignName: string | null,
  linkedEntryId: string | null,
  uploadedFilesCount: number
): string {
  let notes = userNotes.trim();
  
  const evidences: string[] = [];
  
  if (linkedCampaignId) {
    evidences.push(`[evidencia:campanha:${linkedCampaignId}]`);
    if (linkedCampaignName) {
      evidences.push(`Campanha vinculada: ${linkedCampaignName}`);
    }
  }
  
  if (linkedEntryId) {
    evidences.push(`[evidencia:lancamento:${linkedEntryId}]`);
  }
  
  if (uploadedFilesCount > 0) {
    evidences.push(`Documentos anexados: ${uploadedFilesCount}`);
  }
  
  if (evidences.length > 0) {
    notes = notes + (notes ? "\n\n---\nEvidências:\n" : "Evidências:\n") + evidences.join("\n");
  }
  
  return notes;
}
