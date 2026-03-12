import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, FileText, Shield, Package, Sparkles } from "lucide-react";
import { PRODUCT_STATUS_LABELS } from "@/hooks/useProdutoBrasil";

const PIPELINE_STEPS = [
  { key: "produto_importado", icon: Package },
  { key: "aguardando_precadastro", icon: Clock },
  { key: "precadastro_em_andamento", icon: FileText },
  { key: "aguardando_regulatorio", icon: Shield },
  { key: "aprovado_cadastro", icon: CheckCircle2 },
  { key: "produto_ativo", icon: Sparkles },
];

export function StatusPipeline({ currentStatus }: { currentStatus: string }) {
  const currentIndex = PIPELINE_STEPS.findIndex((s) => s.key === currentStatus);

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {PIPELINE_STEPS.map((step, idx) => {
        const Icon = step.icon;
        const isPast = idx < currentIndex;
        const isCurrent = idx === currentIndex;
        return (
          <div key={step.key} className="flex items-center gap-1">
            <div
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors",
                isCurrent && "bg-primary text-primary-foreground",
                isPast && "bg-success/15 text-success",
                !isPast && !isCurrent && "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{PRODUCT_STATUS_LABELS[step.key]?.split(" ").slice(0, 2).join(" ")}</span>
            </div>
            {idx < PIPELINE_STEPS.length - 1 && (
              <div className={cn("w-4 h-0.5 rounded-full", isPast ? "bg-success" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
