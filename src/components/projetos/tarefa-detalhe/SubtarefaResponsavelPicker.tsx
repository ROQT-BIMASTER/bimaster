import { memo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useProjetoMembros } from "@/hooks/useProjetoMembros";
import { useProjetoTarefas } from "@/hooks/useProjetoTarefas";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SmartAvatar } from "@/components/ui/SmartAvatar";
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
  /**
   * Identificador secundário (email, cargo, user_id curto) exibido no tooltip
   * do avatar como `Nome (identifier)`. Ajuda a desambiguar homônimos e a
   * apontar o responsável real quando a foto falha ao carregar.
   */
  responsavelEmail?: string | null;
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
function SubtarefaResponsavelPickerImpl({
  subtarefaId,
  projetoId,
  responsavelId,
  responsavelNome,
  responsavelAvatar,
  responsavelEmail,
  variant = "inline",
}: Props) {
  const { user } = useAuth();
  const { membros } = useProjetoMembros(projetoId);
  const { updateTarefa } = useProjetoTarefas(projetoId, { mutationsOnly: true });
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
          // Invalida caches usados por: (a) view detalhada V2 do projeto,
          // (b) bridge da Central de Trabalho V2 (`MinhasTarefasContent`),
          // (c) bridge da tela V1 (`MinhasTarefasSimples`). Sem (b) e (c)
          // a subtarefa continuava mostrando o responsável antigo até
          // fechar/reabrir o drawer nesses contextos.
          queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
          queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-subtarefas-bridge"] });
          queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-subtarefas-bridge-mt"] });
          queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
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
          <SmartAvatar
            src={responsavelAvatar}
            nome={responsavelNome}
            identifier={responsavelEmail}
            fallbackNome="Membro"
            className="h-7 w-7"
            fallbackClassName="text-[10px]"
          />
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
            <SmartAvatar
              src={responsavelAvatar}
              nome={responsavelNome}
              identifier={responsavelEmail}
              fallbackNome="Membro"
              className="h-4 w-4"
              fallbackClassName="text-[7px]"
            />
            <span className="truncate max-w-[110px] text-foreground/80">{responsavelNome?.split(" ")[0] || "Membro"}</span>
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
                      <SmartAvatar
                        src={m.profile?.avatar_url}
                        nome={m.profile?.nome}
                        identifier={m.profile?.email}
                        fallbackNome="Membro"
                        className="h-5 w-5 mr-2"
                        fallbackClassName="text-[9px]"
                      />
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

// Memoização evita re-render pesado quando a linha da subtarefa é
// recomposta (ex.: swap tempId→realId após criar subtarefa). O comparador
// só ignora mudanças cosméticas — qualquer mudança de responsável ou de
// identidade da subtarefa força re-render normal.
export const SubtarefaResponsavelPicker = memo(
  SubtarefaResponsavelPickerImpl,
  (prev, next) =>
    prev.subtarefaId === next.subtarefaId &&
    prev.projetoId === next.projetoId &&
    prev.responsavelId === next.responsavelId &&
    prev.responsavelNome === next.responsavelNome &&
    prev.responsavelAvatar === next.responsavelAvatar &&
    prev.responsavelEmail === next.responsavelEmail &&
    prev.variant === next.variant,
);
