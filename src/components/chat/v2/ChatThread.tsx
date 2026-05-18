import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Phone, Video, Search, MoreVertical, Users, Info, BellOff, Bell, Star, Archive, ArrowDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMensagens, useConversaInfo } from "@/hooks/chat/useMensagens";
import { useChatRoomPresence, useGlobalPresence } from "@/hooks/chat/useChatPresence";
import { useChatActions } from "@/hooks/chat/useChatActions";
import { useConversas } from "@/hooks/chat/useConversas";
import { usePresenceStatusMap, PRESENCE_STATUS_INFO } from "@/hooks/chat/usePresenceStatus";
import { useAuth } from "@/contexts/AuthContext";
import { initials, formatDataChip, nomeConversa } from "./utils";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import type { ChatMensagem } from "@/hooks/chat/types";

interface Props {
  conversaId: string;
  onShowInfo: () => void;
  onBack?: () => void;
}

export function ChatThread({ conversaId, onShowInfo }: Props) {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const { data: conversas = [] } = useConversas();
  const conv = conversas.find((c) => c.id === conversaId);
  const { mensagens, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useMensagens(conversaId);
  const { online } = useGlobalPresence();
  const { digitandoUserIds, enviarDigitando } = useChatRoomPresence(conversaId);
  const actions = useChatActions();
  const { data: info } = useConversaInfo(conversaId);
  const [responderA, setResponderA] = useState<ChatMensagem | null>(null);
  const [busca, setBusca] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showJump, setShowJump] = useState(false);

  const isGrupo = conv?.tipo === "group" || conv?.tipo === "grupo";
  const nome = conv ? nomeConversa(conv) : "";
  const isOnline = !isGrupo && conv?.outroUsuario ? online.has(conv.outroUsuario.id) : false;
  const participantesCount = conv?.participantes_count ?? (info?.participantes?.length ?? 0);

  // Status declarado do outro user (DM) — usa pra label e cor da bolinha
  const otherIds = useMemo(
    () => (!isGrupo && conv?.outroUsuario?.id ? [conv.outroUsuario.id] : []),
    [isGrupo, conv?.outroUsuario?.id],
  );
  const { data: statusMap } = usePresenceStatusMap(otherIds);
  const statusDeclarado = !isGrupo && conv?.outroUsuario?.id
    ? statusMap?.get(conv.outroUsuario.id)?.status
    : undefined;

  const visiveis = useMemo(() => {
    if (!busca) return mensagens;
    const q = busca.toLowerCase();
    return mensagens.filter((m) => m.conteudo.toLowerCase().includes(q));
  }, [mensagens, busca]);

  // marcar como lido ao abrir / nova msg
  useEffect(() => {
    if (!conversaId || !uid) return;
    const last = mensagens[mensagens.length - 1];
    if (!last) return;
    actions.marcarLido.mutate({ conversaId, ateMensagemId: last.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversaId, mensagens.length]);

  // auto-scroll quando chega mensagem nova
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens.length]);

  // detectar scroll fora do bottom
  useEffect(() => {
    const el = scrollRef.current?.querySelector<HTMLDivElement>("[data-radix-scroll-area-viewport]");
    if (!el) return;
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowJump(dist > 200);
      if (el.scrollTop < 80 && hasNextPage && !isFetchingNextPage) fetchNextPage();
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // agrupa por dia
  const grupos = useMemo(() => {
    const out: Array<{ data: string; itens: ChatMensagem[] }> = [];
    visiveis.forEach((m) => {
      const chip = formatDataChip(m.created_at);
      const last = out[out.length - 1];
      if (last && last.data === chip) last.itens.push(m);
      else out.push({ data: chip, itens: [m] });
    });
    return out;
  }, [visiveis]);

  if (!conv) return <div className="flex-1 flex items-center justify-center text-muted-foreground">Conversa não encontrada</div>;

  return (
    // flex-1 garante que o ChatThread ocupa todo o espaço disponível dentro
    // do `<div className="flex-1 min-w-0 flex">` do ChatLayout. Sem isso, o
    // ChatThread fica com largura intrínseca (~310px) e deixa o resto vazio.
    <div className="flex-1 flex flex-col h-full bg-[hsl(var(--muted))]/30 min-w-0">
      <header className="px-4 py-2.5 border-b border-border bg-card flex items-center gap-3 shrink-0">
        <button onClick={onShowInfo} className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80">
          <div className="relative">
            <Avatar className="h-9 w-9">
              <AvatarImage src={conv.avatar_url ?? conv.outroUsuario?.avatar_url ?? undefined} />
              <AvatarFallback className={cn(isGrupo ? "bg-primary/15 text-primary" : "")}>
                {isGrupo ? <Users className="h-4 w-4" /> : initials(conv.outroUsuario?.nome, conv.outroUsuario?.email)}
              </AvatarFallback>
            </Avatar>
            {!isGrupo && (() => {
              if (statusDeclarado && statusDeclarado in PRESENCE_STATUS_INFO) {
                const info = PRESENCE_STATUS_INFO[statusDeclarado as keyof typeof PRESENCE_STATUS_INFO];
                return <span className={cn("absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-card", info.color)} title={info.label} />;
              }
              if (isOnline) return <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" title="Online" />;
              return null;
            })()}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate">{nome}</h3>
            <p className="text-[11px] text-muted-foreground truncate">
              {digitandoUserIds.length > 0
                ? <span className="text-primary">digitando...</span>
                : isGrupo
                  ? `${participantesCount} participantes`
                  : statusDeclarado && statusDeclarado in PRESENCE_STATUS_INFO
                    ? <span className={PRESENCE_STATUS_INFO[statusDeclarado as keyof typeof PRESENCE_STATUS_INFO].textColor}>
                        {PRESENCE_STATUS_INFO[statusDeclarado as keyof typeof PRESENCE_STATUS_INFO].label}
                      </span>
                    : isOnline ? "Online" : "Offline"}
            </p>
          </div>
        </button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => setBusca(busca === null ? "" : null)}
        >
          <Search className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onShowInfo}><Info className="h-4 w-4 mr-2" /> Informações</DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.setParticipanteFlag.mutate({ conversaId, patch: { favorita: !conv.favorita } })}>
              <Star className="h-4 w-4 mr-2" /> {conv.favorita ? "Remover favorito" : "Marcar favorito"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              const ate = conv.silenciada_ate ? null : new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
              actions.setParticipanteFlag.mutate({ conversaId, patch: { silenciada_ate: ate } });
            }}>
              {conv.silenciada_ate ? <Bell className="h-4 w-4 mr-2" /> : <BellOff className="h-4 w-4 mr-2" />}
              {conv.silenciada_ate ? "Reativar notif." : "Silenciar 8h"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => actions.setParticipanteFlag.mutate({ conversaId, patch: { arquivada: !conv.arquivada } })}>
              <Archive className="h-4 w-4 mr-2" /> {conv.arquivada ? "Desarquivar" : "Arquivar"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {busca !== null && (
        <div className="px-3 py-2 border-b border-border bg-card flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nesta conversa..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <Button variant="ghost" size="sm" onClick={() => setBusca(null)}>Fechar</Button>
        </div>
      )}

      <div className="flex-1 relative min-h-0">
        <ScrollArea className="h-full" ref={scrollRef as any}>
          <div className="px-4 py-4 space-y-2">
            {isFetchingNextPage && (
              <div className="text-center py-2"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
            )}
            {isLoading && <div className="text-center text-xs text-muted-foreground py-8">Carregando mensagens...</div>}
            {!isLoading && grupos.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-12">Nenhuma mensagem. Diga olá!</div>
            )}
            {grupos.map((g) => (
              <div key={g.data} className="space-y-2">
                <div className="flex justify-center my-3">
                  <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-card border border-border text-muted-foreground">{g.data}</span>
                </div>
                {g.itens.map((m) => (
                  <MessageBubble
                    key={m.id}
                    m={m}
                    uid={uid}
                    isGrupo={!!isGrupo}
                    onReply={setResponderA}
                    participantesCount={participantesCount}
                  />
                ))}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
        {showJump && (
          <Button
            size="icon"
            variant="secondary"
            className="absolute bottom-3 right-4 h-9 w-9 rounded-full shadow"
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        )}
      </div>

      <MessageInput
        conversaId={conversaId}
        responderA={responderA}
        onClearReply={() => setResponderA(null)}
        onTyping={enviarDigitando}
      />
    </div>
  );
}
