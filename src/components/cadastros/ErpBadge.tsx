import { Badge } from "@/components/ui/badge";
import { Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErpBadgeProps {
  code?: string | null;
  className?: string;
  /** Se true, exibe o código do ERP junto ao rótulo. */
  showCode?: boolean;
}

/**
 * Badge somente-leitura indicando que o cadastro veio do ERP Result.
 * Retorna null quando não há código.
 */
export function ErpBadge({ code, className, showCode = false }: ErpBadgeProps) {
  if (!code) return null;
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 text-[10px] font-medium border-primary/30 text-primary", className)}
      title={`Origem Result — código ${code}`}
    >
      <Database className="h-3 w-3" />
      Result{showCode ? ` · ${code}` : ""}
    </Badge>
  );
}
