import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Type, Minus, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export type FontSizeLevel = 'xs' | 'sm' | 'base' | 'lg' | 'xl';

interface DREFontSizeControlProps {
  currentSize: FontSizeLevel;
  onSizeChange: (size: FontSizeLevel) => void;
  className?: string;
}

const fontSizeOptions: { value: FontSizeLevel; label: string; description: string }[] = [
  { value: 'xs', label: 'Extra Pequeno', description: 'Ideal para muitos dados na tela' },
  { value: 'sm', label: 'Pequeno', description: 'Visão compacta' },
  { value: 'base', label: 'Médio', description: 'Padrão equilibrado' },
  { value: 'lg', label: 'Grande', description: 'Melhor legibilidade' },
  { value: 'xl', label: 'Extra Grande', description: 'Máxima legibilidade' },
];

export const fontSizeClasses: Record<FontSizeLevel, {
  text: string;
  value: string;
  header: string;
  padding: string;
}> = {
  xs: {
    text: 'text-[10px]',
    value: 'text-[10px]',
    header: 'text-[11px]',
    padding: 'py-0.5 px-1',
  },
  sm: {
    text: 'text-xs',
    value: 'text-xs',
    header: 'text-xs',
    padding: 'py-1 px-1.5',
  },
  base: {
    text: 'text-sm',
    value: 'text-sm',
    header: 'text-sm',
    padding: 'py-1.5 px-2',
  },
  lg: {
    text: 'text-base',
    value: 'text-base',
    header: 'text-base',
    padding: 'py-2 px-2.5',
  },
  xl: {
    text: 'text-lg',
    value: 'text-lg',
    header: 'text-lg',
    padding: 'py-2.5 px-3',
  },
};

export const DREFontSizeControl = memo(({ currentSize, onSizeChange, className }: DREFontSizeControlProps) => {
  const currentIndex = fontSizeOptions.findIndex(o => o.value === currentSize);
  
  const handleDecrease = () => {
    if (currentIndex > 0) {
      onSizeChange(fontSizeOptions[currentIndex - 1].value);
    }
  };
  
  const handleIncrease = () => {
    if (currentIndex < fontSizeOptions.length - 1) {
      onSizeChange(fontSizeOptions[currentIndex + 1].value);
    }
  };
  
  const handleReset = () => {
    onSizeChange('sm');
  };

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-1", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleDecrease}
              disabled={currentIndex === 0}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Diminuir texto</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2 gap-1.5 min-w-[100px]">
                  <Type className="h-3.5 w-3.5" />
                  <span className="text-xs">{fontSizeOptions[currentIndex]?.label}</span>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Tamanho do texto</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            {fontSizeOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => onSizeChange(option.value)}
                className={cn(
                  "flex flex-col items-start gap-0.5",
                  currentSize === option.value && "bg-accent"
                )}
              >
                <span className="font-medium">{option.label}</span>
                <span className="text-[10px] text-muted-foreground">{option.description}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleIncrease}
              disabled={currentIndex === fontSizeOptions.length - 1}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Aumentar texto</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleReset}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Restaurar padrão</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
});

DREFontSizeControl.displayName = "DREFontSizeControl";
