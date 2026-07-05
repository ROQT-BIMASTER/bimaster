import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Brain, CheckCircle2, Loader2, Pause, Play, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";

interface ReclassificarContasPagarHistoricoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

interface ReclassificationJob {
  id: string;
  status: JobStatus;
  total_groups: number;
  processed_groups: number;
  success_groups: number;
  error_groups: number;
  total_accounts: number;
  affected_accounts: number;
  low_confidence_groups: number;
  current_group: string | null;
  error_message: string | null;
}

interface RecentGroup {
  categoria_nome: string;
  fornecedor_nome: string | null;
  centro_custo_nome: string | null;
  account_count: number;
  status: "completed" | "failed";
  departamento_nome: string | null;
  plano_contas_codigo: string | null;
  plano_contas_nome: string | null;
  confidence_score: number | null;
  justification: string | null;
  error_message: string | null;
}

const STORAGE_KEY = "cp:historical-reclassification-job-id";

export function ReclassificarContasPagarHistoricoDialog({
  open,
  onOpenChange,
  onComplete,
}: ReclassificarContasPagarHistoricoDialogProps) {
  const [job, setJob] = useState<ReclassificationJob | null>(null);
  const [recent, setRecent] = useState<RecentGroup[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const stopRef = useRef(false);
  const completedRef = useRef<string | null>(null);

  const progress = useMemo(() => {
    if (!job?.total_groups) return 0;
    return Math.min(100, Math.round((job.processed_groups / job.total_groups) * 100));
  }, [job]);

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("ap-reclassificar-contas", { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    if (data?.job) setJob(data.job);
    if (data?.recent) setRecent(data.recent);
    return data as { job?: ReclassificationJob; recent?: RecentGroup[]; processedNow?: number };
  }, []);

  const refreshStatus = useCallback(async (jobId: string) => {
    try {
      await invoke({ action: "status", jobId });
    } catch (error) {
      logger.error("Erro ao consultar reclassificação histórica:", error);
      setErrorMessage(error instanceof Error ? error.message : "Erro ao consultar status");
    }
  }, [invoke]);

  const processLoop = useCallback(async (jobId: string) => {
    stopRef.current = false;
    setIsPaused(false);
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      while (!stopRef.current) {
        const result = await invoke({ action: "process", jobId, batchSize: 8 });
        const current = result.job;

        if (!current || ["completed", "failed", "cancelled"].includes(current.status)) {
          break;
        }

        if ((result.processedNow || 0) === 0) {
          await new Promise((resolve) => setTimeout(resolve, 900));
        }
      }
    } catch (error) {
      logger.error("Erro no processamento da reclassificação histórica:", error);
      const message = error instanceof Error ? error.message : "Erro ao processar reclassificação";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  }, [invoke]);

  const startNewJob = useCallback(async () => {
    setIsStarting(true);
    setErrorMessage(null);
    setRecent([]);
    completedRef.current = null;

    try {
      const result = await invoke({ action: "start" });
      if (!result.job?.id) throw new Error("Job não retornado pelo backend");
      window.localStorage.setItem(STORAGE_KEY, result.job.id);
      toast.success("Reclassificação histórica iniciada");
      await processLoop(result.job.id);
    } catch (error) {
      logger.error("Erro ao iniciar reclassificação histórica:", error);
      const message = error instanceof Error ? error.message : "Erro ao iniciar reclassificação";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsStarting(false);
    }
  }, [invoke, processLoop]);

  const pause = () => {
    stopRef.current = true;
    setIsPaused(true);
  };

  const resume = () => {
    if (!job?.id) return;
    processLoop(job.id);
  };

  const cancel = async () => {
    if (!job?.id) return;
    stopRef.current = true;
    await invoke({ action: "cancel", jobId: job.id });
    window.localStorage.removeItem(STORAGE_KEY);
    toast.info("Reclassificação cancelada");
  };

  useEffect(() => {
    if (!open) {
      stopRef.current = true;
      return;
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && !job) {
      refreshStatus(stored);
    }
  }, [open, job, refreshStatus]);

  useEffect(() => {
    if (!job || job.status !== "completed" || completedRef.current === job.id) return;
    completedRef.current = job.id;
    window.localStorage.removeItem(STORAGE_KEY);
    toast.success("Reclassificação histórica concluída");
    onComplete?.();
  }, [job, onComplete]);

  const canStart = !isStarting && !isProcessing && (!job || ["completed", "failed", "cancelled"].includes(job.status));
  const canResume = !isStarting && !isProcessing && isPaused && job && !["completed", "failed", "cancelled"].includes(job.status);
  const active = job && !["completed", "failed", "cancelled"].includes(job.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[82vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Reclassificação histórica por Centro de Custo
          </DialogTitle>
          <DialogDescription>
            Processa toda a base, inclusive contas manuais, em lotes retomáveis com Centro de Custo como âncora principal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {!job && !isStarting && (
            <div className="rounded-lg border bg-muted/30 p-5 space-y-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">Esta operação sobrescreve Departamento e Plano de Contas.</p>
                  <p className="text-sm text-muted-foreground">
                    O processamento é feito em lotes seguros e pode ser pausado/continuado sem perder o progresso.
                  </p>
                </div>
              </div>
              <Button onClick={startNewJob} size="lg" className="gap-2">
                <Play className="h-4 w-4" />
                Iniciar reclassificação da base histórica
              </Button>
            </div>
          )}

          {isStarting && (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <div>
                <div className="font-medium">Preparando job de reclassificação...</div>
                <div className="text-xs text-muted-foreground">Montando grupos por categoria, fornecedor, tipo e centro de custo.</div>
              </div>
            </div>
          )}

          {job && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={job.status === "completed" ? "default" : job.status === "failed" ? "destructive" : "secondary"}>
                      {job.status === "completed" ? "Concluído" : job.status === "cancelled" ? "Cancelado" : job.status === "failed" ? "Falhou" : isPaused ? "Pausado" : "Processando"}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{progress}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate max-w-[620px]">
                    {job.current_group || "Aguardando próximo lote"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isProcessing && (
                    <Button variant="outline" size="sm" onClick={pause} className="gap-2">
                      <Pause className="h-4 w-4" />
                      Pausar
                    </Button>
                  )}
                  {canResume && (
                    <Button variant="outline" size="sm" onClick={resume} className="gap-2">
                      <Play className="h-4 w-4" />
                      Continuar
                    </Button>
                  )}
                  {canStart && (
                    <Button variant="outline" size="sm" onClick={startNewJob} className="gap-2">
                      <RotateCcw className="h-4 w-4" />
                      Novo processamento
                    </Button>
                  )}
                  {active && (
                    <Button variant="ghost" size="sm" onClick={cancel} className="gap-2">
                      <XCircle className="h-4 w-4" />
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>

              <Progress value={progress} className="h-2" />

              <div className="grid gap-3 md:grid-cols-5">
                <div className="rounded-lg border bg-card p-3 text-center">
                  <div className="text-xl font-semibold">{job.total_groups}</div>
                  <div className="text-xs text-muted-foreground">Grupos</div>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center">
                  <div className="text-xl font-semibold">{job.processed_groups}</div>
                  <div className="text-xs text-muted-foreground">Processados</div>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center">
                  <div className="text-xl font-semibold text-primary">{job.affected_accounts}</div>
                  <div className="text-xs text-muted-foreground">Contas atualizadas</div>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center">
                  <div className="text-xl font-semibold">{job.low_confidence_groups}</div>
                  <div className="text-xs text-muted-foreground">Baixa confiança</div>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center">
                  <div className="text-xl font-semibold">{job.error_groups}</div>
                  <div className="text-xs text-muted-foreground">Erros</div>
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {errorMessage}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Últimos grupos processados</h4>
                  {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                <ScrollArea className="h-[220px] rounded-md border">
                  <div className="p-3 space-y-2">
                    {recent.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum grupo processado ainda.</p>
                    ) : recent.map((item, index) => (
                      <div key={`${item.categoria_nome}-${index}`} className="rounded-md bg-muted/40 p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">{item.categoria_nome}</span>
                          {item.status === "completed" ? (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              {item.account_count}
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Erro</Badge>
                          )}
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          {item.centro_custo_nome || "Sem centro de custo"}
                          {item.departamento_nome && ` · ${item.departamento_nome}`}
                          {item.plano_contas_codigo && ` · ${item.plano_contas_codigo} ${item.plano_contas_nome || ""}`}
                        </div>
                        {(item.error_message || item.justification) && (
                          <div className="mt-1 text-muted-foreground line-clamp-2">
                            {item.error_message || item.justification}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}