import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, BarChart3, AlertTriangle, CheckCircle2, Users } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ResumoIADialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetoId: string;
  getProjectSummary: (projetoId: string) => Promise<{
    summary: string;
    stats?: { total: number; concluidas: number; atrasadas: number; semResponsavel: number; altaPrioridade: number };
  }>;
  loading: boolean;
}

export function ResumoIADialog({ open, onOpenChange, projetoId, getProjectSummary, loading }: ResumoIADialogProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [fetched, setFetched] = useState(false);

  const handleOpen = async (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen && !fetched) {
      try {
        const result = await getProjectSummary(projetoId);
        setSummary(result.summary);
        setStats(result.stats);
        setFetched(true);
      } catch {
        // handled in hook
      }
    }
  };

  const handleRefresh = async () => {
    setFetched(false);
    setSummary(null);
    setStats(null);
    try {
      const result = await getProjectSummary(projetoId);
      setSummary(result.summary);
      setStats(result.stats);
      setFetched(true);
    } catch {
      // handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Resumo Inteligente do Projeto
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analisando o projeto...</p>
          </div>
        ) : summary ? (
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-lg font-bold">{Math.round((stats.concluidas / stats.total) * 100)}%</p>
                    <p className="text-[10px] text-muted-foreground">Concluído</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <div>
                    <p className="text-lg font-bold">{stats.atrasadas}</p>
                    <p className="text-[10px] text-muted-foreground">Atrasadas</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
                  <Users className="h-4 w-4 text-blue-400" />
                  <div>
                    <p className="text-lg font-bold">{stats.semResponsavel}</p>
                    <p className="text-[10px] text-muted-foreground">Sem responsável</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <div>
                    <p className="text-lg font-bold">{stats.concluidas}/{stats.total}</p>
                    <p className="text-[10px] text-muted-foreground">Tarefas</p>
                  </div>
                </div>
              </div>
            )}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5 text-xs">
                <Sparkles className="h-3.5 w-3.5" /> Atualizar resumo
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <p className="text-sm text-muted-foreground">Erro ao gerar resumo. Tente novamente.</p>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              Tentar novamente
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
