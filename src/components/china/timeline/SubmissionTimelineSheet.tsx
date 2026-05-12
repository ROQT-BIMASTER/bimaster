import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { UnifiedSubmissionTimeline } from "./UnifiedSubmissionTimeline";
import { ChinaUnifiedTimelineEventsBody } from "./ChinaUnifiedTimelineEventsBody";
import type { ChinaTimelineScope, ChinaTimelineEvent } from "@/lib/china/timeline/types";
import type { MailboxItem } from "@/hooks/useChinaMailbox";
import { usePageBgColor } from "@/components/shared/PageBgCustomizer";
import { exportTimelinePdf, type JourneyStageRow } from "@/lib/china/exportTimelinePdf";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: ChinaTimelineScope;
  /** Quando fornecido, ativa a aba "Linha do tempo" (jornada por etapas). */
  submissao?: Pick<
    MailboxItem,
    "submissao_id" | "submissao_status" | "aprovado_em" | "created_at" | "numero_ordem" | "produto_codigo" | "produto_nome"
  > | null;
  ocId?: string | null;
  title?: string;
}

export function SubmissionTimelineSheet({ open, onOpenChange, scope, submissao, ocId, title }: Props) {
  const headerTitle = title
    || (submissao ? `${submissao.produto_codigo} — ${submissao.produto_nome}` : "Linha do tempo");
  const { bgStyle, BgColorButton } = usePageBgColor("china_submission_timeline_sheet");

  const [stages, setStages] = useState<JourneyStageRow[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<ChinaTimelineEvent[]>([]);

  const handleExportPdf = () => {
    if (!submissao) {
      toast.error("Submissão indisponível para exportação.");
      return;
    }
    try {
      exportTimelinePdf({
        produtoCodigo: submissao.produto_codigo,
        produtoNome: submissao.produto_nome,
        numeroOrdem: submissao.numero_ordem,
        submissaoStatus: submissao.submissao_status,
        criadaEm: submissao.created_at,
        stages,
        eventos: filteredEvents,
        filtroDescricao: `${filteredEvents.length} evento(s) — exportado conforme filtros aplicados`,
      });
      toast.success("PDF da linha do tempo gerado.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar PDF.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col gap-3 p-0"
        style={bgStyle}
      >
        <SheetHeader className="px-4 pt-4 pb-2 border-b">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base truncate">{headerTitle}</SheetTitle>
              <SheetDescription className="text-xs">
                Jornada da submissão, do envio na China até o recebimento no CD.
              </SheetDescription>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {submissao && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={handleExportPdf}
                  title="Exportar linha do tempo em PDF"
                >
                  <Download className="h-3.5 w-3.5" />
                  PDF
                </Button>
              )}
              <BgColorButton />
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue={submissao ? "jornada" : "eventos"} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-2 self-start">
            {submissao && <TabsTrigger value="jornada">Linha do tempo</TabsTrigger>}
            <TabsTrigger value="eventos">Histórico de eventos</TabsTrigger>
          </TabsList>

          {submissao && (
            <TabsContent value="jornada" className="flex-1 overflow-hidden mt-2">
              <ScrollArea className="h-full px-4 pb-4">
                <UnifiedSubmissionTimeline
                  submissao={submissao}
                  ocId={ocId}
                  onStagesComputed={setStages}
                />
              </ScrollArea>
            </TabsContent>
          )}

          <TabsContent value="eventos" className="flex-1 overflow-hidden mt-2">
            <ChinaUnifiedTimelineEventsBody
              scope={scope}
              onFilteredChange={setFilteredEvents}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
