import React from "react";
import { formatCurrencySmart } from "@/lib/formatters";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SmartValueProps {
  value: number;
  className?: string;
  decimals?: number;
  showTooltip?: boolean;
}

/**
 * Componente que exibe valores monetários de forma inteligente
 * - Valores >= 1M: mostra como "R$ 76,8M" com tooltip do valor completo
 * - Valores >= 1K: mostra como "R$ 568,2K" com tooltip do valor completo
 * - Valores menores: mostra valor completo
 */
export function SmartValue({ 
  value, 
  className, 
  decimals = 1,
  showTooltip = true 
}: SmartValueProps) {
  const { formatted, full, suffix } = formatCurrencySmart(value, { decimals });
  
  if (!suffix || !showTooltip) {
    return <span className={className}>{formatted}</span>;
  }
  
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span className={cn("cursor-help underline decoration-dotted underline-offset-2", className)}>
            {formatted}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="font-mono text-sm">
          {full}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Legenda para explicar abreviações M/K
 */
export function ValueLegend({ className }: { className?: string }) {
  return (
    <div className={cn(
      "text-xs text-muted-foreground flex items-center gap-2",
      className
    )}>
      <span className="flex items-center gap-1">
        <span className="font-semibold">M</span> = Milhões
      </span>
      <span className="text-muted-foreground/50">|</span>
      <span className="flex items-center gap-1">
        <span className="font-semibold">K</span> = Milhares
      </span>
    </div>
  );
}
