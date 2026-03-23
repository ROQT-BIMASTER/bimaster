import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

interface IACategorySuggestionProps {
  sugestao: string;
  confianca: number;
  onAccept: () => void;
  onReject: () => void;
}

export function IACategorySuggestion({
  sugestao,
  confianca,
  onAccept,
  onReject,
}: IACategorySuggestionProps) {
  const pct = Math.round(confianca * 100);

  return (
    <div className="flex items-center gap-2 mt-1 text-sm">
      <Badge
        variant="outline"
        className="border-[#2563EB]/30 bg-[#2563EB]/5 text-[#2563EB] text-xs"
      >
        Sugerido por IA — {sugestao} ({pct}%)
      </Badge>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0 text-[#16A34A]"
        onClick={onAccept}
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0 text-[#DC2626]"
        onClick={onReject}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
