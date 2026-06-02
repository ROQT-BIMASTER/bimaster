import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RotateCcw, History } from "lucide-react";
import { useProjetoOffboarding } from "@/hooks/useProjetoOffboarding";
import { MOTIVOS_OFFBOARDING } from "@/lib/validations/projetoOffboarding";

const MOTIVO_LABEL = Object.fromEntries(MOTIVOS_OFFBOARDING.map((m) => [m.value, m.label]));

interface Props {
  projetoId: string;
  canRestaurar: boolean;
}

export function ExMembrosTab({ projetoId, canRestaurar }: Props) {
  const { exMembros, restaurar } = useProjetoOffboarding(projetoId);

  if (exMembros.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!exMembros.data || exMembros.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <History className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Nenhum membro removido nos últimos 15 dias.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[60vh]">
      <div className="space-y-2 pr-3">
        {exMembros.data.map((ex) => {
          const removidoEm = new Date(ex.removido_em);
          const diasRestantes = Math.max(
            0,
            15 - Math.floor((Date.now() - removidoEm.getTime()) / (24 * 3600 * 1000)),
          );
          return (
            <div key={ex.id} className="flex items-center gap-3 border rounded-md p-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={ex.profile?.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {ex.profile?.nome?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{ex.profile?.nome || "Usuário"}</p>
                  <Badge variant="secondary" className="text-[10px]">{ex.papel_anterior}</Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {MOTIVO_LABEL[ex.motivo] || ex.motivo}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Removido {formatDistanceToNow(removidoEm, { locale: ptBR, addSuffix: true })}
                  {ex.removedor_profile?.nome && ` por ${ex.removedor_profile.nome}`}
                  {" • "}
                  <span className={diasRestantes <= 3 ? "text-destructive font-medium" : ""}>
                    {diasRestantes} dia(s) até purga
                  </span>
                </p>
                {ex.motivo_detalhe && (
                  <p className="text-[11px] text-muted-foreground italic mt-0.5 truncate">
                    "{ex.motivo_detalhe}"
                  </p>
                )}
              </div>
              {canRestaurar && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => restaurar.mutate(ex.id)}
                  disabled={restaurar.isPending}
                  className="gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restaurar
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
