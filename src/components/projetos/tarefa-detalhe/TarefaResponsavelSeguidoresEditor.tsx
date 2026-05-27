import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProjetoMembros } from "@/hooks/useProjetoMembros";
import { useProjetoTarefas } from "@/hooks/useProjetoTarefas";
import { logger } from "@/lib/logger";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Plus, UserPlus, UserMinus, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Pessoa {
  user_id: string;
  nome: string;
  avatar_url: string | null;
}

interface Props {
  tarefaId: string;
  projetoId: string;
  /** Lista de responsáveis (multi). Quando vazia, mostra CTA "Atribuir responsável". */
  responsaveis: Pessoa[];
  colaboradores: Pessoa[];
  onChange?: () => void;
}

// Fire-and-forget — auditoria não deve bloquear o feedback de UI.
function logAtividade(params: {
  tarefa_id: string;
  projeto_id: string;
  user_id: string;
  tipo: string;
  campo: string;
  valor_anterior?: string | null;
  valor_novo?: string | null;
  descricao: string;
}) {
  void supabase
    .from("projeto_tarefa_atividades")
    .insert({
      tarefa_id: params.tarefa_id,
      projeto_id: params.projeto_id,
      user_id: params.user_id,
      tipo: params.tipo,
      campo: params.campo,
      valor_anterior: params.valor_anterior ?? null,
      valor_novo: params.valor_novo ?? null,
      descricao: params.descricao,
    })
    .then(({ error }) => {
      if (error) {
        logger.error("[TarefaResponsavelSeguidoresEditor] logAtividade falhou", {
          tarefa_id: params.tarefa_id,
          tipo: params.tipo,
          error: error.message,
        });
      }
    });
}

