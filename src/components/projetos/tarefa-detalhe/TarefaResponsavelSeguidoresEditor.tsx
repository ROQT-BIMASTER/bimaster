import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProjetoMembros } from "@/hooks/useProjetoMembros";
import { useProjetoTarefas } from "@/hooks/useProjetoTarefas";
import { logger } from "@/lib/logger";
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
import { Button } from "@/components/ui/button";
import { Plus, UserPlus, UserMinus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Pessoa {
  user_id: string;
  nome: string;
  avatar_url: string | null;
  origem?: "junction" | "principal";
}

interface Props {
  tarefaId: string;
  projetoId: string;
  /** Lista de responsáveis (multi). Quando vazia, mostra CTA "Atribuir responsável". */
  responsaveis: Pessoa[];
  colaboradores: Pessoa[];
  onChange?: () => void;
  onSetResponsavelPrincipal?: (userId: string | null) => void;
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
  onSetResponsavelPrincipal,
}: Props) {
  const { user } = useAuth();
  const { membros } = useProjetoMembros(projetoId);
  const {
    addColaborador,
    removeColaborador,
    addResponsavel,
    removeResponsavel,
  } = useProjetoTarefas(projetoId);

  // Popover por avatar (key = user_id). String vazia = popover "+" geral.
  const [respOpenKey, setRespOpenKey] = useState<string | null>(null);
  const [segOpenKey, setSegOpenKey] = useState<string | null>(null);

  const busy =
    addResponsavel.isPending ||
    removeResponsavel.isPending ||
    addColaborador.isPending ||
    removeColaborador.isPending;

  const responsaveisIds = useMemo(
    () => new Set(responsaveis.map((r) => r.user_id)),
    [responsaveis],
  );
  const seguidoresIds = useMemo(
    () => new Set(colaboradores.map((c) => c.user_id)),
    [colaboradores],
  );

  // ─── Responsáveis ──────────────────────────────────────────────────────────
  const adicionarResponsavel = (userId: string) => {
    if (!user || responsaveisIds.has(userId)) return;
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
      },
    );
  };

  const removerResponsavel = (userId: string) => {
    if (!user) return;
    const alvo = responsaveis.find((r) => r.user_id === userId);
    if (alvo?.origem === "principal" && onSetResponsavelPrincipal) {
      onSetResponsavelPrincipal(null);
      logAtividade({
        tarefa_id: tarefaId,
        projeto_id: projetoId,
        user_id: user.id,
        tipo: "responsavel_removido",
        campo: "responsaveis",
        valor_anterior: alvo.nome || userId,
        descricao: `Removeu ${alvo.nome || "membro"} dos responsáveis`,
      });
      toast.success("Responsável removido");
      onChange?.();
      return;
    }
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
      },
    );
  };

  /** Substitui um responsável por outro em um clique (add novo + remove antigo). */
  const trocarResponsavel = (oldUserId: string, newUserId: string) => {
    if (oldUserId === newUserId) return;
    const alvo = responsaveis.find((r) => r.user_id === oldUserId);
    if (alvo?.origem === "principal" && onSetResponsavelPrincipal) {
      onSetResponsavelPrincipal(newUserId);
      toast.success("Responsável atualizado");
      onChange?.();
      return;
    }
    adicionarResponsavel(newUserId);
    removerResponsavel(oldUserId);
  };

  // ─── Seguidores ────────────────────────────────────────────────────────────
  const adicionarSeguidor = (userId: string) => {
    if (!user || seguidoresIds.has(userId)) return;
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
      },
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
      },
    );
  };

  const trocarSeguidor = (oldUserId: string, newUserId: string) => {
    if (oldUserId === newUserId) return;
    adicionarSeguidor(newUserId);
    removerSeguidor(oldUserId);
  };

  // ─── Picker compartilhado ──────────────────────────────────────────────────
  /**
   * Renderiza o conteúdo do Command usado tanto pelo botão "+" quanto pelo
   * popover de cada avatar. Quando `swapFrom` é informado, selecionar outro
   * membro substitui esse responsável/seguidor em um clique.
   */
  const renderPicker = ({
    kind,
    swapFrom,
    onPicked,
  }: {
    kind: "responsavel" | "seguidor";
    swapFrom?: string;
    onPicked: () => void;
  }) => {
    const selectedIds = kind === "responsavel" ? responsaveisIds : seguidoresIds;
    const meSelecionado = user ? selectedIds.has(user.id) : true;

    const handleToggle = (userId: string) => {
      if (swapFrom) {
        if (userId === swapFrom) {
          if (kind === "responsavel") removerResponsavel(userId);
          else removerSeguidor(userId);
        } else if (selectedIds.has(userId)) {
          // Já é responsável/seguidor — remove o "antigo" para concluir a troca
          if (kind === "responsavel") removerResponsavel(swapFrom);
          else removerSeguidor(swapFrom);
        } else {
          if (kind === "responsavel") trocarResponsavel(swapFrom, userId);
          else trocarSeguidor(swapFrom, userId);
        }
      } else {
        if (selectedIds.has(userId)) {
          if (kind === "responsavel") removerResponsavel(userId);
          else removerSeguidor(userId);
        } else {
          if (kind === "responsavel") adicionarResponsavel(userId);
          else adicionarSeguidor(userId);
        }
      }
      onPicked();
    };

    return (
      <Command>
        <CommandInput placeholder="Buscar membro..." />
        <CommandList>
          <CommandEmpty>Nenhum membro encontrado.</CommandEmpty>

          {user && !meSelecionado && (
            <CommandGroup>
              <CommandItem
                value="__me__"
                onSelect={() => handleToggle(user.id)}
                className="text-xs"
              >
                <UserPlus className="h-3.5 w-3.5 mr-2" />
                Atribuir a mim
              </CommandItem>
            </CommandGroup>
          )}

          {swapFrom && (
            <>
              {user && !meSelecionado && <CommandSeparator />}
              <CommandGroup>
                <CommandItem
                  value="__remove__"
                  onSelect={() => {
                    if (kind === "responsavel") removerResponsavel(swapFrom);
                    else removerSeguidor(swapFrom);
                    onPicked();
                  }}
                  className="text-xs text-destructive"
                >
                  <X className="h-3.5 w-3.5 mr-2" />
                  {kind === "responsavel" ? "Remover este responsável" : "Remover este seguidor"}
                </CommandItem>
              </CommandGroup>
            </>
          )}

          {membros.length === 0 ? (
            <div className="px-3 py-4 text-center space-y-1.5">
              <p className="text-[11px] text-muted-foreground">
                Nenhum membro cadastrado neste projeto.
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                Adicione membros na aba{" "}
                <span className="font-semibold text-foreground/80">Equipe</span> para poder
                atribuí-los.
              </p>
            </div>
          ) : (
            <>
              <CommandSeparator />
              <CommandGroup heading="Membros do projeto">
                {membros.map((m) => {
                  const isSelected = selectedIds.has(m.user_id);
                  return (
                    <CommandItem
                      key={m.user_id}
                      value={m.profile?.nome || m.user_id}
                      onSelect={() => handleToggle(m.user_id)}
                      className={cn("text-xs", isSelected && "bg-accent/60")}
                    >
                      <Avatar className="h-5 w-5 mr-2">
                        <AvatarImage src={m.profile?.avatar_url || undefined} />
                        <AvatarFallback className="text-[9px]">
                          {m.profile?.nome?.substring(0, 2).toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate">{m.profile?.nome || "Membro"}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    );
  };

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
              <Popover
                key={r.user_id}
                open={respOpenKey === r.user_id}
                onOpenChange={(o) => setRespOpenKey(o ? r.user_id : null)}
              >
                <PopoverTrigger asChild>
                  <button
                    disabled={busy}
                    type="button"
                    className="hover:scale-110 transition-transform"
                    title={`${r.nome} — clique para trocar ou remover`}
                  >
                    <Avatar className="h-6 w-6 border-2 border-background">
                      <AvatarImage src={r.avatar_url || undefined} />
                      <AvatarFallback className="text-[9px] bg-primary/20 text-primary font-semibold">
                        {r.nome?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start" style={{ pointerEvents: "auto" }} onOpenAutoFocus={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.stopPropagation()} onInteractOutside={(e) => e.stopPropagation()}>
                  {renderPicker({
                    kind: "responsavel",
                    swapFrom: r.user_id,
                    onPicked: () => setRespOpenKey(null),
                  })}
                </PopoverContent>
              </Popover>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <UserPlus className="h-3 w-3" /> Nenhum responsável
          </span>
        )}

        <Popover
          open={respOpenKey === "__add__"}
          onOpenChange={(o) => setRespOpenKey(o ? "__add__" : null)}
        >
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              className={cn(
                "h-6 w-6 p-0 rounded-full border border-dashed border-border hover:border-primary",
                responsaveis.length > 0 && "ml-1",
              )}
              title="Adicionar responsável"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start" style={{ pointerEvents: "auto" }} onOpenAutoFocus={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.stopPropagation()} onInteractOutside={(e) => e.stopPropagation()}>
            {renderPicker({
              kind: "responsavel",
              onPicked: () => setRespOpenKey(null),
            })}
          </PopoverContent>
        </Popover>
      </div>

      {/* Seguidores editável */}
      <span className="text-muted-foreground">Seguidores</span>
      <div className="flex items-center gap-1 flex-wrap">
        {colaboradores.length > 0 ? (
          <div className="flex -space-x-1">
            {colaboradores.map((c) => (
              <Popover
                key={c.user_id}
                open={segOpenKey === c.user_id}
                onOpenChange={(o) => setSegOpenKey(o ? c.user_id : null)}
              >
                <PopoverTrigger asChild>
                  <button
                    disabled={busy}
                    type="button"
                    className="hover:scale-110 transition-transform"
                    title={`${c.nome} — clique para trocar ou remover`}
                  >
                    <Avatar className="h-6 w-6 border-2 border-background">
                      <AvatarImage src={c.avatar_url || undefined} />
                      <AvatarFallback className="text-[8px] bg-muted">
                        {c.nome?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start" style={{ pointerEvents: "auto" }} onOpenAutoFocus={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.stopPropagation()} onInteractOutside={(e) => e.stopPropagation()}>
                  {renderPicker({
                    kind: "seguidor",
                    swapFrom: c.user_id,
                    onPicked: () => setSegOpenKey(null),
                  })}
                </PopoverContent>
              </Popover>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <UserMinus className="h-3 w-3" /> Nenhum seguidor
          </span>
        )}

        <Popover
          open={segOpenKey === "__add__"}
          onOpenChange={(o) => setSegOpenKey(o ? "__add__" : null)}
        >
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              className={cn(
                "h-6 w-6 p-0 rounded-full border border-dashed border-border hover:border-primary",
                colaboradores.length > 0 && "ml-1",
              )}
              title="Adicionar seguidor"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start" style={{ pointerEvents: "auto" }} onOpenAutoFocus={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.stopPropagation()} onInteractOutside={(e) => e.stopPropagation()}>
            {renderPicker({
              kind: "seguidor",
              onPicked: () => setSegOpenKey(null),
            })}
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
