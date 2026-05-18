import { useState, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, MessageSquarePlus, Users, MoreVertical, Star, Archive, BellOff, Plus, Pin, VolumeX, Package, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConversas, filtrarConversas, type ChatFiltro } from "@/hooks/chat/useConversas";
import { useGlobalPresence } from "@/hooks/chat/useChatPresence";
import { useChatActions } from "@/hooks/chat/useChatActions";
import { useChinaSubmissoesChat, filtrarSubmissoesChat, type ChinaSubmissaoChatItem } from "@/hooks/chat/useChinaSubmissoesChat";
import { initials, formatRelativo, nomeConversa } from "./utils";
import type { ChatConversa } from "@/hooks/chat/types";
import { NovaConversaDialog } from "../NovaConversaDialog";
import { GroupCreateDialog } from "./GroupCreateDialog";
import type { ChatModo } from "./ChatLayout";

interface Props {
  conversaSelecionada: string | null;
  onSelectConversa: (id: string) => void;
  className?: string;
  modo: ChatModo;
  onModoChange: (modo: ChatModo) => void;
  /** Se false, o toggle Pessoas/Submissões fica oculto (usuário sem contexto China). */
  podeAlternarModo: boolean;
}

export function ChatSidebar({
  conversaSelecionada,
  onSelectConversa,
  className,
  modo,
  onModoChange,
  podeAlternarModo,
}: Props) {
  return (
    <aside className={cn("flex flex-col h-full bg-card border-r border-border", className)}>
      {/* Toggle Pessoas / Submissões — só aparece se usuário tem contexto China.
          Visualmente ocupa o topo da sidebar pra ser o primeiro elemento que
          o usuário interage. Comportamento: muda a fonte de dados (useConversas
          vs useChinaSubmissoesChat) e o painel central (ChatThread vs ChinaChatPanel). */}
      {podeAlternarModo && (
        <div className="px-3 pt-3 pb-2 border-b border-border">
          <Tabs value={modo} onValueChange={(v) => onModoChange(v as ChatModo)}>
            <TabsList className="grid grid-cols-2 h-8 w-full">
              <TabsTrigger value="pessoas" className="text-xs gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" /> Pessoas
              </TabsTrigger>
              <TabsTrigger value="submissoes" className="text-xs gap-1.5">
                <Package className="h-3.5 w-3.5" /> Submissões
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {modo === "submissoes" ? (
        <SidebarSubmissoesContent
          conversaSelecionada={conversaSelecionada}
          onSelectConversa={onSelectConversa}
        />
      ) : (
        <SidebarPessoasContent
          conversaSelecionada={conversaSelecionada}
          onSelectConversa={onSelectConversa}
        />
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// MODO "PESSOAS" — comportamento original do ChatSidebar
// ---------------------------------------------------------------------------

function SidebarPessoasContent({
  conversaSelecionada,
  onSelectConversa,
}: {
  conversaSelecionada: string | null;
  onSelectConversa: (id: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<ChatFiltro>("todas");
  const [novaOpen, setNovaOpen] = useState(false);
  const [grupoOpen, setGrupoOpen] = useState(false);
  const { data: conversas = [], isLoading } = useConversas();
  const { online } = useGlobalPresence();
  const actions = useChatActions();

  const filtradas = useMemo(() => filtrarConversas(conversas, filtro, busca), [conversas, filtro, busca]);
  const totalNaoLidas = conversas.reduce((s, c) => s + (c.naoLidas || 0), 0);

  return (
    <>
      <header className="px-3 py-3 border-b border-border flex items-center gap-2">
        <h3 className="font-semibold text-sm flex-1">
          Conversas {totalNaoLidas > 0 && <Badge variant="secondary" className="ml-1">{totalNaoLidas}</Badge>}
        </h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8">
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* onSelect (não onClick) + setTimeout(0) é o padrão Radix para
                abrir Dialog a partir de DropdownMenu. onClick direto pode
                bloquear o Dialog de montar por causa do foco que o
                Dropdown libera no mesmo tick. */}
            <DropdownMenuItem onSelect={() => setTimeout(() => setNovaOpen(true), 0)}>
              <MessageSquarePlus className="h-4 w-4 mr-2" /> Nova conversa
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTimeout(() => setGrupoOpen(true), 0)}>
              <Users className="h-4 w-4 mr-2" /> Novo grupo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar conversa ou mensagem..."
            className="pl-8 h-9"
          />
        </div>
      </div>

      <Tabs value={filtro} onValueChange={(v) => setFiltro(v as ChatFiltro)} className="px-2 pt-2">
        <TabsList className="grid grid-cols-5 h-8 w-full">
          <TabsTrigger value="todas" className="text-xs px-1">Todas</TabsTrigger>
          <TabsTrigger value="nao_lidas" className="text-xs px-1">Não lidas</TabsTrigger>
          <TabsTrigger value="grupos" className="text-xs px-1">Grupos</TabsTrigger>
          <TabsTrigger value="favoritas" className="text-xs px-1">★</TabsTrigger>
          <TabsTrigger value="arquivadas" className="text-xs px-1">Arq.</TabsTrigger>
        </TabsList>
      </Tabs>

      <ScrollArea className="flex-1">
        {isLoading && <p className="text-xs text-muted-foreground p-4">Carregando...</p>}
        {!isLoading && filtradas.length === 0 && (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Nenhuma conversa nesta visão.
          </div>
        )}
        <ul className="py-1">
          {filtradas.map((c) => (
            <ConversaItem
              key={c.id}
              c={c}
              ativa={c.id === conversaSelecionada}
              online={c.outroUsuario ? online.has(c.outroUsuario.id) : false}
              onSelect={() => onSelectConversa(c.id)}
              onToggleFav={() =>
                actions.setParticipanteFlag.mutate({ conversaId: c.id, patch: { favorita: !c.favorita } })
              }
              onToggleArq={() =>
                actions.setParticipanteFlag.mutate({ conversaId: c.id, patch: { arquivada: !c.arquivada } })
              }
              onMute={() => {
                const ate = c.silenciada_ate ? null : new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
                actions.setParticipanteFlag.mutate({ conversaId: c.id, patch: { silenciada_ate: ate } });
              }}
            />
          ))}
        </ul>
      </ScrollArea>

      <NovaConversaDialog open={novaOpen} onOpenChange={setNovaOpen} onSuccess={(id) => { setNovaOpen(false); onSelectConversa(id); }} />
      <GroupCreateDialog open={grupoOpen} onOpenChange={setGrupoOpen} onCreated={(id) => { setGrupoOpen(false); onSelectConversa(id); }} />
    </>
  );
}

function ConversaItem({
  c, ativa, online, onSelect, onToggleFav, onToggleArq, onMute,
}: {
  c: ChatConversa;
  ativa: boolean;
  online: boolean;
  onSelect: () => void;
  onToggleFav: () => void;
  onToggleArq: () => void;
  onMute: () => void;
}) {
  const nome = nomeConversa(c);
  const isGrupo = c.tipo === "group" || c.tipo === "grupo";
  const last = c.ultimaMensagem;
  const previewTxt = last
    ? last.tipo === "imagem" ? "📷 Foto"
      : last.tipo === "arquivo" ? "📎 Arquivo"
      : last.tipo === "audio" ? "🎤 Áudio"
      : last.tipo === "video" ? "🎬 Vídeo"
      : last.tipo === "sistema" ? "ℹ " + last.conteudo
      : last.conteudo
    : "Nenhuma mensagem ainda";

  return (
    <li>
      <button
        onClick={onSelect}
        className={cn(
          "w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-muted/50 transition-colors group relative",
          ativa && "bg-muted",
        )}
      >
        <div className="relative shrink-0">
          <Avatar className="h-11 w-11">
            <AvatarImage src={c.avatar_url ?? c.outroUsuario?.avatar_url ?? undefined} />
            <AvatarFallback className={cn(isGrupo ? "bg-primary/15 text-primary" : "bg-muted")}>
              {isGrupo ? <Users className="h-5 w-5" /> : initials(c.outroUsuario?.nome, c.outroUsuario?.email)}
            </AvatarFallback>
          </Avatar>
          {!isGrupo && online && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("truncate text-sm", c.naoLidas > 0 && "font-semibold")}>{nome}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">{formatRelativo(last?.created_at ?? c.ultima_mensagem_em)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <span className={cn("truncate text-xs text-muted-foreground", c.naoLidas > 0 && "text-foreground")}>{previewTxt}</span>
            <div className="flex items-center gap-1 shrink-0">
              {c.silenciada_ate && <VolumeX className="h-3 w-3 text-muted-foreground" />}
              {c.favorita && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
              {c.naoLidas > 0 && (
                <Badge className="h-4 min-w-4 px-1 text-[10px] rounded-full bg-emerald-600 hover:bg-emerald-600">{c.naoLidas}</Badge>
              )}
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={onToggleFav}>
              <Star className="h-4 w-4 mr-2" /> {c.favorita ? "Remover favorito" : "Marcar favorito"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMute}>
              <BellOff className="h-4 w-4 mr-2" /> {c.silenciada_ate ? "Reativar notif." : "Silenciar 8h"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onToggleArq}>
              <Archive className="h-4 w-4 mr-2" /> {c.arquivada ? "Desarquivar" : "Arquivar"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// MODO "SUBMISSÕES" — lista submissões China com chat aberto
// ---------------------------------------------------------------------------

function SidebarSubmissoesContent({
  conversaSelecionada,
  onSelectConversa,
}: {
  conversaSelecionada: string | null;
  onSelectConversa: (id: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const { data: submissoes = [], isLoading } = useChinaSubmissoesChat();
  const filtradas = useMemo(() => filtrarSubmissoesChat(submissoes, busca), [submissoes, busca]);
  const totalNaoLidas = submissoes.reduce((s, c) => s + (c.naoLidas || 0), 0);

  return (
    <>
      <header className="px-3 py-3 border-b border-border flex items-center gap-2">
        <h3 className="font-semibold text-sm flex-1">
          Submissões {totalNaoLidas > 0 && <Badge variant="secondary" className="ml-1">{totalNaoLidas}</Badge>}
        </h3>
        {/* Não há botão "+" porque novas submissões são criadas em outra
            rota (China → Nova Submissão). O chat aparece automaticamente
            assim que a submissão tem chat_status != null. */}
      </header>

      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por código, produto ou texto..."
            className="pl-8 h-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading && <p className="text-xs text-muted-foreground p-4">Carregando...</p>}
        {!isLoading && filtradas.length === 0 && (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Nenhuma submissão acessível.
          </div>
        )}
        <ul className="py-1">
          {filtradas.map((s) => (
            <SubmissaoItem
              key={s.id}
              s={s}
              ativa={s.id === conversaSelecionada}
              onSelect={() => onSelectConversa(s.id)}
            />
          ))}
        </ul>
      </ScrollArea>
    </>
  );
}

function SubmissaoItem({
  s, ativa, onSelect,
}: {
  s: ChinaSubmissaoChatItem;
  ativa: boolean;
  onSelect: () => void;
}) {
  const last = s.ultimaMensagem;
  const previewTxt = last
    ? last.tipo === "ia" ? "🤖 " + (last.conteudo || "Sugestão da IA")
      : last.conteudo
    : "Nenhuma mensagem ainda";
  const titulo = s.produto_codigo
    ? `${s.produto_codigo}${s.produto_nome ? ` — ${s.produto_nome}` : ""}`
    : s.produto_nome ?? "Submissão";
  const isFinalizado = s.chat_status === "finalizado";

  return (
    <li>
      <button
        onClick={onSelect}
        className={cn(
          "w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-muted/50 transition-colors relative",
          ativa && "bg-muted",
        )}
      >
        <div className="relative shrink-0">
          <Avatar className="h-11 w-11">
            <AvatarFallback className="bg-orange-500/15 text-orange-700 dark:text-orange-300">
              <Package className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          {isFinalizado && (
            <span
              className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-muted-foreground/50 ring-2 ring-card"
              title="Chat finalizado"
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("truncate text-sm", s.naoLidas > 0 && "font-semibold")}>{titulo}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {formatRelativo(last?.created_at ?? s.updated_at ?? s.created_at)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <span className={cn("truncate text-xs text-muted-foreground", s.naoLidas > 0 && "text-foreground")}>
              {previewTxt}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {s.naoLidas > 0 && (
                <Badge className="h-4 min-w-4 px-1 text-[10px] rounded-full bg-emerald-600 hover:bg-emerald-600">{s.naoLidas}</Badge>
              )}
            </div>
          </div>
          {s.numero_ordem && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">OC {s.numero_ordem}</p>
          )}
        </div>
      </button>
    </li>
  );
}