export function TarefaResponsavelSeguidoresEditor({
  tarefaId,
  projetoId,
  responsaveis,
  colaboradores,
  onChange,
}: Props) {
  const { user } = useAuth();
  const { membros } = useProjetoMembros(projetoId);
  const {
    addColaborador,
    removeColaborador,
    addResponsavel,
    removeResponsavel,
  } = useProjetoTarefas(projetoId);
  const [respOpen, setRespOpen] = useState(false);
  const [segOpen, setSegOpen] = useState(false);

  const busy =
    addResponsavel.isPending ||
    removeResponsavel.isPending ||
    addColaborador.isPending ||
    removeColaborador.isPending;

  const responsaveisIds = useMemo(() => new Set(responsaveis.map(r => r.user_id)), [responsaveis]);
  const seguidoresIds = useMemo(() => new Set(colaboradores.map((c) => c.user_id)), [colaboradores]);

  const adicionarResponsavel = (userId: string) => {
    if (!user) return;
    if (responsaveisIds.has(userId)) return;
    const membro = membros.find((m) => m.user_id === userId);
    addResponsavel.mutate(
      { tarefaId, userId },
      {
        onSuccess: () => {
          logAtividade({
            tarefa_id: tarefaId,
            projeto_id: projetoId,
            user_id: user.id,
            tipo: "responsavel_adicionado",
            campo: "responsaveis",
            valor_novo: membro?.profile?.nome || userId,
            descricao: `Adicionou ${membro?.profile?.nome || "membro"} como responsável`,
          });
          toast.success("Responsável adicionado");
          onChange?.();
        },
      }
    );
  };

  const removerResponsavel = (userId: string) => {
    if (!user) return;
    const alvo = responsaveis.find(r => r.user_id === userId);
    removeResponsavel.mutate(
      { tarefaId, userId },
      {
        onSuccess: () => {
          logAtividade({
            tarefa_id: tarefaId,
            projeto_id: projetoId,
            user_id: user.id,
            tipo: "responsavel_removido",
            campo: "responsaveis",
            valor_anterior: alvo?.nome || userId,
            descricao: `Removeu ${alvo?.nome || "membro"} dos responsáveis`,
          });
          toast.success("Responsável removido");
          onChange?.();
        },
      }
    );
  };

  const adicionarSeguidor = (userId: string) => {
    if (!user) return;
    if (seguidoresIds.has(userId)) return;
    const membro = membros.find((m) => m.user_id === userId);
    addColaborador.mutate(
      { tarefaId, userId },
      {
        onSuccess: () => {
          logAtividade({
            tarefa_id: tarefaId,
            projeto_id: projetoId,
            user_id: user.id,
            tipo: "seguidor_adicionado",
            campo: "seguidores",
            valor_novo: membro?.profile?.nome || userId,
            descricao: `Adicionou ${membro?.profile?.nome || "membro"} como seguidor`,
          });
          toast.success("Seguidor adicionado");
          onChange?.();
        },
      }
    );
  };

  const removerSeguidor = (userId: string) => {
    if (!user) return;
    const colab = colaboradores.find((c) => c.user_id === userId);
    removeColaborador.mutate(
      { tarefaId, userId },
      {
        onSuccess: () => {
          logAtividade({
            tarefa_id: tarefaId,
            projeto_id: projetoId,
            user_id: user.id,
            tipo: "seguidor_removido",
            campo: "seguidores",
            valor_anterior: colab?.nome || userId,
            descricao: `Removeu ${colab?.nome || "membro"} dos seguidores`,
          });
          toast.success("Seguidor removido");
          onChange?.();
        },
      }
    );
  };

  const membrosDisponiveis = membros.filter((m) => !responsaveisIds.has(m.user_id));

  return (
    <>
      {/* Responsáveis (multi) */}
      <span className="text-muted-foreground">
        {responsaveis.length > 1 ? "Responsáveis" : "Responsável"}
      </span>
      <div className="flex items-center gap-1 flex-wrap">
        {responsaveis.length > 0 ? (
          <div className="flex -space-x-1">
            {responsaveis.map((r) => (
              <Popover key={r.user_id}>
                <PopoverTrigger asChild>
                  <button
                    disabled={busy}
                    className="hover:scale-110 transition-transform"
                    title={`${r.nome} — clique para remover`}
                  >
                    <Avatar className="h-6 w-6 border-2 border-background">
                      <AvatarImage src={r.avatar_url || undefined} />
                      <AvatarFallback className="text-[9px] bg-primary/20 text-primary font-semibold">
                        {r.nome?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  <div className="text-xs font-medium mb-2">{r.nome}</div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full justify-start text-xs text-destructive hover:text-destructive"
                    onClick={() => removerResponsavel(r.user_id)}
                    disabled={busy}
                  >
                    <UserMinus className="h-3 w-3 mr-2" />
                    Remover responsável
                  </Button>
                </PopoverContent>
              </Popover>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <UserPlus className="h-3 w-3" /> Nenhum responsável
          </span>
        )}

        <Popover open={respOpen} onOpenChange={setRespOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              className={cn(
                "h-6 w-6 p-0 rounded-full border border-dashed border-border hover:border-primary",
                responsaveis.length > 0 && "ml-1"
              )}
              title="Adicionar responsável"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar membro..." />
              <CommandList>
                <CommandEmpty>Nenhum membro encontrado.</CommandEmpty>
                {membrosDisponiveis.length === 0 ? (
                  <div className="px-3 py-4 text-center space-y-1.5">
                    <p className="text-[11px] text-muted-foreground">
                      {membros.length === 0
                        ? "Nenhum membro cadastrado neste projeto."
                        : "Todos os membros já são responsáveis."}
                    </p>
                    {membros.length === 0 && (
                      <p className="text-[10px] text-muted-foreground/70">
                        Adicione membros na aba <span className="font-semibold text-foreground/80">Equipe</span> para poder atribuí-los.
                      </p>
                    )}
                  </div>
                ) : (
                  <CommandGroup heading="Adicionar responsável">
                    {membrosDisponiveis.map((m) => (
                      <CommandItem
                        key={m.user_id}
                        value={m.profile?.nome || "Membro"}
                        onSelect={() => {
                          adicionarResponsavel(m.user_id);
                          setRespOpen(false);
                        }}
                      >
                        <Avatar className="h-5 w-5 mr-2">
                          <AvatarImage src={m.profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-[9px]">
                            {m.profile?.nome?.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-xs">{m.profile?.nome || "Membro"}</span>
                        {responsaveisIds.has(m.user_id) && <Check className="h-3.5 w-3.5 text-primary" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Seguidores editável */}
      <span className="text-muted-foreground">Seguidores</span>
      <div className="flex items-center gap-1 flex-wrap">
        {colaboradores.length > 0 ? (
          <div className="flex -space-x-1">
            {colaboradores.map((c) => (
              <Popover key={c.user_id}>
                <PopoverTrigger asChild>
                  <button
                    disabled={busy}
                    className="hover:scale-110 transition-transform"
                    title={`${c.nome} — clique para remover`}
                  >
                    <Avatar className="h-6 w-6 border-2 border-background">
                      <AvatarImage src={c.avatar_url || undefined} />
                      <AvatarFallback className="text-[8px] bg-muted">
                        {c.nome?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  <div className="text-xs font-medium mb-2">{c.nome}</div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full justify-start text-xs text-destructive hover:text-destructive"
                    onClick={() => removerSeguidor(c.user_id)}
                  >
                    <UserMinus className="h-3 w-3 mr-2" />
                    Remover seguidor
                  </Button>
                </PopoverContent>
              </Popover>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Nenhum seguidor</span>
        )}

        <Popover open={segOpen} onOpenChange={setSegOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              className={cn(
                "h-6 w-6 p-0 rounded-full border border-dashed border-border hover:border-primary",
                colaboradores.length > 0 && "ml-1"
              )}
              title="Adicionar seguidor"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar membro..." />
              <CommandList>
                <CommandEmpty>Nenhum membro encontrado.</CommandEmpty>
                {membros.length === 0 ? (
                  <div className="px-3 py-4 text-center space-y-1.5">
                    <p className="text-[11px] text-muted-foreground">
                      Nenhum membro cadastrado neste projeto.
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">
                      Adicione membros na aba <span className="font-semibold text-foreground/80">Equipe</span> para poder atribuí-los.
                    </p>
                  </div>
                ) : (
                  <CommandGroup heading="Adicionar seguidor">
                    {membros
                      .filter((m) => !seguidoresIds.has(m.user_id))
                      .map((m) => (
                        <CommandItem
                          key={m.user_id}
                          value={m.profile?.nome || "Membro"}
                          onSelect={() => {
                            adicionarSeguidor(m.user_id);
                            setSegOpen(false);
                          }}
                        >
                          <Avatar className="h-5 w-5 mr-2">
                            <AvatarImage src={m.profile?.avatar_url || undefined} />
                            <AvatarFallback className="text-[9px]">
                              {m.profile?.nome?.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs">{m.profile?.nome || "Membro"}</span>
                        </CommandItem>
                      ))}
                    {membros.filter((m) => !seguidoresIds.has(m.user_id)).length === 0 && (
                      <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                        Todos os membros já são seguidores.
                      </div>
                    )}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
