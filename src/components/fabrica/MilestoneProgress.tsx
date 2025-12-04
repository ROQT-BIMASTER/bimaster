import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface MilestoneProgressProps {
  currentStatus: string;
  className?: string;
  variant?: "default" | "compact";
}

const milestones = [
  { status: "planejado", label: "Planejado" },
  { status: "em_preparacao", label: "Preparação" },
  { status: "aprovado", label: "Aprovado" },
  { status: "lancado", label: "Lançado" },
];

const statusOrder: Record<string, number> = {
  planejado: 0,
  em_preparacao: 1,
  aprovado: 2,
  lancado: 3,
  cancelado: -1,
};

export default function MilestoneProgress({ 
  currentStatus, 
  className,
  variant = "default" 
}: MilestoneProgressProps) {
  const currentIndex = statusOrder[currentStatus] ?? -1;
  const isCanceled = currentStatus === "cancelado";

  if (isCanceled) {
    return (
      <div className={cn("flex items-center gap-1 text-xs text-red-500", className)}>
        <span className="h-2 w-2 rounded-full bg-red-500" />
        Cancelado
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {milestones.map((milestone, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          
          return (
            <div key={milestone.status} className="flex items-center">
              <div
                className={cn(
                  "h-2 w-2 rounded-full transition-all",
                  isCompleted 
                    ? isCurrent 
                      ? "bg-primary ring-2 ring-primary/30" 
                      : "bg-primary"
                    : "bg-muted-foreground/30"
                )}
                title={milestone.label}
              />
              {index < milestones.length - 1 && (
                <div 
                  className={cn(
                    "h-0.5 w-3 mx-0.5",
                    index < currentIndex ? "bg-primary" : "bg-muted-foreground/30"
                  )} 
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {milestones.map((milestone, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isPending = index > currentIndex;

        return (
          <div key={milestone.status} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex items-center justify-center rounded-full transition-all",
                  variant === "default" ? "h-6 w-6" : "h-4 w-4",
                  isCompleted && "bg-primary text-primary-foreground",
                  isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  isPending && "bg-muted border-2 border-muted-foreground/30"
                )}
              >
                {isCompleted && <Check className={cn(variant === "default" ? "h-3.5 w-3.5" : "h-2.5 w-2.5")} />}
                {isCurrent && <div className={cn("rounded-full bg-primary-foreground", variant === "default" ? "h-2 w-2" : "h-1.5 w-1.5")} />}
              </div>
              {variant === "default" && (
                <span className={cn(
                  "text-[10px] mt-1 whitespace-nowrap",
                  isCurrent ? "text-primary font-medium" : "text-muted-foreground"
                )}>
                  {milestone.label}
                </span>
              )}
            </div>
            
            {index < milestones.length - 1 && (
              <div 
                className={cn(
                  "h-0.5 mx-1",
                  variant === "default" ? "w-8" : "w-4",
                  isCompleted ? "bg-primary" : "bg-muted-foreground/30"
                )} 
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
