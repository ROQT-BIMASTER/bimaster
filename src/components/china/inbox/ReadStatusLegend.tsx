import { CheckCheck, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useChinaI18n } from "@/hooks/useChinaI18n";

interface Props {
  className?: string;
}

/**
 * Legenda compacta explicando o destaque de "não lido" (título em negrito + fundo
 * card) e o indicador de leitura (dois checks azuis, padrão WhatsApp). Usado tanto
 * na Caixa de Entrada China quanto na tela de Vincular China-Brasil.
 */
export function ReadStatusLegend({ className }: Props) {
  const { t } = useChinaI18n();
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground/70 hover:bg-muted/40 hover:text-foreground transition-colors",
              className,
            )}
            aria-label={t("inbox.readLegend.trigger")}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="max-w-[260px] text-[11px] leading-relaxed">
          <p className="font-semibold text-foreground mb-1">{t("inbox.readLegend.titulo")}</p>
          <p className="mb-1.5">{t("inbox.readLegend.naoLida")}</p>
          <p className="flex items-center gap-1.5">
            <CheckCheck className="h-3 w-3 text-sky-400 shrink-0" />
            {t("inbox.readLegend.lida")}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
