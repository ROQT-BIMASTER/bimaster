// src/components/briefings/cofre/DocumentoCard.tsx
import { FileText, Download, MoreVertical, Trash2, CheckCircle2, XCircle, Upload, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import {
  triggerBlobDownload, downloadStorageBlob,
} from "@/lib/utils/storage-download";
import { toast } from "sonner";
import {
  CATEGORIA_LABELS, STATUS_LABELS,
  type BriefingDocumento, type BriefingDocStatus,
} from "@/hooks/useBriefingCofre";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";

interface Props {
  doc: BriefingDocumento;
  onAnexarArquivo: (doc: BriefingDocumento) => void;
  onMudarStatus: (doc: BriefingDocumento, status: BriefingDocStatus) => void;
  onExcluir: (doc: BriefingDocumento) => void;
}

const STATUS_VARIANT: Record<BriefingDocStatus, string> = {
  pendente: "bg-muted text-muted-foreground",
  recebido: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  aprovado: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rejeitado: "bg-destructive/10 text-destructive",
};

export function DocumentoCard({ doc, onAnexarArquivo, onMudarStatus, onExcluir }: Props) {
  const baixar = async () => {
    if (!doc.storage_path) return;
    const result = await downloadStorageBlob(doc.storage_path, "briefing-cofre");
    if (result.error || !result.blob) {
      toast.error(result.error || "Falha ao baixar");
      return;
    }
    triggerBlobDownload(result.blobUrl, result.filename || doc.nome);
  };

  const dataEntrega = doc.data_entrega ? parseLocalDate(doc.data_entrega) : null;

  return (
    <div className="flex items-center gap-3 bg-card border border-border rounded-lg p-3 hover:bg-muted/30 transition-colors">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <FileText className="h-4 w-4 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{doc.nome}</p>
          <Badge variant="outline" className="text-[10px] h-4">
            {CATEGORIA_LABELS[doc.categoria] || doc.categoria}
          </Badge>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_VARIANT[doc.status]}`}>
            {STATUS_LABELS[doc.status]}
          </span>
          {doc.notion_file_url && (
            <Badge variant="outline" className="text-[10px] h-4 gap-1">
              <ExternalLink className="h-2.5 w-2.5" /> Notion
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
          {doc.fornecedor_nome && <span>{doc.fornecedor_nome}</span>}
          {doc.lote && <span>· Lote {doc.lote}</span>}
          {dataEntrega && (
            <span>· {dataEntrega.toLocaleDateString("pt-BR")}</span>
          )}
          {doc.tamanho_bytes != null && (
            <span>· {(doc.tamanho_bytes / 1024 / 1024).toFixed(2)} MB</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {doc.storage_path ? (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={baixar} title="Baixar">
            <Download className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="h-7" onClick={() => onAnexarArquivo(doc)}>
            <Upload className="h-3 w-3 mr-1" /> Anexar
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {doc.storage_path && (
              <DropdownMenuItem onClick={() => onAnexarArquivo(doc)}>
                <Upload className="h-3.5 w-3.5 mr-2" /> Substituir arquivo
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onMudarStatus(doc, "aprovado")}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Marcar aprovado
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMudarStatus(doc, "rejeitado")}>
              <XCircle className="h-3.5 w-3.5 mr-2" /> Marcar rejeitado
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMudarStatus(doc, "pendente")}>
              Voltar para pendente
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onExcluir(doc)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
