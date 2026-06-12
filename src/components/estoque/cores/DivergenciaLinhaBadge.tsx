import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  linhas: string[] | null | undefined;
  compact?: boolean;
}

export function DivergenciaLinhaBadge({ linhas, compact }: Props) {
  if (!linhas || linhas.length < 2) return null;
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex items-center gap-1 rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning cursor-help"
            onClick={(e) => e.stopPropagation()}
          >
            <AlertTriangle className="h-3 w-3" />
            {compact ? 'Linha' : 'Divergência de linha'}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <div className="font-semibold mb-1">Mesmo SKU cadastrado em linhas diferentes no ERP</div>
          <ul className="space-y-0.5">
            {linhas.map((l) => (
              <li key={l} className="font-mono">• {l}</li>
            ))}
          </ul>
          <div className="mt-2 text-muted-foreground">
            Corrija o cadastro do produto no ERP. O saldo unificado já soma todas as filiais.
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
