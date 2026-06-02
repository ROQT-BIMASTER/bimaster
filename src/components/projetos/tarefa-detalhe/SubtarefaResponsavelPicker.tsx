import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useProjetoMembros } from "@/hooks/useProjetoMembros";
import { useProjetoTarefas } from "@/hooks/useProjetoTarefas";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Plus, X, Check, UserPlus, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";


interface Props {
  subtarefaId: string;
  projetoId: string;
  responsavelId: string | null;
  responsavelNome?: string | null;
  responsavelAvatar?: string | null;
  /** "inline" (default): chip pequeno com nome. "avatar": apenas avatar circular estilo Asana. */
  variant?: "inline" | "avatar";
}

/**
 * Picker compacto de responsável para subtarefas. Aplica a mesma técnica de
 * `TarefaResponsavelSeguidoresEditor` (Command + mutation otimista direta de
 * `useProjetoTarefas` + toast + busy disable) para que a UI reflita o
 * responsável imediatamente, sem aguardar resposta do banco e sem o flicker
 * que existia ao usar apenas o onUpdate genérico.
 */
export function SubtarefaResponsavelPicker({
  subtarefaId,
  projetoId,
  responsavelId,
  responsavelNome,
  responsavelAvatar,
  variant = "inline",
}: Props) {
  const { user } = useAuth();
  const { membros } = useProjetoMembros(projetoId);
  const { updateTarefa } = useProjetoTarefas(projetoId);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const trocar = (novoUserId: string | null) => {
    // Fecha o popover ANTES de disparar a mutation. O onMutate de updateTarefa
    // já aplica patch otimista no cache (responsavel_id + objeto responsavel
    // enriquecido a partir de teamMembers / projeto_membros), então a UI
    // reflete a troca imediatamente.
    setOpen(false);
    updateTarefa.mutate(
      { id: subtarefaId, responsavel_id: novoUserId } as any,
      {
        onSuccess: () => {
          toast.success(novoUserId ? "Responsável atualizado" : "Responsável removido");
          // Garante que a view da tarefa-pai (que carrega `subtarefas` derivadas)
          // recarregue, já que o patch otimista de `updateTarefa` foca em
          // tarefas top-level. Sem isso, a UI da subtarefa pode demorar a
          // refletir o novo responsável quando o componente pai não recompõe.
          queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
        },
        onError: (err: any) => {
          toast.error(err?.message || "Não foi possível atualizar o responsável");
        },
      },
    );
  };

  // cmdk's `onSelect` ocasionalmente não dispara quando o Popover está aninhado
  // dentro de um Dialog (Radix focus trap / pointer-events). Disparamos também
  // no `onMouseDown` como redundância — `preventDefault` evita que o blur do
  // CommandInput cancele o handler antes do click chegar.
  const handlePick = (e: React.MouseEvent, novoUserId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    trocar(novoUserId);
  };

  const triggerEl =
    variant === "avatar" ? (
      <button
        type="button"
        title={responsavelNome || "Atribuir responsável"}
        aria-label={responsavelNome ? `Responsável: ${responsavelNome}` : "Atribuir responsável"}
        className={cn(
          "flex items-center justify-center rounded-full transition-colors",
          "h-7 w-7 shrink-0",
          responsavelId
            ? "hover:ring-2 hover:ring-primary/30"
            : "border border-dashed border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/40",
        )}
      >
        {responsavelId ? (
          <Avatar className="h-7 w-7">
            <AvatarImage src={responsavelAvatar || undefined} />
            <AvatarFallback className="text-[10px] bg-primary/15 text-primary font-medium">
              {responsavelNome?.substring(0, 2).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        ) : (
          <User className="h-3.5 w-3.5" />
        )}
      </button>
    ) : (
      <button
        type="button"
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground rounded px-1 py-0.5 hover:bg-muted/40 transition-colors"
      >
        {responsavelId ? (
          <>
            <Avatar className="h-4 w-4">
              <AvatarImage src={responsavelAvatar || undefined} />
              <AvatarFallback className="text-[7px] bg-primary/20 text-primary">
                {responsavelNome?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate max-w-[60px]">{responsavelNome?.split(" ")[0]}</span>
          </>
        ) : (
          <>
            <Plus className="h-3 w-3" />
            <span>Responsável</span>
          </>
        )}
      </button>
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{triggerEl}</PopoverTrigger>
      <PopoverContent
        className="w-60 p-0 z-[80]"
        align="start"
        sideOffset={6}
        collisionPadding={8}
        style={{ pointerEvents: "auto" }}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.stopPropagation()}
        onInteractOutside={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder="Buscar membro..." />
          <CommandList>
            <CommandEmpty>Nenhum membro encontrado.</CommandEmpty>
            {user && (
              <CommandGroup>
                <CommandItem
                  value="__me__"
                  onSelect={() => trocar(user.id)}
                  onMouseDown={(e) => handlePick(e, user.id)}
                  className="text-xs cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5 mr-2" />
                  Atribuir a mim
                </CommandItem>
              </CommandGroup>
            )}
            {responsavelId && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__remove__"
                    onSelect={() => trocar(null)}
                    onMouseDown={(e) => handlePick(e, null)}
                    className="text-xs text-destructive cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5 mr-2" />
                    Remover responsável
                  </CommandItem>
                </CommandGroup>
              </>
            )}
            {membros.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Membros do projeto">
                  {membros.map((m) => (
                    <CommandItem
                      key={m.id}
                      value={m.profile?.nome || m.user_id}
                      onSelect={() => trocar(m.user_id)}
                      onMouseDown={(e) => handlePick(e, m.user_id)}
                      className={cn(
                        "text-xs cursor-pointer",
                        responsavelId === m.user_id && "bg-accent/60",
                      )}
                    >
                      <Avatar className="h-5 w-5 mr-2">
                        <AvatarImage src={m.profile?.avatar_url || undefined} />
                        <AvatarFallback className="text-[9px]">
                          {m.profile?.nome?.substring(0, 2).toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate">{m.profile?.nome || "Membro"}</span>
                      {responsavelId === m.user_id && (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
