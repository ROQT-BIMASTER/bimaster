import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useEventReport } from "@/hooks/useExpenseAI";
import ReactMarkdown from "react-markdown";
import {
  FileText,
  Sparkles,
  Loader2,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface EventAIReportDialogProps {
  eventId: string;
  eventName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventAIReportDialog({
  eventId,
  eventName,
  open,
  onOpenChange,
}: EventAIReportDialogProps) {
  const { generate, isGenerating, report } = useEventReport();
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    generate(eventId);
  };

  const handleCopy = async () => {
    if (!report) return;
    await navigator.clipboard.writeText(report);
    setCopied(true);
    toast.success("Relatório copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Relatório IA — {eventName}
          </DialogTitle>
          <DialogDescription>
            Relatório gerado automaticamente com análise completa do evento
          </DialogDescription>
        </DialogHeader>

        {!report && !isGenerating ? (
          <div className="py-12 text-center space-y-4">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-medium">Gerar Relatório com IA</h3>
              <p className="text-sm text-muted-foreground mt-1">
                A IA irá analisar todas as despesas do evento e gerar um relatório completo
                com resumo executivo, análise orçamentária e recomendações.
              </p>
            </div>
            <Button onClick={handleGenerate} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Gerar Relatório
            </Button>
          </div>
        ) : isGenerating ? (
          <div className="py-12 space-y-4">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Gerando relatório...</span>
            </div>
            <div className="space-y-3 px-8">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleGenerate} className="gap-1">
                <RefreshCw className="h-3.5 w-3.5" />
                Regerar
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1">
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copiado!" : "Copiar"}
              </Button>
            </div>
            <ScrollArea className="flex-1 max-h-[60vh]">
              <div className="prose prose-sm max-w-none dark:prose-invert px-2">
                <ReactMarkdown>{report || ""}</ReactMarkdown>
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
