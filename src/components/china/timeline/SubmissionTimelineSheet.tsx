import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UnifiedSubmissionTimeline } from "./UnifiedSubmissionTimeline";
import { ChinaUnifiedTimelineEventsBody } from "./ChinaUnifiedTimelineEventsBody";
import type { ChinaTimelineScope } from "@/lib/china/timeline/types";
import type { MailboxItem } from "@/hooks/useChinaMailbox";
import { usePageBgColor } from "@/components/shared/PageBgCustomizer";

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
            <div className="shrink-0">
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
                <UnifiedSubmissionTimeline submissao={submissao} ocId={ocId} />
              </ScrollArea>
            </TabsContent>
          )}

          <TabsContent value="eventos" className="flex-1 overflow-hidden mt-2">
            <ChinaUnifiedTimelineEventsBody scope={scope} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
