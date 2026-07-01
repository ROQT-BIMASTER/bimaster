import { memo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
} from "@/components/ui/command";
import { Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Colab {
  user_id: string;
  nome: string;
  avatar_url: string | null;
}

interface Props {
  subtarefaId: string;
  projetoId: string;
  colaboradores: Colab[];
  /**
   * Indica que a lista de membros do projeto (fonte de hidratação de
   * nome/avatar) ainda está resolvendo. Quando `true` e houver colaboradores,
   * renderiza uma pilha de placeholders pulsantes para evitar flash de
   * iniciais "MB" e sinalizar que o dado real está a caminho.
   */
  isResolving?: boolean;
}


/**
 * Picker compacto de seguidores (colaboradores) para linhas de subtarefa no
 * painel de detalhe / Modo Foco. Mostra até 3 avatares empilhados + contador,
 * ou um botão tracejado "+" quando vazio. Reutiliza as mutations otimistas
 * `addColaborador` / `removeColaborador` já expostas por `useProjetoTarefas`.
 */
function SubtarefaSeguidoresPickerImpl({ subtarefaId, projetoId, colaboradores, isResolving = false }: Props) {
  const { membros } = useProjetoMembros(projetoId);
  const { addColaborador, removeColaborador } = useProjetoTarefas(projetoId);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const isFollower = (userId: string) => colaboradores.some((c) => c.user_id === userId);

  const invalidateAll = () => {
    // Mesmos alvos do picker de responsável: view V2 do projeto + as duas
    // bridges (Central V2 e MinhasTarefas V1) + lista pessoal. Garante que
    // pilhas de avatares atualizem para todos os usuários e em todos os
    // pontos onde a subtarefa aparece.
    queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
    queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-subtarefas-bridge"] });
    queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-subtarefas-bridge-mt"] });
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
  };

  const toggle = (userId: string, nome: string) => {
    if (isFollower(userId)) {
      removeColaborador.mutate(
        { tarefaId: subtarefaId, userId },
        {
          onSuccess: () => {
            toast.success(`${nome} removido dos seguidores`);
            invalidateAll();
          },
          onError: (err: any) => toast.error(err?.message || "Erro ao remover seguidor"),
        },
      );
    } else {
      addColaborador.mutate(
        { tarefaId: subtarefaId, userId },
        {
          onSuccess: () => {
            toast.success(`${nome} adicionado como seguidor`);
            invalidateAll();
          },
          onError: (err: any) => toast.error(err?.message || "Erro ao adicionar seguidor"),
        },
      );
    }
  };

  const handlePick = (e: React.MouseEvent, userId: string, nome: string) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(userId, nome);
  };

  const visible = colaboradores.slice(0, 3);
  const extra = colaboradores.length - visible.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={
            colaboradores.length > 0
              ? `Seguidores: ${colaboradores.map((c) => c.nome).join(", ")}`
              : "Adicionar seguidores"
          }
          className={cn(
            "flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-muted/40 transition-colors",
            colaboradores.length === 0 &&
              "text-muted-foreground hover:text-foreground border border-dashed border-border/60",
          )}
        >
          {colaboradores.length === 0 ? (
            isResolving ? (
              // Placeholder pulsante quando ainda não sabemos se há seguidores
              // (membros do projeto carregando). Evita "salto" visual entre
              // o botão "+ Equipe" e a pilha real.
              <div className="flex items-center" aria-hidden="true">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-4 w-4 rounded-full bg-muted/60 animate-pulse ring-1 ring-background",
                      i > 0 && "-ml-1.5",
                    )}
                  />
                ))}
              </div>
            ) : (
              <>
                <Plus className="h-3 w-3" />
                <span className="text-[10px]">Equipe</span>
              </>
            )
          ) : isResolving ? (
            // Temos user_ids mas nome/avatar ainda não resolveram: pilha
            // de skeletons no mesmo tamanho final para evitar layout shift.
            <div className="flex items-center" aria-label="Carregando seguidores">
              {visible.map((c, idx) => (
                <div
                  key={c.user_id}
                  className={cn(
                    "h-4 w-4 rounded-full bg-muted/60 animate-pulse ring-1 ring-background",
                    idx > 0 && "-ml-1.5",
                  )}
                />
              ))}
              {extra > 0 && (
                <span className="text-[9px] text-muted-foreground ml-0.5">+{extra}</span>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center">
                {visible.map((c, idx) => (
                  <SmartAvatar
                    key={c.user_id}
                    src={c.avatar_url}
                    nome={c.nome}
                    title={c.nome}
                    className={cn("h-4 w-4 ring-1 ring-background", idx > 0 && "-ml-1.5")}
                    fallbackClassName="text-[7px]"
                  />
                ))}
              </div>
              {extra > 0 && (
                <span className="text-[9px] text-muted-foreground ml-0.5">+{extra}</span>
              )}
            </>
          )}

        </button>
      </PopoverTrigger>
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
            {membros.length > 0 && (
              <CommandGroup heading="Membros do projeto">
                {membros.map((m) => {
                  const nome = m.profile?.nome || "Membro";
                  const active = isFollower(m.user_id);
                  return (
                    <CommandItem
                      key={m.id}
                      value={nome}
                      onSelect={() => toggle(m.user_id, nome)}
                      onMouseDown={(e) => handlePick(e, m.user_id, nome)}
                      className={cn("text-xs cursor-pointer", active && "bg-accent/60")}
                    >
                      <SmartAvatar
                        src={m.profile?.avatar_url}
                        nome={nome}
                        className="h-5 w-5 mr-2"
                        fallbackClassName="text-[9px]"
                      />
                      <span className="flex-1 truncate">{nome}</span>
                      {active && <Check className="h-3.5 w-3.5 text-primary" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export const SubtarefaSeguidoresPicker = memo(
  SubtarefaSeguidoresPickerImpl,
  (prev, next) =>
    prev.subtarefaId === next.subtarefaId &&
    prev.projetoId === next.projetoId &&
    prev.colaboradores.length === next.colaboradores.length &&
    prev.colaboradores.map((c) => c.user_id).join(",") ===
      next.colaboradores.map((c) => c.user_id).join(","),
);
