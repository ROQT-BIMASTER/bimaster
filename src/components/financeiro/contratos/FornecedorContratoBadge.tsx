import { useState } from "react";
import { FileText, FileCheck2, FileX2, FilePlus2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFornecedorContrato } from "@/hooks/useFornecedorContrato";
import { FornecedorContratoDialog } from "./FornecedorContratoDialog";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { format } from "date-fns";

interface Props {
  fornecedorCodigo: string | null | undefined;
  fornecedorNome: string;
  /** Renderiza apenas ícone (sem texto) */
  iconOnly?: boolean;
  className?: string;
}

/**
 * Chip pequeno que abre o dialog de gestão do contrato do fornecedor.
 * Mostra estado: ativo (verde) | cancelado (âmbar) | sem contrato (cinza).
 */
export function FornecedorContratoBadge({
  fornecedorCodigo,
  fornecedorNome,
  iconOnly,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const { data: contratos = [] } = useFornecedorContrato(
    fornecedorCodigo,
    fornecedorNome,
  );

  const ativo = contratos.find((c) => c.tipo === "ativo");
  const ultimoCancel = contratos.find((c) => c.tipo === "cancelamento");

  let status: "ativo" | "cancelado" | "sem" = "sem";
  let label = "Sem contrato";
  let icon = <FilePlus2 className="h-3 w-3" />;
  let cls = "bg-muted/40 text-muted-foreground hover:bg-muted border-border";
  let tooltip = "Cadastrar contrato deste fornecedor";

  if (ativo) {
    status = "ativo";
    label = "Contrato ativo";
    icon = <FileCheck2 className="h-3 w-3" />;
    cls = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30";
    const ini = parseLocalDate(ativo.data_vigencia_inicio);
    const fim = parseLocalDate(ativo.data_vigencia_fim);
    tooltip = `Vigência ${ini ? format(ini, "dd/MM/yyyy") : "—"}${
      fim ? ` → ${format(fim, "dd/MM/yyyy")}` : " (sem prazo)"
    }`;
  } else if (ultimoCancel) {
    status = "cancelado";
    label = "Cancelado";
    icon = <FileX2 className="h-3 w-3" />;
    cls = "bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/30";
    const fim = parseLocalDate(ultimoCancel.data_vigencia_fim);
    tooltip = fim ? `Cancelado em ${format(fim, "dd/MM/yyyy")}` : "Contrato cancelado";
  }

  const button = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setOpen(true);
      }}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors cursor-pointer ${cls} ${className || ""}`}
      title={tooltip}
    >
      {icon}
      {!iconOnly && <span>{label}</span>}
    </button>
  );

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {open && (
        <FornecedorContratoDialog
          open={open}
          onOpenChange={setOpen}
          fornecedorCodigo={fornecedorCodigo}
          fornecedorNome={fornecedorNome}
        />
      )}
    </>
  );
}

/**
 * Wrapper que renderiza nome do fornecedor + badge do contrato lado a lado.
 */
export function FornecedorNomeComContrato({
  fornecedorCodigo,
  fornecedorNome,
  className,
  textClassName,
}: {
  fornecedorCodigo: string | null | undefined;
  fornecedorNome: string;
  className?: string;
  textClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${className || ""}`}>
      <span className={`truncate ${textClassName || ""}`}>{fornecedorNome}</span>
      <FornecedorContratoBadge
        fornecedorCodigo={fornecedorCodigo}
        fornecedorNome={fornecedorNome}
        iconOnly
      />
    </span>
  );
}
