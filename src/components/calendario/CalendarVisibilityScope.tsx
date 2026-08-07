import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye, Users, User, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "./types";
import type { EquipeProjeto } from "@/hooks/useEquipesProjetos";

export type CalendarScope = "meus" | "equipe" | "todos";

export const CALENDAR_SCOPE_STORAGE_KEY = "calendario-geral:escopo";

export const CALENDAR_SCOPE_LABELS: Record<CalendarScope, string> = {
  meus: "Somente meus",
  equipe: "Minhas equipes",
  todos: "Tudo que tenho acesso",
};

const SCOPE_HINTS: Record<CalendarScope, string> = {
  meus: "Apenas tarefas sob minha responsabilidade e meus eventos.",
  equipe: "Inclui tarefas de colegas das equipes das quais participo.",
  todos: "Todos os projetos e eventos permitidos pelo meu acesso.",
};

const SCOPE_ICONS: Record<CalendarScope, ReactNode> = {
  meus: <User className="h-3.5 w-3.5" />,
  equipe: <Users className="h-3.5 w-3.5" />,
  todos: <Globe className="h-3.5 w-3.5" />,
};

/**
 * Restringe a visão do calendário conforme o escopo escolhido.
 *
 * O escopo nunca amplia o que o usuário pode ver — a base já chega filtrada
 * pelas regras de acesso do backend. Ele apenas reduz a visão para o próprio
 * usuário ou para as equipes das quais ele participa, evitando poluição com
 * compromissos de outros projetos/times.
 */
export function applyVisibilityScope(
  events: CalendarEvent[],
  opts: { scope: CalendarScope; userId?: string | null; equipes: EquipeProjeto[] },
): CalendarEvent[] {
  const { scope, userId, equipes } = opts;
  if (scope === "todos" || !userId) return events;

  const colegas = new Set<string>([userId]);
  if (scope === "equipe") {
    equipes
      .filter((e) => e.membros.includes(userId))
      .forEach((e) => e.membros.forEach((m) => colegas.add(m)));
  }

  return events.filter((ev) => {
    // Eventos avulsos já chegam restritos a autor/participante pelo backend.
    if (ev.tipo === "evento") return true;
    if (!ev.responsavel_id) return scope !== "meus";
    return colegas.has(ev.responsavel_id);
  });
}

interface Props {
  scope: CalendarScope;
  onChange: (scope: CalendarScope) => void;
  darkBg?: boolean;
}

export function CalendarVisibilityScope({ scope, onChange, darkBg = false }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 text-xs gap-1.5", darkBg && "bg-white/10 border-white/20 text-white hover:bg-white/20")}
        >
          {SCOPE_ICONS[scope]}
          <span className="hidden sm:inline">{CALENDAR_SCOPE_LABELS[scope]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs">
          <Eye className="h-3.5 w-3.5" />
          Visibilidade do calendário
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={scope} onValueChange={(v) => onChange(v as CalendarScope)}>
          {(Object.keys(CALENDAR_SCOPE_LABELS) as CalendarScope[]).map((s) => (
            <DropdownMenuRadioItem key={s} value={s} className="items-start gap-2">
              <div className="flex flex-col">
                <span className="text-xs font-medium">{CALENDAR_SCOPE_LABELS[s]}</span>
                <span className="text-[11px] text-muted-foreground">{SCOPE_HINTS[s]}</span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
          A visão nunca ultrapassa as permissões da sua conta.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
