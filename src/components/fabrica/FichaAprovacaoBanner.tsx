import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, CheckCircle2, AlertTriangle, FileEdit } from "lucide-react";
import type { StatusAprovacao } from "@/hooks/useFichaRevisao";

const statusConfig: Record<StatusAprovacao, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline"; alertClass: string; description: string }> = {
  rascunho: {
    label: "Rascunho",
    icon: <FileEdit className="h-4 w-4" />,
    variant: "secondary",
    alertClass: "border-muted-foreground/30 bg-muted/50",
    description: "Ficha em edição. Preencha os dados e submeta para aprovação da Diretoria.",
  },
  em_revisao: {
    label: "Em Revisão",
    icon: <Clock className="h-4 w-4" />,
    variant: "outline",
    alertClass: "border-amber-500/50 bg-amber-50 dark:bg-amber-950/20",
    description: "Ficha submetida e aguardando análise da Diretoria. Os campos estão bloqueados.",
  },
  aprovada: {
    label: "Aprovada",
    icon: <CheckCircle2 className="h-4 w-4" />,
    variant: "default",
    alertClass: "border-green-500/50 bg-green-50 dark:bg-green-950/20",
    description: "Ficha aprovada pela Diretoria. Pronta para gerar tabelas de preços.",
  },
  revisao_solicitada: {
    label: "Revisão Solicitada",
    icon: <AlertTriangle className="h-4 w-4" />,
    variant: "destructive",
    alertClass: "border-orange-500/50 bg-orange-50 dark:bg-orange-950/20",
    description: "A Diretoria solicitou ajustes. Verifique os apontamentos abaixo e resubmeta.",
  },
};

interface Props {
  status: StatusAprovacao;
  parecer?: string | null;
}

export function FichaAprovacaoBanner({ status, parecer }: Props) {
  const cfg = statusConfig[status];

  return (
    <Alert className={cfg.alertClass}>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {cfg.icon}
          <Badge variant={cfg.variant} className="text-xs">
            {cfg.label}
          </Badge>
        </div>
        <AlertDescription className="text-sm">
          {cfg.description}
        </AlertDescription>
      </div>
      {parecer && status === "revisao_solicitada" && (
        <div className="mt-3 p-3 bg-background/80 rounded-md border text-sm">
          <span className="font-medium">Parecer da Diretoria: </span>
          {parecer}
        </div>
      )}
    </Alert>
  );
}

export function StatusAprovacaoBadge({ status }: { status: StatusAprovacao }) {
  const cfg = statusConfig[status];
  return (
    <Badge variant={cfg.variant} className="gap-1 text-xs">
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}
