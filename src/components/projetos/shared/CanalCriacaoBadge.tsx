import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CanalCriacaoBadgeProps {
  canal: string | null | undefined;
  className?: string;
}

/**
 * Mapeamento de cores por Canal de Criação (vindo do Asana).
 * Usa cores distintas e acessíveis em fundo escuro/claro. Chaves
 * normalizadas em lowercase + trim para tolerar variações do Asana.
 */
const CANAL_COLORS: Record<string, { bg: string; label: string }> = {
  "interno": { bg: "#6B7280", label: "Interno" },
  "design trade": { bg: "#8B5CF6", label: "Design Trade" },
  "mídias sociais": { bg: "#10B981", label: "Mídias Sociais" },
  "midias sociais": { bg: "#10B981", label: "Mídias Sociais" },
  "sites": { bg: "#3B82F6", label: "Sites" },
  "pdv": { bg: "#F97316", label: "PDV" },
  "anúncio": { bg: "#EF4444", label: "Anúncio" },
  "anuncio": { bg: "#EF4444", label: "Anúncio" },
  "impressão": { bg: "#EAB308", label: "Impressão" },
  "impressao": { bg: "#EAB308", label: "Impressão" },
  "e-mail": { bg: "#06B6D4", label: "E-mail" },
  "email": { bg: "#06B6D4", label: "E-mail" },
};

/**
 * Chip compacto que identifica visualmente o Canal de Criação da tarefa.
 * Cores oficiais por canal — tooltip mostra o nome completo.
 */
export function CanalCriacaoBadge({ canal, className = "" }: CanalCriacaoBadgeProps) {
  if (!canal) return null;
  const key = String(canal).trim().toLowerCase();
  const meta = CANAL_COLORS[key] ?? { bg: "#9CA3AF", label: canal };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center h-4 px-1.5 rounded-sm text-[9px] font-semibold text-white leading-none shrink-0 ${className}`}
            style={{ backgroundColor: meta.bg }}
            aria-label={`Canal: ${meta.label}`}
          >
            {meta.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Canal de criação: <strong>{meta.label}</strong>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
