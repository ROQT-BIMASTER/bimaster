/**
 * ChecklistItemAdminSheet — Sheet lateral que envolve `ChecklistItemAdminPanel`
 * para abrir a camada administrativa (Pareceres + Comentários) a partir de
 * qualquer linha de documento — Modo Foco China, ChecklistItemPainel,
 * ChecklistC2BSheet etc.
 */
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { MessageSquareText } from "lucide-react";
import { ChecklistItemAdminPanel } from "./ChecklistItemAdminPanel";
import type { FlowBucket } from "@/lib/china/flowTones";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentoId: string;
  submissaoId: string;
  tipoDocumento: string;
  tipoDocumentoLabel?: string;
  bucket: FlowBucket;
  lado: "brasil" | "china";
  isReceiver: boolean;
  isSender: boolean;
  defaultTab?: "parecer" | "comentarios";
  produtoCodigo?: string | null;
  produtoNome?: string | null;
}

export function ChecklistItemAdminSheet({
  open,
  onOpenChange,
  documentoId,
  submissaoId,
  tipoDocumento,
  tipoDocumentoLabel,
  bucket,
  lado,
  isReceiver,
  isSender,
  defaultTab,
  produtoCodigo,
  produtoNome,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[460px] flex flex-col gap-0 p-0"
      >
        <SheetHeader className="border-b border-border bg-card/40 px-4 py-3">
          <SheetTitle className="text-sm flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-primary" />
            {tipoDocumentoLabel || tipoDocumento}
          </SheetTitle>
          <SheetDescription className="text-[11px] truncate">
            {produtoCodigo && (
              <span className="font-mono mr-1">{produtoCodigo}</span>
            )}
            {produtoNome}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <ChecklistItemAdminPanel
            documentoId={documentoId}
            submissaoId={submissaoId}
            tipoDocumento={tipoDocumento}
            tipoDocumentoLabel={tipoDocumentoLabel}
            bucket={bucket}
            lado={lado}
            isReceiver={isReceiver}
            isSender={isSender}
            defaultTab={defaultTab}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
