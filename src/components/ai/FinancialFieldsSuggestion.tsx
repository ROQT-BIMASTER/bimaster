import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFinancialSuggestions } from "@/hooks/useExpenseAI";
import { Sparkles, Loader2, Check } from "lucide-react";

interface FinancialFieldsSuggestionProps {
  expenseId: string;
  onApplySuggestions: (fields: {
    document_type?: string;
    portador?: string;
    due_date?: string;
  }) => void;
}

export function FinancialFieldsSuggestion({
  expenseId,
  onApplySuggestions,
}: FinancialFieldsSuggestionProps) {
  const { suggest, isLoading, suggestions } = useFinancialSuggestions();

  const handleApply = () => {
    if (!suggestions) return;
    const today = new Date();
    let dueDate: string | undefined;
    if (suggestions.suggested_due_date_offset_days) {
      const d = new Date(today);
      d.setDate(d.getDate() + suggestions.suggested_due_date_offset_days);
      dueDate = d.toISOString().split("T")[0];
    }

    onApplySuggestions({
      document_type: suggestions.suggested_document_type,
      portador: suggestions.suggested_portador,
      due_date: dueDate,
    });
  };

  if (suggestions) {
    return (
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium">Sugestão da IA</span>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleApply}>
            <Check className="h-3 w-3" />
            Aplicar
          </Button>
        </div>
        {suggestions.reasoning && (
          <p className="text-xs text-muted-foreground">{suggestions.reasoning}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {suggestions.suggested_document_type && (
            <Badge variant="secondary" className="text-xs">
              Documento: {suggestions.suggested_document_type}
            </Badge>
          )}
          {suggestions.suggested_portador && (
            <Badge variant="secondary" className="text-xs">
              Portador: {suggestions.suggested_portador}
            </Badge>
          )}
          {suggestions.suggested_due_date_offset_days && (
            <Badge variant="secondary" className="text-xs">
              Vencimento: +{suggestions.suggested_due_date_offset_days} dias
            </Badge>
          )}
        </div>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5 text-xs"
      onClick={() => suggest(expenseId)}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5 text-primary" />
      )}
      Sugerir com IA
    </Button>
  );
}
