import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  responsavelId?: string | null;
  nome?: string | null;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md";
  showName?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: { avatar: "h-5 w-5", text: "text-[8px]", icon: "h-2.5 w-2.5" },
  sm: { avatar: "h-6 w-6", text: "text-[9px]", icon: "h-3 w-3" },
  md: { avatar: "h-7 w-7", text: "text-[10px]", icon: "h-3.5 w-3.5" },
} as const;

function getInitials(name?: string | null): string {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Avatar padrão para mostrar o responsável de uma tarefa em listas/cards.
 * Sempre vem com tooltip e fallback (iniciais ou ícone neutro).
 */
export function TarefaResponsavelAvatar({
  responsavelId,
  nome,
  avatarUrl,
  size = "xs",
  showName = false,
  className,
}: Props) {
  const sizes = SIZE_MAP[size];
  const initials = getInitials(nome);
  const hasResponsavel = !!responsavelId;

  const avatar = (
    <Avatar
      className={cn(
        sizes.avatar,
        "shrink-0 border border-border/40",
        !hasResponsavel && "opacity-70",
        className,
      )}
    >
      {hasResponsavel && avatarUrl && (
        <AvatarImage src={avatarUrl} alt={nome || "Responsável"} referrerPolicy="no-referrer" />
      )}
      <AvatarFallback
        className={cn(
          sizes.text,
          hasResponsavel ? "bg-primary/15 text-primary font-semibold" : "bg-muted text-muted-foreground",
        )}
      >
        {hasResponsavel && initials ? initials : <UserIcon className={sizes.icon} />}
      </AvatarFallback>
    </Avatar>
  );

  const tooltipText = hasResponsavel
    ? `Responsável: ${nome || "Sem nome"}`
    : "Sem responsável";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1.5">
            {avatar}
            {showName && (
              <span className="text-xs text-muted-foreground hidden md:inline truncate max-w-[140px]">
                {nome || (hasResponsavel ? "Responsável" : "Sem responsável")}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
