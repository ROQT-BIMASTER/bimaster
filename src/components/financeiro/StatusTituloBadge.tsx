import { Badge } from "@/components/ui/badge";
import { StatusTitulo } from "@/types/financeiro/contas-pagar";

/**
 * Badge unificado para status de títulos financeiros (AP/AR).
 *
 * Cobre:
 *  - Os 4 valores persistidos pelo backend (UPPERCASE — `StatusTitulo`).
 *  - Status calculados via `useFinancialStatus` (ex.: "parcial").
 *  - Alias semântico para AR: "recebido" → mesmo visual de "pago".
 *
 * Substitui implementações duplicadas em CalendarioVencimentos e
 * CalendarioRecebimentos (e potencialmente outras telas no futuro).
 */
type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

interface VariantConfig {
  variant: BadgeVariant;
  label: string;
}

const VARIANTS: Record<string, VariantConfig> = {
  // Valores persistidos (UPPERCASE — fonte da verdade do backend/SDK)
  [StatusTitulo.PAGO]: { variant: "default", label: "Pago" },
  [StatusTitulo.PENDENTE]: { variant: "outline", label: "Pendente" },
  [StatusTitulo.VENCIDO]: { variant: "destructive", label: "Vencido" },
  [StatusTitulo.CANCELADO]: { variant: "secondary", label: "Cancelado" },

  // Variantes lowercase (compatibilidade com `useFinancialStatus`,
  // que normaliza status para minúsculas)
  pago: { variant: "default", label: "Pago" },
  pendente: { variant: "outline", label: "Pendente" },
  vencido: { variant: "destructive", label: "Vencido" },
  cancelado: { variant: "secondary", label: "Cancelado" },

  // Status calculado (não persistido)
  parcial: { variant: "secondary", label: "Parcial" },

  // Alias AR — mesmo visual de "pago"
  recebido: { variant: "default", label: "Recebido" },
  RECEBIDO: { variant: "default", label: "Recebido" },
};

export interface StatusTituloBadgeProps {
  status: string | null | undefined;
}

export function StatusTituloBadge({ status }: StatusTituloBadgeProps) {
  const key = status ?? "";
  const config =
    VARIANTS[key] ??
    VARIANTS[key.toLowerCase?.() ?? ""] ??
    VARIANTS[StatusTitulo.PENDENTE];

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
