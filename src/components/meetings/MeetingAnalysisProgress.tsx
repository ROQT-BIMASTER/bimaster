import { CheckCircle2, Loader2, Mic, Sparkles, FileText, Brain, ListTodo, ShieldAlert, Lightbulb, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface PhaseStep {
  label: string;
  icon: React.ReactNode;
  progressRange: [number, number]; // [start, end]
}

const TRANSCRIPTION_PHASE: PhaseStep = {
  label: "Transcrição",
  icon: <Mic className="h-3.5 w-3.5" />,
  progressRange: [0, 84],
};

const PHASE_1_STEPS: PhaseStep[] = [
  { label: "Resumo Executivo", icon: <FileText className="h-3.5 w-3.5" />, progressRange: [85, 88] },
  { label: "Ata da Reunião", icon: <FileText className="h-3.5 w-3.5" />, progressRange: [85, 88] },
  { label: "Mapa Mental", icon: <Brain className="h-3.5 w-3.5" />, progressRange: [85, 92] },
];

const PHASE_2_STEPS: PhaseStep[] = [
  { label: "Insights", icon: <Lightbulb className="h-3.5 w-3.5" />, progressRange: [92, 96] },
  { label: "Tarefas", icon: <ListTodo className="h-3.5 w-3.5" />, progressRange: [92, 98] },
  { label: "Riscos", icon: <ShieldAlert className="h-3.5 w-3.5" />, progressRange: [92, 100] },
];

function getStepStatus(progress: number, step: PhaseStep): "pending" | "active" | "done" {
  if (progress >= step.progressRange[1]) return "done";
  if (progress >= step.progressRange[0]) return "active";
  return "pending";
}

function PhaseBlock({
  title,
  steps,
  progress,
  phaseRange,
}: {
  title: string;
  steps: PhaseStep[];
  progress: number;
  phaseRange: [number, number];
}) {
  const phaseDone = progress >= phaseRange[1];
  const phaseActive = progress >= phaseRange[0] && !phaseDone;
  const phasePending = progress < phaseRange[0];

  const phaseProgress = phasePending
    ? 0
    : phaseDone
    ? 100
    : Math.round(((progress - phaseRange[0]) / (phaseRange[1] - phaseRange[0])) * 100);

  return (
    <div className={cn(
      "rounded-lg border p-3 transition-all duration-500",
      phaseActive && "border-primary/40 bg-primary/5 shadow-sm",
      phaseDone && "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30",
      phasePending && "border-border/50 bg-muted/30 opacity-60"
    )}>
      {/* Phase header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {phaseDone ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : phaseActive ? (
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          ) : (
            <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
          )}
          <span className={cn(
            "text-xs font-semibold uppercase tracking-wide",
            phaseDone && "text-emerald-600 dark:text-emerald-400",
            phaseActive && "text-primary",
            phasePending && "text-muted-foreground"
          )}>
            {title}
          </span>
        </div>
        {phaseActive && (
          <span className="text-[10px] font-mono text-muted-foreground">{phaseProgress}%</span>
        )}
        {phaseDone && (
          <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">✓ Concluído</span>
        )}
      </div>

      {/* Phase progress bar */}
      {phaseActive && (
        <Progress value={phaseProgress} className="h-1.5 mb-2.5" gradient />
      )}

      {/* Steps */}
      <div className="grid grid-cols-3 gap-1.5">
        {steps.map((step, i) => {
          const status = getStepStatus(progress, step);
          return (
            <div
              key={i}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] transition-all duration-300",
                status === "done" && "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
                status === "active" && "bg-primary/10 text-primary",
                status === "pending" && "text-muted-foreground/60"
              )}
            >
              {status === "done" ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
              ) : status === "active" ? (
                <Sparkles className="h-3 w-3 text-primary animate-pulse shrink-0" />
              ) : (
                <span className="shrink-0">{step.icon}</span>
              )}
              <span className="truncate font-medium">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface MeetingAnalysisProgressProps {
  progress: number;
  detail: string;
  status: string;
}

export function MeetingAnalysisProgress({ progress, detail, status }: MeetingAnalysisProgressProps) {
  const isTranscribing = status === "transcribing";
  const isProcessing = status === "processing";
  const isDone = progress >= 100;

  return (
    <div className="space-y-3">
      {/* Overall header */}
      <div className="flex items-center gap-3">
        <div className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-colors",
          isDone ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-primary/10"
        )}>
          {isDone ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          ) : isTranscribing ? (
            <Mic className="h-5 w-5 text-primary animate-pulse" />
          ) : (
            <Brain className="h-5 w-5 text-primary animate-pulse" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {isDone ? "Análise Concluída!" :
               isTranscribing ? "Transcrevendo Áudio" :
               "Análise Inteligente em Andamento"}
            </p>
            <span className="text-xs font-mono text-muted-foreground ml-2">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2 mt-1.5" gradient />
          {detail && (
            <p className="text-[11px] text-muted-foreground mt-1">{detail}</p>
          )}
        </div>
      </div>

      {/* Phase blocks — only show during processing/analysis */}
      {(isProcessing || progress >= 85) && (
        <div className="grid gap-2 sm:grid-cols-2">
          <PhaseBlock
            title="Fase 1 — Estrutural"
            steps={PHASE_1_STEPS}
            progress={progress}
            phaseRange={[85, 92]}
          />
          <PhaseBlock
            title="Fase 2 — Extração"
            steps={PHASE_2_STEPS}
            progress={progress}
            phaseRange={[92, 100]}
          />
        </div>
      )}
    </div>
  );
}
