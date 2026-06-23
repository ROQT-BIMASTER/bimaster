/**
 * Resolve dinâmico de ícones lucide-react por nome.
 * Fallback: Square. Inerte fora do v2.
 */
import * as Icons from "lucide-react";
import { Square, type LucideIcon } from "lucide-react";

export function resolveIcon(name?: string | null): LucideIcon {
  if (!name) return Square;
  const key = name as keyof typeof Icons;
  const Comp = (Icons as any)[key];
  return (Comp ?? Square) as LucideIcon;
}
