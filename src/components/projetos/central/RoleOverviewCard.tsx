import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCheck, Users, ChevronRight, EyeOff } from "lucide-react";
import { isToday, startOfDay } from "date-fns";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

interface Props {
  tarefas: MinaTarefa[];
  currentRole: "all" | "responsavel" | "colaborador";
  onSelectRole: (role: "all" | "responsavel" | "colaborador") => void;
  onHide: () => void;
}

/**
 * Card consolidado mostrando, em uma só visão, quantas tarefas o usuário
 * tem como responsável vs como colaborador, com totais de ativas e
 * atrasadas. Cada linha aplica o filtro "Meu papel" correspondente.
 */
export function RoleOverviewCard({ tarefas, currentRole, onSelectRole, onHide }: Props) {
  const stats = useMemo(() => {
    const now = startOfDay(new Date());
    const init = () => ({ ativas: 0, atrasadas: 0, hoje: 0 });
    const responsavel = init();
    const colaborador = init();
    let concluidasHoje = 0;

    for (const t of tarefas) {
      const bucket = t.papel === "colaborador" ? colaborador : responsavel;
      const isDone = t.status === "concluida";

      if (isDone) {
        if (t.data_conclusao && isToday(new Date(t.data_conclusao))) {
          concluidasHoje += 1;
        }
        continue;
      }

      bucket.ativas += 1;
      if (t.data_prazo) {
        const prazo = startOfDay(new Date(t.data_prazo));
        if (prazo < now) bucket.atrasadas += 1;
        else if (isToday(new Date(t.data_prazo))) bucket.hoje += 1;
      }
    }

    return {
      responsavel,
      colaborador,
      totalAtivas: responsavel.ativas + colaborador.ativas,
      concluidasHoje,
    };
  }, [tarefas]);

  return (
    <Card className="p-4 border-border/40 bg-gradient-to-br from-card to-muted/10">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Visão geral por papel</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sua carga total separada entre o que você entrega e o que acompanha.
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[11px] gap-1 text-muted-foreground"
          onClick={onHide}
          title="Ocultar este card"
        >
          <EyeOff className="h-3 w-3" /> Ocultar
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <RoleRow
          icon={<UserCheck className="h-4 w-4 text-primary" />}
          label="Sou responsável"
          stats={stats.responsavel}
          active={currentRole === "responsavel"}
          onClick={() => onSelectRole(currentRole === "responsavel" ? "all" : "responsavel")}
        />
        <RoleRow
          icon={<Users className="h-4 w-4 text-info" />}
          label="Estou colaborando"
          stats={stats.colaborador}
          active={currentRole === "colaborador"}
          onClick={() => onSelectRole(currentRole === "colaborador" ? "all" : "colaborador")}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-2">
        <span>
          Total ativo: <span className="font-semibold text-foreground">{stats.totalAtivas}</span>
          {" · "}
          Concluídas hoje: <span className="font-semibold text-foreground">{stats.concluidasHoje}</span>
        </span>
        {currentRole !== "all" && (
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => onSelectRole("all")}
          >
            Ver todos os papéis
          </button>
        )}
      </div>
    </Card>
  );
}

function RoleRow({
  icon,
  label,
  stats,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  stats: { ativas: number; atrasadas: number; hoje: number };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
        active
          ? "border-primary/40 bg-primary/5"
          : "border-border/40 bg-background hover:bg-muted/40"
      }`}
    >
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">{stats.ativas}</span> ativa{stats.ativas !== 1 ? "s" : ""}
          </span>
          {stats.atrasadas > 0 && (
            <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
              {stats.atrasadas} atrasada{stats.atrasadas > 1 ? "s" : ""}
            </Badge>
          )}
          {stats.hoje > 0 && (
            <Badge variant="outline" className="h-4 px-1.5 text-[10px] border-primary/40 text-primary">
              {stats.hoje} hoje
            </Badge>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}
