import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Plus, UserPlus, UserMinus, X, FolderOpen, Search } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem,
  CommandList, CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useAuth } from "@/contexts/AuthContext";
import { useProjetoMembros } from "@/hooks/useProjetoMembros";
import { useVincularProjetosOpcoes } from "@/hooks/useVincularProjetosOpcoes";
import { useMoverTarefaParaProjeto } from "@/hooks/useMoverTarefaParaProjeto";

/* ============================================================
   Responsável inline (principal) — atualiza projeto_tarefas.responsavel_id
   ============================================================ */

interface RespProps {
  tarefaId: string;
  projetoId: string;
  responsavelId: string | null;
  responsavelNome: string | null;
  responsavelAvatarUrl: string | null;
}

export function MinhasTarefaResponsavelInline({
  tarefaId, projetoId, responsavelId, responsavelNome, responsavelAvatarUrl,
}: RespProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { membros } = useProjetoMembros(open ? projetoId : undefined);

  const setResp = async (newId: string | null) => {
    const { error } = await supabase
      .from("projeto_tarefas")
      .update({ responsavel_id: newId })
      .eq("id", tarefaId);
    if (error) {
      toast.error("Não foi possível atualizar o responsável.");
      return;
    }
    toast.success(newId ? "Responsável atualizado." : "Responsável removido.");
    qc.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="rounded-full hover:ring-2 hover:ring-primary/30 transition-shadow"
          title={responsavelNome || "Atribuir responsável"}
        >
          {responsavelId ? (
            <Avatar className="h-6 w-6">
              <AvatarImage src={responsavelAvatarUrl || undefined} />
              <AvatarFallback className="text-[9px] bg-primary/20 text-primary font-semibold">
                {responsavelNome?.substring(0, 2).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
          ) : (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary/60 hover:text-primary">
              <UserPlus className="h-3 w-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandInput placeholder="Buscar membro..." />
          <CommandList>
            <CommandEmpty>Nenhum membro encontrado.</CommandEmpty>

            {user && responsavelId !== user.id && (
              <CommandGroup>
                <CommandItem
                  value="__me__"
                  onSelect={() => setResp(user.id)}
                  className="text-xs"
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
                    value="__clear__"
                    onSelect={() => setResp(null)}
                    className="text-xs text-destructive"
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
                  {membros.map((m) => {
                    const sel = m.user_id === responsavelId;
                    return (
                      <CommandItem
                        key={m.user_id}
                        value={m.profile?.nome || m.user_id}
                        onSelect={() => setResp(m.user_id)}
                        className={cn("text-xs", sel && "bg-accent/60")}
                      >
                        <Avatar className="h-5 w-5 mr-2">
                          <AvatarImage src={m.profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-[9px]">
                            {m.profile?.nome?.substring(0, 2).toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate">{m.profile?.nome || "Membro"}</span>
                        {sel && <Check className="h-3.5 w-3.5 text-primary" />}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ============================================================
   Colaboradores inline — fetch lazy + toggle direto
   ============================================================ */

interface ColabProps {
  tarefaId: string;
  projetoId: string;
}

interface Colab {
  user_id: string;
  nome: string | null;
  avatar_url: string | null;
}

export function MinhasTarefaColaboradoresInline({ tarefaId, projetoId }: ColabProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { membros } = useProjetoMembros(open ? projetoId : undefined);

  const { data: colabs = [] } = useQuery({
    queryKey: ["minhas-tarefa-colaboradores", tarefaId],
    queryFn: async (): Promise<Colab[]> => {
      const { data, error } = await supabase
        .from("projeto_tarefa_colaboradores")
        .select("user_id")
        .eq("tarefa_id", tarefaId);
      if (error) throw error;
      const ids = (data || []).map((c: any) => c.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .in("id", ids);
      return ids.map((id) => {
        const p = profs?.find((x: any) => x.id === id);
        return { user_id: id, nome: p?.nome || null, avatar_url: p?.avatar_url || null };
      });
    },
    enabled: open,
    staleTime: 30_000,
  });

  const colabIds = new Set(colabs.map((c) => c.user_id));

  const toggle = async (userId: string) => {
    if (colabIds.has(userId)) {
      const { error } = await supabase
        .from("projeto_tarefa_colaboradores")
        .delete()
        .eq("tarefa_id", tarefaId)
        .eq("user_id", userId);
      if (error) {
        toast.error("Não foi possível remover o colaborador.");
        return;
      }
      toast.success("Colaborador removido.");
    } else {
      const { error } = await supabase
        .from("projeto_tarefa_colaboradores")
        .upsert(
          { tarefa_id: tarefaId, user_id: userId },
          { onConflict: "tarefa_id,user_id", ignoreDuplicates: true },
        );
      if (error) {
        toast.error("Não foi possível adicionar o colaborador.");
        return;
      }
      toast.success("Colaborador adicionado.");
    }
    qc.invalidateQueries({ queryKey: ["minhas-tarefa-colaboradores", tarefaId] });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-6 items-center gap-1 rounded-full px-1.5 hover:bg-accent/50 transition-colors"
          title="Colaboradores"
        >
          {colabs.length > 0 ? (
            <div className="flex -space-x-1">
              {colabs.slice(0, 3).map((c) => (
                <Avatar key={c.user_id} className="h-5 w-5 border border-background">
                  <AvatarImage src={c.avatar_url || undefined} />
                  <AvatarFallback className="text-[8px]">
                    {c.nome?.substring(0, 2).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
              ))}
              {colabs.length > 3 && (
                <span className="ml-1 text-[10px] text-muted-foreground">+{colabs.length - 3}</span>
              )}
            </div>
          ) : (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary/60 hover:text-primary">
              <Plus className="h-3 w-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandInput placeholder="Buscar membro..." />
          <CommandList>
            <CommandEmpty>Nenhum membro encontrado.</CommandEmpty>

            {user && !colabIds.has(user.id) && (
              <CommandGroup>
                <CommandItem value="__me__" onSelect={() => toggle(user.id)} className="text-xs">
                  <UserPlus className="h-3.5 w-3.5 mr-2" />
                  Seguir esta tarefa
                </CommandItem>
              </CommandGroup>
            )}

            {membros.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Membros do projeto">
                  {membros.map((m) => {
                    const sel = colabIds.has(m.user_id);
                    return (
                      <CommandItem
                        key={m.user_id}
                        value={m.profile?.nome || m.user_id}
                        onSelect={() => toggle(m.user_id)}
                        className={cn("text-xs", sel && "bg-accent/60")}
                      >
                        <Avatar className="h-5 w-5 mr-2">
                          <AvatarImage src={m.profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-[9px]">
                            {m.profile?.nome?.substring(0, 2).toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate">{m.profile?.nome || "Membro"}</span>
                        {sel ? (
                          <UserMinus className="h-3.5 w-3.5 text-destructive" />
                        ) : (
                          <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ============================================================
   Projeto inline picker — usa RPCs
   ============================================================ */

interface ProjProps {
  tarefaId: string;
  currentProjetoId: string;
  currentProjetoNome: string;
  currentProjetoCor: string;
  /** Quando true, exibe "Sem projeto" em cinza no chip. */
  isPessoal: boolean;
}

export function ProjetoInlinePicker({
  tarefaId, currentProjetoId, currentProjetoNome, currentProjetoCor, isPessoal,
}: ProjProps) {
  const [open, setOpen] = useState(false);
  const { data: projetos = [], isLoading } = useVincularProjetosOpcoes(open);
  const mover = useMoverTarefaParaProjeto();

  const onPick = (projetoDestinoId: string | null) => {
    if (mover.isPending) return;
    mover.mutate(
      { tarefaId, projetoDestinoId },
      { onSettled: () => setOpen(false) },
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center gap-1.5 max-w-full px-1.5 py-0.5 rounded hover:bg-accent/50 transition-colors text-left",
            isPessoal && "text-muted-foreground/80",
          )}
          title={isPessoal ? "Tarefa pessoal — clique para vincular a um projeto" : `Projeto: ${currentProjetoNome}`}
        >
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: isPessoal ? "hsl(var(--muted-foreground) / 0.5)" : currentProjetoCor }}
          />
          <span className="text-xs truncate">
            {isPessoal ? "Tarefas pessoais" : currentProjetoNome}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandInput placeholder="Buscar projeto..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Carregando..." : "Nenhum projeto disponível."}
            </CommandEmpty>

            {!isPessoal && (
              <CommandGroup>
                <CommandItem
                  value="__remover__"
                  onSelect={() => onPick(null)}
                  className="text-xs text-muted-foreground"
                  disabled={mover.isPending}
                >
                  <X className="h-3.5 w-3.5 mr-2" />
                  Remover do projeto (Pessoal)
                </CommandItem>
              </CommandGroup>
            )}

            {projetos.length > 0 && (
              <>
                {!isPessoal && <CommandSeparator />}
                <CommandGroup heading="Meus projetos">
                  {projetos.map((p) => {
                    const sel = p.id === currentProjetoId;
                    return (
                      <CommandItem
                        key={p.id}
                        value={p.nome}
                        onSelect={() => !sel && onPick(p.id)}
                        className={cn("text-xs", sel && "bg-accent/60")}
                        disabled={mover.isPending}
                      >
                        <FolderOpen className="h-3.5 w-3.5 mr-2" style={{ color: p.cor }} />
                        <span className="flex-1 truncate">{p.nome}</span>
                        {sel && <Check className="h-3.5 w-3.5 text-primary" />}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
