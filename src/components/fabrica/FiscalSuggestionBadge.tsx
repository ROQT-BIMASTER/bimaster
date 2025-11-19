import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FiscalSuggestionBadgeProps {
  value: string;
  reason: string;
  onApply: () => void;
}

export const FiscalSuggestionBadge = ({ value, reason, onApply }: FiscalSuggestionBadgeProps) => {
  return (
    <div className="flex items-start gap-2 mt-1 p-2 bg-primary/5 rounded-md border border-primary/20">
      <Lightbulb className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
      <div className="flex-1 text-xs">
        <p className="text-primary font-medium">Sugestão IA: {value}</p>
        <p className="text-muted-foreground">{reason}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onApply}
        className="h-6 px-2 text-xs"
      >
        Aplicar
      </Button>
    </div>
  );
};
