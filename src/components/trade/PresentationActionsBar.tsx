import { Button } from "@/components/ui/button";
import { FileText, X } from "lucide-react";

interface Props {
  count: number;
  onClear: () => void;
  onGenerate: () => void;
}

export function PresentationActionsBar({ count, onClear, onGenerate }: Props) {
  if (count === 0) return null;

  return (
    <div className="sticky bottom-4 z-40 mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-background/95 backdrop-blur-sm shadow-lg px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClear}
            aria-label="Limpar seleção"
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="text-sm">
            <span className="font-bold">{count}</span>
            <span className="text-muted-foreground">
              {" "}
              {count === 1 ? "card selecionado" : "cards selecionados"}
            </span>
          </div>
        </div>
        <Button
          size="sm"
          className="gap-1.5 text-xs bg-trade hover:bg-trade-dark"
          onClick={onGenerate}
        >
          <FileText className="h-3.5 w-3.5" />
          Gerar Apresentação
        </Button>
      </div>
    </div>
  );
}
