import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProjetoMembros } from "@/hooks/useProjetoMembros";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Plus, X, Check, UserPlus, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Colaborador {
  user_id: string;
  nome: string;
  avatar_url: string | null;
}

interface Props {
  tarefaId: string;
  projetoId: string;
  responsavelId: string | null;
  responsavelNome?: string | null;
  responsavelAvatar?: string | null;
  colaboradores: Colaborador[];
  onChange?: () => void;
}

async function logAtividade(params: {
  tarefa_id: string;
  projeto_id: string;
  user_id: string;
  tipo: string;
  campo: string;
  valor_anterior?: string | null;
  valor_novo?: string | null;
  descricao: string;
}) {
  await supabase.from("projeto_tarefa_atividades").insert({
    tarefa_id: params.tarefa_id,
    projeto_id: params.projeto_id,
    user_id: params.user_id,
    tipo: params.tipo,
    campo: params.campo,
    valor_anterior: params.valor_anterior ?? null,
    valor_novo: params.valor_novo ?? null,
    descricao: params.descricao,
  });
}

export function TarefaResponsavelSeguidoresEditor({
  tarefaId,
  projetoId,
  responsavelId,
  responsavelNome,
  responsavelAvatar,
  colaboradores,
  onChange,
}: Props) {
  const { user } = useAuth();
  const { membros } = useProjetoMembros(projetoId);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [respOpen, setRespOpen] = useState(false);
  const [segOpen, setSegOpen] = useState(false);

  const seguidoresIds = useMemo(() => new Set(colaboradores.map((c) => c.user_id)), [colaboradores]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["projeto-tarefas"] });
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    queryClient.invalidateQueries({ queryKey: ["tarefa-timeline-activities"] });
    onChange?.();
  };

  const trocarResponsavel = async (novoUserId: string | null) => {
    if (!user) return;
    setBusy(true);
    try {
      const novoMembro = membros.find((m) => m.user_id === novoUserId);
      const { error } = await supabase
        .from("projeto_tarefas")
        .update({ responsavel_id: novoUserId })
        .eq("id", tarefaId);
      if (error) throw error;

      await logAtividade({
        tarefa_id: tarefaId,
        projeto_id: projetoId,
        user_id: user.id,
        tipo: "responsavel_change",
        campo: "responsavel_id",
        valor_anterior: responsavelNome || null,
        valor_novo: novoMembro?.profile?.nome || null,
        descricao: novoUserId
          ? `Atribuiu a ${novoMembro?.profile?.nome || "membro"} como responsável`
          : `Removeu o responsável da tarefa`,
      });

      toast.success("Responsável atualizado");
      invalidate();
      setRespOpen(false);
    } catch (err: any) {
      toast.error("Erro ao trocar responsável: " + (err?.message || ""));
    } finally {
      setBusy(false);
    }
  };

  const adicionarSeguidor = async (userId: string) => {
    if (!user) return;
    if (seguidoresIds.has(userId)) return;
    setBusy(true);
    try {
      const membro = membros.find((m) => m.user_id === userId);
      const { error } = await supabase
        .from("projeto_tarefa_colaboradores")
        .insert({ tarefa_id: tarefaId, user_id: userId });
      if (error) throw error;

      await logAtividade({
        tarefa_id: tarefaId,
        projeto_id: projetoId,
        user_id: user.id,
        tipo: "seguidor_adicionado",
        campo: "seguidores",
        valor_novo: membro?.profile?.nome || userId,
        descricao: `Adicionou ${membro?.profile?.nome || "membro"} como seguidor`,
      });

      toast.success("Seguidor adicionado");
      invalidate();
    } catch (err: any) {
      toast.error("Erro ao adicionar seguidor: " + (err?.message || ""));
    } finally {
      setBusy(false);
    }
  };

  const removerSeguidor = async (userId: string) => {
    if (!user) return;
    setBusy(true);
    try {
      const colab = colaboradores.find((c) => c.user_id === userId);
      const { error } = await supabase
        .from("projeto_tarefa_colaboradores")
        .delete()
        .eq("tarefa_id", tarefaId)
        .eq("user_id", userId);
      if (error) throw error;

      await logAtividade({
        tarefa_id: tarefaId,
        projeto_id: projetoId,
        user_id: user.id,
        tipo: "seguidor_removido",
        campo: "seguidores",
        valor_anterior: colab?.nome || userId,
        descricao: `Removeu ${colab?.nome || "membro"} dos seguidores`,
      });

      toast.success("Seguidor removido");
      invalidate();
    } catch (err: any) {
      toast.error("Erro ao remover seguidor: " + (err?.message || ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Responsável editável */}
      <span className="text-muted-foreground">Responsável</span>
      <Popover open={respOpen} onOpenChange={setRespOpen}>
        <PopoverTrigger asChild>
          <button
            disabled={busy}
            className="flex items-center gap-2 text-left hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors group"
          >
            {responsavelId ? (
              <>
                <Avatar className="h-6 w-6">
                  <AvatarImage src={responsavelAvatar || undefined} />
                  <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                    {responsavelNome?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs">{responsavelNome}</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground group-hover:text-foreground inline-flex items-center gap-1">
                <UserPlus className="h-3 w-3" /> Atribuir responsável
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar membro..." />
            <CommandList>
              <CommandEmpty>Nenhum membro encontrado.</CommandEmpty>
              {responsavelId && (
                <CommandGroup>
                  <CommandItem
                    onSelect={() => trocarResponsavel(null)}
                    className="text-destructive"
                  >
                    <X className="h-3.5 w-3.5 mr-2" />
                    Remover responsável
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup heading="Membros do projeto">
                {membros.map((m) => (
                  <CommandItem
                    key={m.user_id}
                    value={m.profile?.nome || m.user_id}
                    onSelect={() => trocarResponsavel(m.user_id)}
                  >
                    <Avatar className="h-5 w-5 mr-2">
                      <AvatarImage src={m.profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-[9px]">
                        {m.profile?.nome?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-xs">{m.profile?.nome || "Membro"}</span>
                    {responsavelId === m.user_id && <Check className="h-3.5 w-3.5 text-primary" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

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
                <CommandGroup heading="Adicionar seguidor">
                  {membros
                    .filter((m) => !seguidoresIds.has(m.user_id))
                    .map((m) => (
                      <CommandItem
                        key={m.user_id}
                        value={m.profile?.nome || m.user_id}
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
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
