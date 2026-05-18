import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MoreVertical, Reply, Smile, Pin, Pencil, Trash2, Star, Copy, CornerUpRight, Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMensagem } from "@/hooks/chat/types";
import { useChatActions } from "@/hooks/chat/useChatActions";
import { initials, formatHora } from "./utils";
import { AnexoView } from "./AnexoView";
import { toast } from "sonner";

const REACTION_SET = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥"];

interface Props {
  m: ChatMensagem;
  uid: string;
  isGrupo: boolean;
  onReply: (m: ChatMensagem) => void;
  onForward?: (m: ChatMensagem) => void;
  participantesCount: number;
}

export function MessageBubble({ m, uid, isGrupo, onReply, participantesCount }: Props) {
  const mine = m.remetente_id === uid;
  const actions = useChatActions();
  const [editing, setEditing] = useState(false);
  const [editTxt, setEditTxt] = useState(m.conteudo);

  const reacoesAgrupadas = useMemo(() => {
    const map = new Map<string, { count: number; mine: boolean }>();
    (m.reacoes ?? []).forEach((r) => {
      const cur = map.get(r.emoji) ?? { count: 0, mine: false };
      cur.count++;
      if (r.user_id === uid) cur.mine = true;
      map.set(r.emoji, cur);
    });
    return Array.from(map.entries());
  }, [m.reacoes, uid]);

  const totalLeituras = (m.leituras ?? []).filter((l) => l.user_id !== uid).length;
  const lidaPorTodos = isGrupo
    ? totalLeituras >= Math.max(0, participantesCount - 1)
    : totalLeituras >= 1;

  if (m.excluida_para_todos) {
    return (
      <div className={cn("flex w-full", mine ? "justify-end" : "justify-start")}>
        <div className="max-w-[70%] px-3 py-2 rounded-2xl bg-muted/60 text-xs italic text-muted-foreground">
          Mensagem apagada
        </div>
      </div>
    );
  }

  const copiar = () => { navigator.clipboard.writeText(m.conteudo); toast.success("Copiado"); };

  const salvarEdicao = async () => {
    const novo = editTxt.trim();
    if (!novo || novo === m.conteudo) { setEditing(false); return; }
    await actions.editMessage.mutateAsync({ id: m.id, conversaId: m.conversa_id, conteudo: novo });
    setEditing(false);
  };

  return (
    <div className={cn("group flex w-full gap-2", mine ? "justify-end" : "justify-start")}>
      {!mine && (
        <Avatar className="h-7 w-7 mt-auto shrink-0">
          <AvatarImage src={m.remetente?.avatar_url ?? undefined} />
          <AvatarFallback className="text-[10px]">{initials(m.remetente?.nome, m.remetente?.email)}</AvatarFallback>
        </Avatar>
      )}
      <div className={cn("max-w-[72%] md:max-w-[640px] flex flex-col", mine ? "items-end" : "items-start")}>
        {isGrupo && !mine && (
          <span className="text-[11px] font-medium text-primary px-3 mb-0.5">{m.remetente?.nome ?? m.remetente?.email ?? "Usuário"}</span>
        )}
        <div className={cn(
          "relative px-3 py-2 rounded-2xl shadow-sm",
          mine
            ? "bg-emerald-600 text-white rounded-br-sm"
            : "bg-card border border-border rounded-bl-sm",
        )}>
          {m.responde_a && (
            <div className={cn(
              "border-l-2 pl-2 mb-1.5 text-xs opacity-80 max-w-full truncate",
              mine ? "border-white/60" : "border-primary",
            )}>
              {m.responde_a.conteudo || (m.responde_a.tipo === "imagem" ? "📷 Foto" : "Anexo")}
            </div>
          )}

          {(m.anexos ?? []).length > 0 && (
            <div className="space-y-1.5 mb-1">
              {(m.anexos ?? []).map((a) => <AnexoView key={a.id} anexo={a} mine={mine} />)}
            </div>
          )}

          {editing ? (
            <div className="space-y-1.5 min-w-[220px]">
              <Textarea value={editTxt} onChange={(e) => setEditTxt(e.target.value)} rows={2} className="bg-background text-foreground" />
              <div className="flex gap-1.5 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
                <Button size="sm" onClick={salvarEdicao}>Salvar</Button>
              </div>
            </div>
          ) : m.conteudo && (
            <p className="text-sm whitespace-pre-wrap break-words leading-snug">{m.conteudo}</p>
          )}

          <div className={cn("flex items-center gap-1 justify-end mt-0.5 text-[10px]", mine ? "text-white/70" : "text-muted-foreground")}>
            {m.editada_em && <span>editada</span>}
            {m.fixada_em && <Pin className="h-2.5 w-2.5" />}
            <span>{formatHora(m.created_at)}</span>
            {mine && (lidaPorTodos
              ? <CheckCheck className="h-3 w-3 text-sky-200" />
              : <Check className="h-3 w-3" />)}
          </div>

          <div className={cn(
            "absolute -top-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-background border border-border rounded-full px-1 py-0.5 shadow-sm",
            mine ? "right-2" : "left-2",
          )}>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" className="h-6 w-6"><Smile className="h-3.5 w-3.5" /></Button>
              </PopoverTrigger>
              <PopoverContent side="top" className="w-auto p-1 flex gap-0.5">
                {REACTION_SET.map((e) => (
                  <button
                    key={e}
                    onClick={() => actions.toggleReaction.mutate({ id: m.id, conversaId: m.conversa_id, emoji: e })}
                    className="h-8 w-8 rounded hover:bg-muted text-lg leading-none"
                  >{e}</button>
                ))}
              </PopoverContent>
            </Popover>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onReply(m)}>
              <Reply className="h-3.5 w-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-6 w-6"><MoreVertical className="h-3.5 w-3.5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={mine ? "end" : "start"}>
                <DropdownMenuItem onClick={() => onReply(m)}><Reply className="h-4 w-4 mr-2" /> Responder</DropdownMenuItem>
                <DropdownMenuItem onClick={copiar}><Copy className="h-4 w-4 mr-2" /> Copiar</DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.toggleFavorita.mutate({ id: m.id, conversaId: m.conversa_id, favorita: !!m.favorita })}>
                  <Star className="h-4 w-4 mr-2" /> {m.favorita ? "Remover favorito" : "Favoritar"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.togglePin.mutate({ id: m.id, conversaId: m.conversa_id, fixar: !m.fixada_em })}>
                  <Pin className="h-4 w-4 mr-2" /> {m.fixada_em ? "Desafixar" : "Fixar"}
                </DropdownMenuItem>
                {mine && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { setEditTxt(m.conteudo); setEditing(true); }}>
                      <Pencil className="h-4 w-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => actions.deleteMessage.mutate({ id: m.id, conversaId: m.conversa_id, paraTodos: true })}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Apagar para todos
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem onClick={() => actions.deleteMessage.mutate({ id: m.id, conversaId: m.conversa_id, paraTodos: false })}>
                  <Trash2 className="h-4 w-4 mr-2" /> Apagar para mim
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {reacoesAgrupadas.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 px-1">
            {reacoesAgrupadas.map(([emoji, info]) => (
              <button
                key={emoji}
                onClick={() => actions.toggleReaction.mutate({ id: m.id, conversaId: m.conversa_id, emoji })}
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full border bg-card hover:bg-muted",
                  info.mine ? "border-primary text-primary" : "border-border",
                )}
              >
                {emoji} {info.count}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
