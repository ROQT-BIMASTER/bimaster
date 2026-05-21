import { ArrowLeft, Link2, MoreHorizontal, Download, Users } from "lucide-react";
import { useState } from "react";
import { BriefingMembrosDialog } from "./BriefingMembrosDialog";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { getStatusBadge, getTipoMeta } from "./briefing-types";
import type { Briefing } from "@/hooks/useBriefingChat";

interface Props {
  briefing: Briefing;
  projetoNome?: string | null;
  onVoltar: () => void;
  onVincularProjeto: () => void;
  onAbrirProjeto?: () => void;
  onExportar?: () => void;
  podeEnviarAprovacao: boolean;
  jaEmAprovacao: boolean;
  onEnviarAprovacao: () => void;
  onCancelarAprovacao?: () => void;
}

export function BriefingHeader({
  briefing,
  projetoNome,
  onVoltar,
  onVincularProjeto,
  onAbrirProjeto,
  onExportar,
  podeEnviarAprovacao,
  jaEmAprovacao,
  onEnviarAprovacao,
  onCancelarAprovacao,
}: Props) {
  const navigate = useNavigate();
  const [membrosOpen, setMembrosOpen] = useState(false);
  const tipo = getTipoMeta(briefing.tipo);
  const status = getStatusBadge(briefing.status);

  return (
    <div className="border-b bg-background">
      <div className="px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={onVoltar}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-semibold shrink-0 ${tipo.bg} ${tipo.fg}`}
          aria-hidden
        >
          {tipo.label.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold truncate">{briefing.titulo}</h1>
            <Badge variant="outline" className={`text-[10px] uppercase ${tipo.fg} border-current`}>
              {tipo.label}
            </Badge>
            {projetoNome && (
              <button
                type="button"
                onClick={onAbrirProjeto}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
                title="Abrir projeto vinculado"
              >
                <Link2 className="h-3 w-3" />
                <span className="truncate max-w-[180px]">{projetoNome}</span>
              </button>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3">
            <div className="flex-1 max-w-xs">
              <Progress value={briefing.completude} className="h-1" />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {briefing.completude}% completo
            </span>
          </div>
        </div>

        <Badge className={`${status.className} border-0`}>{status.label}</Badge>

        {!projetoNome && (
          <Button variant="outline" size="sm" onClick={onVincularProjeto}>
            <Link2 className="h-3.5 w-3.5 mr-1.5" />
            Vincular projeto
          </Button>
        )}

        {jaEmAprovacao ? (
          <Button variant="outline" size="sm" onClick={onCancelarAprovacao}>
            Cancelar aprovação
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onEnviarAprovacao}
            disabled={!podeEnviarAprovacao}
            title={
              podeEnviarAprovacao
                ? "Enviar para aprovação"
                : "Conclua o canvas (100%) para enviar"
            }
          >
            Enviar para aprovação
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {projetoNome && (
              <DropdownMenuItem onClick={onVincularProjeto}>
                <Link2 className="h-3.5 w-3.5 mr-2" /> Trocar projeto vinculado
              </DropdownMenuItem>
            )}
            {onExportar && (
              <DropdownMenuItem onClick={onExportar}>
                <Download className="h-3.5 w-3.5 mr-2" /> Exportar
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/dashboard/briefings")}>
              Voltar para a lista
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
