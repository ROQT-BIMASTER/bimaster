import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FuturaBackButtonProps {
  /** Rota de fallback quando não houver histórico. Default: home do módulo Fornecedor. */
  fallbackTo?: string;
  className?: string;
  label?: string;
}

/**
 * Botão "Voltar" padronizado para todas as telas do módulo Futura (Fornecedor).
 * - Alinhado à esquerda, ícone de seta + label.
 * - navigate(-1) quando há histórico, senão vai para `fallbackTo`.
 */
export function FuturaBackButton({
  fallbackTo = "/dashboard/fornecedor",
  className,
  label = "Voltar",
}: FuturaBackButtonProps) {
  const navigate = useNavigate();
  return (
    <div className={cn("flex", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          typeof window !== "undefined" && window.history.length > 1
            ? navigate(-1)
            : navigate(fallbackTo)
        }
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        {label}
      </Button>
    </div>
  );
}

export default FuturaBackButton;
