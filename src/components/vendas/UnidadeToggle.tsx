import { useEffect } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CX_INDISPONIVEL_AGGREGADO,
  UNIDADE_LABEL,
  type Unidade,
} from "@/lib/vendas/unidade";

const STORAGE_KEY = "vendas:unidade";

export function loadUnidade(): Unidade {
  if (typeof window === "undefined") return "DZ";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "UN" || v === "CX" || v === "DZ" ? v : "DZ";
}

interface Props {
  value: Unidade;
  onChange: (u: Unidade) => void;
  /** Quando true, desabilita CX (agregados multi-produto). */
  disableCx?: boolean;
}

export function UnidadeToggle({ value, onChange, disableCx = false }: Props) {
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, value); } catch { /* noop */ }
  }, [value]);

  // Se CX estiver selecionada e for desabilitada, força DZ.
  useEffect(() => {
    if (disableCx && value === "CX") onChange("DZ");
  }, [disableCx, value, onChange]);

  return (
    <TooltipProvider>
      <div className="inline-flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Unidade
        </span>
        <ToggleGroup
          type="single"
          value={value}
          onValueChange={(v) => v && onChange(v as Unidade)}
          className="rounded-full bg-muted p-0.5"
        >
          <ToggleGroupItem value="DZ" className="h-8 px-3 text-xs rounded-full data-[state=on]:bg-card data-[state=on]:shadow-sm">
            {UNIDADE_LABEL.DZ}
          </ToggleGroupItem>
          <ToggleGroupItem value="UN" className="h-8 px-3 text-xs rounded-full data-[state=on]:bg-card data-[state=on]:shadow-sm">
            {UNIDADE_LABEL.UN}
          </ToggleGroupItem>
          {disableCx ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <ToggleGroupItem value="CX" disabled className="h-8 px-3 text-xs rounded-full opacity-50">
                    {UNIDADE_LABEL.CX}
                  </ToggleGroupItem>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">{CX_INDISPONIVEL_AGGREGADO}</TooltipContent>
            </Tooltip>
          ) : (
            <ToggleGroupItem value="CX" className="h-8 px-3 text-xs rounded-full data-[state=on]:bg-card data-[state=on]:shadow-sm">
              {UNIDADE_LABEL.CX}
            </ToggleGroupItem>
          )}
        </ToggleGroup>
      </div>
    </TooltipProvider>
  );
}
