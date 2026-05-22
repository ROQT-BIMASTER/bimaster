import { cn } from "@/lib/utils";

interface Props {
  codigo?: string | null;
  nome?: string | null;
  className?: string;
  variant?: "inline" | "stacked";
}

/**
 * Renderiza identificação de produto (Código + Descrição) de forma padronizada.
 * Use sempre que listar/exibir um produto da Fábrica.
 *
 * - variant="inline": "COD123 — Descrição" em uma linha
 * - variant="stacked": código em mono pequeno acima, descrição abaixo
 */
export function ProdutoIdent({ codigo, nome, className, variant = "stacked" }: Props) {
  const cod = (codigo || "").trim();
  const desc = (nome || "").trim();
  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-baseline gap-1.5", className)} title={desc || cod}>
        {cod && <span className="font-mono text-xs text-muted-foreground">{cod}</span>}
        {cod && desc && <span className="text-muted-foreground">—</span>}
        {desc && <span>{desc}</span>}
        {!cod && !desc && <span className="text-muted-foreground">—</span>}
      </span>
    );
  }
  return (
    <div className={cn("min-w-0", className)}>
      {cod && (
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {cod}
        </div>
      )}
      <div className="text-sm leading-tight" title={desc || undefined}>
        {desc || <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}
