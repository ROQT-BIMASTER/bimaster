import { cn } from "@/lib/utils";

interface ProvadorBadgeProps {
  className?: string;
  size?: "xs" | "sm";
}

/**
 * Badge visual para sinalizar que um produto é PROVADOR (amostra),
 * não destinado à venda. Padrão âmbar para destaque sem competir com kits.
 */
export function ProvadorBadge({ className, size = "xs" }: ProvadorBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border font-semibold uppercase tracking-wide",
        "bg-amber-100 text-amber-800 border-amber-300",
        "dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40",
        size === "xs" ? "px-1.5 py-0 text-[9px] leading-4" : "px-2 py-0.5 text-[10px] leading-4",
        className
      )}
      title="Produto provador (amostra) — não é destinado à venda"
    >
      Provador
    </span>
  );
}
