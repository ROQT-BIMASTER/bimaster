/**
 * PresenceStatusPicker — dropdown pra trocar status declarado.
 *
 * Aparece no header da sidebar do chat. Mostra status atual (bolinha
 * colorida + label) e abre dropdown com as 5 opções. Padrão Teams/Slack.
 */
import { useMyPresenceStatus, PRESENCE_STATUS_INFO, PRESENCE_STATUS_OPTIONS, type PresenceStatus } from "@/hooks/chat/usePresenceStatus";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function PresenceStatusPicker({ compact = false }: { compact?: boolean }) {
  const { data, setStatus } = useMyPresenceStatus();
  const current: PresenceStatus = (data?.status as PresenceStatus) ?? "disponivel";
  const info = PRESENCE_STATUS_INFO[current];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 gap-1.5 px-2 -ml-1",
            compact && "h-6 text-xs",
          )}
          title="Trocar status de presença"
        >
          <span className={cn("h-2.5 w-2.5 rounded-full", info.color)} />
          <span className={cn("text-xs font-medium", info.textColor)}>{info.label}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Definir status
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PRESENCE_STATUS_OPTIONS.map((s) => {
          const i = PRESENCE_STATUS_INFO[s];
          const ativo = current === s;
          return (
            <DropdownMenuItem
              key={s}
              onSelect={() => setStatus.mutate({ status: s })}
              className="gap-2"
            >
              <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", i.color)} />
              <span className="flex-1 text-sm">{i.label}</span>
              {ativo && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
