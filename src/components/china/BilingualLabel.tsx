import { cn } from "@/lib/utils";

interface BilingualLabelProps {
  pt: string;
  cn: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function BilingualLabel({ pt, cn: chinese, className, size = "md" }: BilingualLabelProps) {
  const sizes = {
    sm: { pt: "text-xs font-medium", cn: "text-[10px]" },
    md: { pt: "text-sm font-semibold", cn: "text-xs" },
    lg: { pt: "text-base font-bold", cn: "text-sm" },
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <span className={cn(sizes[size].pt, "text-foreground")}>{pt}</span>
      <span className={cn(sizes[size].cn, "text-muted-foreground")}>{chinese}</span>
    </div>
  );
}
