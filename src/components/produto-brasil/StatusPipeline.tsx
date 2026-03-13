import { cn } from "@/lib/utils";
import {
  Lightbulb, FolderKanban, FileText, Wrench, FlaskConical,
  Package, Shield, ClipboardCheck, CheckCircle2, Factory, Rocket
} from "lucide-react";
import { PRODUCT_STATUS_LABELS } from "@/hooks/useProdutoBrasil";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const PIPELINE_STEPS = [
  { key: "ideia", icon: Lightbulb },
  { key: "projeto_vinculado", icon: FolderKanban },
  { key: "precadastro", icon: FileText },
  { key: "desenvolvimento", icon: Wrench },
  { key: "testes", icon: FlaskConical },
  { key: "embalagem", icon: Package },
  { key: "regulatorio", icon: Shield },
  { key: "cadastro_final", icon: ClipboardCheck },
  { key: "aprovacao", icon: CheckCircle2 },
  { key: "producao", icon: Factory },
  { key: "lancamento", icon: Rocket },
];

// Map legacy statuses to new pipeline positions
const LEGACY_MAP: Record<string, string> = {
  produto_importado: "ideia",
  aguardando_precadastro: "precadastro",
  precadastro_em_andamento: "precadastro",
  aguardando_regulatorio: "regulatorio",
  aprovado_cadastro: "cadastro_final",
  produto_ativo: "lancamento",
};

export function StatusPipeline({ currentStatus }: { currentStatus: string }) {
  const mappedStatus = LEGACY_MAP[currentStatus] || currentStatus;
  const currentIndex = PIPELINE_STEPS.findIndex((s) => s.key === mappedStatus);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
        {PIPELINE_STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isPast = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const label = PRODUCT_STATUS_LABELS[step.key] || step.key;

          return (
            <div key={step.key} className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "flex items-center gap-1 px-2 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-all cursor-default",
                      isCurrent && "bg-primary text-primary-foreground shadow-sm scale-105",
                      isPast && "bg-success/15 text-success",
                      !isPast && !isCurrent && "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="h-3 w-3 flex-shrink-0" />
                    <span className="hidden lg:inline">{label.split(" ").slice(0, 2).join(" ")}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p className="font-medium">{label}</p>
                  <p className="text-muted-foreground">
                    {isPast ? "✅ Concluído" : isCurrent ? "🔵 Etapa atual" : "⏳ Pendente"}
                  </p>
                </TooltipContent>
              </Tooltip>
              {idx < PIPELINE_STEPS.length - 1 && (
                <div className={cn(
                  "w-3 h-0.5 rounded-full flex-shrink-0",
                  isPast ? "bg-success" : "bg-border"
                )} />
              )}
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
