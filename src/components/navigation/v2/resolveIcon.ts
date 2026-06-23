/**
 * Resolve um nome de ícone lucide-react em runtime para um componente React.
 * Fallback: <Square /> quando o nome não existe.
 */
import * as Lucide from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function resolveIcon(name?: string | null): LucideIcon {
  if (!name) return Lucide.Square;
  const Icon = (Lucide as unknown as Record<string, LucideIcon>)[name];
  return Icon ?? Lucide.Square;
}
