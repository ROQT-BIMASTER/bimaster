import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, FileText, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { kindConfig } from "@/lib/china/timeline/kinds";
import type { ChinaTimelineEvent } from "@/lib/china/timeline/types";
import { StoragePreviewDialog } from "@/components/fabrica/StoragePreviewDialog";

interface Props {
  event: ChinaTimelineEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DocLite {
  id: string;
  tipo_documento: string;
  nome_arquivo: string | null;
  arquivo_path: string | null;
  arquivo_url: string | null;
  status: string;
  observacao: string | null;
  created_at: string;
}

function useEventDocument(documentoId: string | null | undefined) {
  return useQuery({
    queryKey: ["china-timeline-event-doc", documentoId],
    enabled: !!documentoId,
    staleTime: 30_000,
    queryFn: async (): Promise<DocLite | null> => {
      const { data } = await (supabase as any)
        .from("china_produto_documentos")
        .select("id, tipo_documento, nome_arquivo, arquivo_path, arquivo_url, status, observacao, created_at")
        .eq("id", documentoId)
        .maybeSingle();
      return (data || null) as DocLite | null;
    },
  });
}

export function TimelineEventDetailDialog({ event, open, onOpenChange }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const documentoId = event?.refs?.documentoId || null;
  const { data: doc, isLoading } = useEventDocument(documentoId);

  useEffect(() => {
    if (!open) setPreviewOpen(false);
  }, [open]);

  if (!event) return null;
  const cfg = kindConfig(event.kind);
  const Icon = cfg.icon;

  const payloadEntries = Object.entries(event.payload || {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center ${cfg.tint}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base truncate">{event.title}</DialogTitle>
                <DialogDescription className="text-xs">
                  {format(new Date(event.timestamp), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                  {event.actorLabel ? ` · ${event.actorLabel}` : ` · ${event.actor}`}
                </DialogDescription>
              </div>
              <Badge variant="outline" className="text-[10px]">{cfg.label}</Badge>
            </div>
          </DialogHeader>

          {event.descricao && (
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{event.descricao}</p>
          )}

          {payloadEntries.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Dados do evento
                </p>
                <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1 text-xs">
                  {payloadEntries.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</dt>
                      <dd className="text-foreground/90 break-words">
                        {typeof v === "object" ? JSON.stringify(v) : String(v)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </>
          )}

          {documentoId && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Documento relacionado
                </p>
                {isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Carregando documento…
                  </div>
                ) : doc ? (
                  <div className="rounded-md border border-border bg-card/40 p-2.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate">{doc.tipo_documento}</span>
                        </p>
                        {doc.nome_arquivo && (
                          <p className="text-[11px] text-muted-foreground truncate">{doc.nome_arquivo}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[9px] uppercase">{doc.status}</Badge>
                    </div>
                    {doc.observacao && (
                      <p className="text-[11px] text-muted-foreground italic">{doc.observacao}</p>
                    )}
                    {doc.arquivo_path && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => setPreviewOpen(true)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Visualizar / baixar
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Documento não encontrado ou removido.
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {doc?.arquivo_path && (
        <StoragePreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          filePath={doc.arquivo_path}
          fileName={doc.nome_arquivo || doc.tipo_documento}
        />
      )}
    </>
  );
}
