import { useState, useMemo, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, MessageSquarePlus, Users, MoreVertical, Star, Archive, BellOff, Plus, Pin, VolumeX, Package, MessageCircle, SearchCheck, FileText, AtSign, Briefcase, CheckSquare, GitBranch, ArrowUpDown, CheckSquare2, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useConversas, filtrarConversas, type ChatFiltro } from "@/hooks/chat/useConversas";
import { useGlobalPresence } from "@/hooks/chat/useChatPresence";
import { useChatActions } from "@/hooks/chat/useChatActions";
import { useChinaSubmissoesChat, filtrarSubmissoesChat, type ChinaSubmissaoChatItem } from "@/hooks/chat/useChinaSubmissoesChat";
import { useBriefingsChat, filtrarBriefingsChat, type BriefingChatItem } from "@/hooks/chat/useBriefingsChat";
import { useProjetosChat, filtrarProjetosChat, type ProjetoChatItem } from "@/hooks/chat/useProjetosChat";
import { useTarefasChat, filtrarTarefasChat, useTarefaChatPreferencia, type TarefaChatItem, type TarefaChatFiltro } from "@/hooks/chat/useTarefasChat";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { initials, formatRelativo, nomeConversa } from "./utils";
import type { ChatConversa } from "@/hooks/chat/types";
import { NovaConversaDialog } from "../NovaConversaDialog";
import { GroupCreateDialog } from "./GroupCreateDialog";
import { ChatSearchDialog } from "./ChatSearchDialog";
import { PresenceStatusPicker } from "./PresenceStatusPicker";
import { usePresenceStatusMap, PRESENCE_STATUS_INFO } from "@/hooks/chat/usePresenceStatus";
import type { ChatModo } from "./ChatLayout";

interface Props {
  conversaSelecionada: string | null;
  onSelectConversa: (id: string) => void;
  className?: string;
  modo: ChatModo;
  onModoChange: (modo: ChatModo) => void;
  /** Se false, o toggle Pessoas/Submissões fica oculto (usuário sem contexto China). */
  podeAlternarModo: boolean;
  /** Se true, a aba "Briefing" aparece (usuário tem acesso a briefings). */
  podeVerBriefings?: boolean;
  /** Se true, a aba "Projetos" aparece (usuário é membro de algum projeto). */
  podeVerProjetos?: boolean;
  /** Se true, a aba "Tarefas" aparece (mesmo gate de Projetos). */
  podeVerTarefas?: boolean;
}

export function ChatSidebar({
  conversaSelecionada,
  onSelectConversa,
  className,
  modo,
  onModoChange,
  podeAlternarModo,
  podeVerBriefings = false,
  podeVerProjetos = false,
  podeVerTarefas = false,
}: Props) {
  // Quantas abas mostrar: pessoas sempre; submissões, briefings, projetos e tarefas são opt-in.
  const tabsCount =
    1 +
    (podeAlternarModo ? 1 : 0) +
    (podeVerBriefings ? 1 : 0) +
    (podeVerProjetos ? 1 : 0) +
    (podeVerTarefas ? 1 : 0);
  const showToggle = tabsCount > 1;
  return (
    <aside className={cn("flex flex-col h-full bg-card border-r border-border", className)}>
      {/* Status declarado de presença (Disponível/Ocupado/Em reunião/...).
          Persiste entre sessões e é visível pra todos no chat via bolinha
          colorida no avatar. */}
      <div className="px-3 pt-2 pb-1 border-b border-border">
        <PresenceStatusPicker compact />
      </div>

      {/* Toggle Pessoas / Submissões / Briefing — só aparece o que o usuário
          tem direito de ver. Visualmente ocupa o topo da sidebar pra ser o
          primeiro elemento que o usuário interage. */}
      {showToggle && (
        <div className="px-3 pt-3 pb-2 border-b border-border">
          <Tabs value={modo} onValueChange={(v) => onModoChange(v as ChatModo)}>
            <TabsList
              className={cn(
                "h-8 w-full grid",
                tabsCount === 5
                  ? "grid-cols-5"
                  : tabsCount === 4
                    ? "grid-cols-4"
                    : tabsCount === 3
                      ? "grid-cols-3"
                      : "grid-cols-2",
              )}
            >
              <TabsTrigger value="pessoas" className="text-[11px] gap-1">
                <MessageCircle className="h-3.5 w-3.5" /> Pessoas
              </TabsTrigger>
              {podeAlternarModo && (
                <TabsTrigger value="submissoes" className="text-[11px] gap-1">
                  <Package className="h-3.5 w-3.5" /> Submissões
                </TabsTrigger>
              )}
              {podeVerBriefings && (
                <TabsTrigger value="briefings" className="text-[11px] gap-1">
                  <FileText className="h-3.5 w-3.5" /> Briefing
                </TabsTrigger>
              )}
              {podeVerProjetos && (
                <TabsTrigger value="projetos" className="text-[11px] gap-1">
                  <Briefcase className="h-3.5 w-3.5" /> Projetos
                </TabsTrigger>
              )}
              {podeVerTarefas && (
                <TabsTrigger value="tarefas" className="text-[11px] gap-1">
                  <CheckSquare className="h-3.5 w-3.5" /> Tarefas
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>
      )}

      {modo === "submissoes" ? (
        <SidebarSubmissoesContent
          conversaSelecionada={conversaSelecionada}
          onSelectConversa={onSelectConversa}
        />
      ) : modo === "briefings" ? (
        <SidebarBriefingsContent
          conversaSelecionada={conversaSelecionada}
          onSelectConversa={onSelectConversa}
        />
      ) : modo === "projetos" ? (
        <SidebarProjetosContent
          conversaSelecionada={conversaSelecionada}
          onSelectConversa={onSelectConversa}
        />
      ) : modo === "tarefas" ? (
        <SidebarTarefasContent
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
  const [searchOpen, setSearchOpen] = useState(false);
  const { data: conversas = [], isLoading } = useConversas();
  const { online } = useGlobalPresence();
  const actions = useChatActions();

  const filtradas = useMemo(() => filtrarConversas(conversas, filtro, busca), [conversas, filtro, busca]);
  const totalNaoLidas = conversas.reduce((s, c) => s + (c.naoLidas || 0), 0);

  // Atalhos de teclado globais para produtividade:
  //  - Cmd/Ctrl+K: abre a busca global (mesma UX do command palette)
  //  - Alt+ArrowDown / Alt+ArrowUp: pula para a próxima/anterior conversa
  //    NÃO LIDA na ordem atual de filtragem. Útil pra processar inbox.
  // Ignora quando o foco está em campo de input/textarea/contenteditable.
  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    };
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        if (isTypingTarget(e.target)) return;
        const naoLidas = filtradas.filter((c) => c.naoLidas > 0);
        if (naoLidas.length === 0) return;
        e.preventDefault();
        const currentIdx = naoLidas.findIndex((c) => c.id === conversaSelecionada);
        const delta = e.key === "ArrowDown" ? 1 : -1;
        const nextIdx = currentIdx === -1
          ? (delta === 1 ? 0 : naoLidas.length - 1)
          : (currentIdx + delta + naoLidas.length) % naoLidas.length;
        onSelectConversa(naoLidas[nextIdx].id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtradas, conversaSelecionada, onSelectConversa]);

  // Status declarado de cada outro user pra mostrar bolinha colorida no
  // avatar — sobrepõe o online/offline do Realtime Presence quando setado.
  const outrosIds = useMemo(
    () => conversas.map((c) => c.outroUsuario?.id).filter((x): x is string => !!x),
    [conversas],
  );
  const { data: statusMap } = usePresenceStatusMap(outrosIds);

  return (
    <>
      <header className="px-3 py-3 border-b border-border flex items-center gap-2">
        <h3 className="font-semibold text-sm flex-1">
          Conversas {totalNaoLidas > 0 && <Badge variant="secondary" className="ml-1">{totalNaoLidas}</Badge>}
        </h3>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => setSearchOpen(true)}
          title="Buscar nas mensagens (todas as conversas)"
          aria-label="Busca global"
        >
          <SearchCheck className="h-4 w-4" />
        </Button>
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
          <TabsTrigger value="favoritas" className="text-xs px-1" title="Favoritas">★</TabsTrigger>
          <TabsTrigger value="arquivadas" className="text-xs px-1">Arq.</TabsTrigger>
        </TabsList>
        {/* Segunda linha de filtros: foco/urgência/conteúdo.
            Mantida separada para não comprimir os filtros primários. */}
        <TabsList className="grid grid-cols-3 h-8 w-full mt-1.5">
          <TabsTrigger value="mencoes" className="text-xs px-1" title="Conversas com menção a mim">@ Menções</TabsTrigger>
          <TabsTrigger value="urgentes" className="text-xs px-1" title="Conversas com mensagem urgente">Urgentes</TabsTrigger>
          <TabsTrigger value="anexos" className="text-xs px-1" title="Conversas com anexo recente">Anexos</TabsTrigger>
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
              statusDeclarado={c.outroUsuario ? statusMap?.get(c.outroUsuario.id)?.status : undefined}
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
      <ChatSearchDialog open={searchOpen} onOpenChange={setSearchOpen} onSelectConversa={onSelectConversa} />
    </>
  );
}

function ConversaItem({
  c, ativa, online, statusDeclarado, onSelect, onToggleFav, onToggleArq, onMute,
}: {
  c: ChatConversa;
  ativa: boolean;
  online: boolean;
  /** Status declarado do outro usuário (Disponível/Ocupado/Em reunião/...). */
  statusDeclarado?: string;
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
          {!isGrupo && (() => {
            // Status declarado tem prioridade sobre online/offline real-time:
            // se user setou "Ausente", não queremos mostrar bolinha verde só
            // porque a tab dele está aberta.
            if (statusDeclarado && statusDeclarado in PRESENCE_STATUS_INFO) {
              const info = PRESENCE_STATUS_INFO[statusDeclarado as keyof typeof PRESENCE_STATUS_INFO];
              return (
                <span
                  className={cn("absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-card", info.color)}
                  title={info.label}
                />
              );
            }
            if (online) {
              return (
                <span
                  className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card"
                  title="Online"
                />
              );
            }
            return null;
          })()}
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

// ---------------------------------------------------------------------------
// MODO "BRIEFINGS" — lista briefings acessíveis com comentários/menções
// ---------------------------------------------------------------------------

function SidebarBriefingsContent({
  conversaSelecionada,
  onSelectConversa,
}: {
  conversaSelecionada: string | null;
  onSelectConversa: (id: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "nao_lidos" | "mencoes" | "resolvidos">("todos");
  const { data: briefings = [], isLoading } = useBriefingsChat();
  const filtradas = useMemo(
    () => filtrarBriefingsChat(briefings, busca, filtro),
    [briefings, busca, filtro],
  );
  const totalNaoLidas = briefings.reduce((s, b) => s + (b.naoLidos || 0), 0);
  const totalMencoes = briefings.reduce((s, b) => s + (b.mencoesAbertas || 0), 0);

  return (
    <>
      <header className="px-3 py-3 border-b border-border flex items-center gap-2">
        <h3 className="font-semibold text-sm flex-1">
          Briefings {totalNaoLidas > 0 && <Badge variant="secondary" className="ml-1">{totalNaoLidas}</Badge>}
        </h3>
      </header>

      <div className="px-3 py-2 border-b border-border space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar briefing ou trecho…"
            className="pl-8 h-9"
          />
        </div>
        <Tabs value={filtro} onValueChange={(v) => setFiltro(v as any)}>
          <TabsList className="grid grid-cols-4 h-7 w-full">
            <TabsTrigger value="todos" className="text-[11px] px-1">Todos</TabsTrigger>
            <TabsTrigger value="nao_lidos" className="text-[11px] px-1">
              Não lidos {totalNaoLidas > 0 && <span className="ml-0.5">({totalNaoLidas})</span>}
            </TabsTrigger>
            <TabsTrigger value="mencoes" className="text-[11px] px-1">
              @ {totalMencoes > 0 && <span>({totalMencoes})</span>}
            </TabsTrigger>
            <TabsTrigger value="resolvidos" className="text-[11px] px-1">Aprov.</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1">
        {isLoading && <p className="text-xs text-muted-foreground p-4">Carregando...</p>}
        {!isLoading && filtradas.length === 0 && (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Nenhum briefing encontrado.
          </div>
        )}
        <ul className="py-1">
          {filtradas.map((b) => (
            <BriefingItem
              key={b.id}
              b={b}
              ativa={b.id === conversaSelecionada}
              onSelect={() => onSelectConversa(b.id)}
            />
          ))}
        </ul>
      </ScrollArea>
    </>
  );
}

function BriefingItem({
  b, ativa, onSelect,
}: {
  b: BriefingChatItem;
  ativa: boolean;
  onSelect: () => void;
}) {
  const last = b.ultimaAtividade;
  const previewTxt = last
    ? last.fonte === "comentario"
      ? `${last.autor_nome ?? "Alguém"}: ${last.texto}`
      : `🤖 ${last.texto || "Atualização da IA"}`
    : "Sem atividade ainda";
  const temMencao = b.mencoesAbertas > 0;

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
            <AvatarFallback className="bg-blue-500/15 text-blue-700 dark:text-blue-300">
              <FileText className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          {temMencao && (
            <span
              className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-amber-500 ring-2 ring-card flex items-center justify-center"
              title={`${b.mencoesAbertas} menção(ões) a você`}
            >
              <AtSign className="h-2.5 w-2.5 text-white" />
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("truncate text-sm", b.naoLidos > 0 && "font-semibold")}>{b.titulo}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {last?.created_at ? formatRelativo(last.created_at) : ""}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <span className={cn("truncate text-xs text-muted-foreground", b.naoLidos > 0 && "text-foreground")}>
              {previewTxt}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {b.naoLidos > 0 && (
                <Badge className="h-4 min-w-4 px-1 text-[10px] rounded-full bg-emerald-600 hover:bg-emerald-600">{b.naoLidos}</Badge>
              )}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
            {b.tipo} · {b.completude}%
          </p>
        </div>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// MODO "PROJETOS" — lista projetos acessíveis (membro / criador / admin)
// ---------------------------------------------------------------------------

function SidebarProjetosContent({
  conversaSelecionada,
  onSelectConversa,
}: {
  conversaSelecionada: string | null;
  onSelectConversa: (id: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "nao_lidos" | "mencoes" | "concluidos">("todos");
  const { data: projetos = [], isLoading } = useProjetosChat();
  const filtradas = useMemo(
    () => filtrarProjetosChat(projetos, busca, filtro),
    [projetos, busca, filtro],
  );
  const totalNaoLidas = projetos.reduce((s, p) => s + (p.naoLidos || 0), 0);
  const totalMencoes = projetos.reduce((s, p) => s + (p.mencoesAbertas || 0), 0);

  return (
    <>
      <header className="px-3 py-3 border-b border-border flex items-center gap-2">
        <h3 className="font-semibold text-sm flex-1">
          Projetos {totalNaoLidas > 0 && <Badge variant="secondary" className="ml-1">{totalNaoLidas}</Badge>}
        </h3>
      </header>

      <div className="px-3 py-2 border-b border-border space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar projeto ou trecho…"
            className="pl-8 h-9"
          />
        </div>
        <Tabs value={filtro} onValueChange={(v) => setFiltro(v as any)}>
          <TabsList className="grid grid-cols-4 h-7 w-full">
            <TabsTrigger value="todos" className="text-[11px] px-1">Todos</TabsTrigger>
            <TabsTrigger value="nao_lidos" className="text-[11px] px-1">
              Não lidos {totalNaoLidas > 0 && <span className="ml-0.5">({totalNaoLidas})</span>}
            </TabsTrigger>
            <TabsTrigger value="mencoes" className="text-[11px] px-1">
              @ {totalMencoes > 0 && <span>({totalMencoes})</span>}
            </TabsTrigger>
            <TabsTrigger value="concluidos" className="text-[11px] px-1">Concl.</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1">
        {isLoading && <p className="text-xs text-muted-foreground p-4">Carregando...</p>}
        {!isLoading && filtradas.length === 0 && (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Nenhum projeto encontrado.
          </div>
        )}
        <ul className="py-1">
          {filtradas.map((p) => (
            <ProjetoItem
              key={p.id}
              p={p}
              ativa={p.id === conversaSelecionada}
              onSelect={() => onSelectConversa(p.id)}
            />
          ))}
        </ul>
      </ScrollArea>
    </>
  );
}

function ProjetoItem({
  p, ativa, onSelect,
}: {
  p: ProjetoChatItem;
  ativa: boolean;
  onSelect: () => void;
}) {
  const last = p.ultimaAtividade;
  const previewTxt = last
    ? last.fonte === "tarefa"
      ? `${last.autor_nome ?? "Alguém"} em "${last.tarefa_titulo ?? "tarefa"}": ${last.texto}`
      : `${last.autor_nome ?? "Alguém"}: ${last.texto}`
    : "Sem atividade ainda";
  const temMencao = p.mencoesAbertas > 0;
  const corBg = p.cor ?? "#6366f1";

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
            <AvatarFallback
              className="text-white"
              style={{ backgroundColor: corBg }}
            >
              <Briefcase className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          {temMencao && (
            <span
              className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-amber-500 ring-2 ring-card flex items-center justify-center"
              title={`${p.mencoesAbertas} menção(ões) a você`}
            >
              <AtSign className="h-2.5 w-2.5 text-white" />
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("truncate text-sm", p.naoLidos > 0 && "font-semibold")}>{p.nome}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {last?.created_at ? formatRelativo(last.created_at) : ""}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <span className={cn("truncate text-xs text-muted-foreground", p.naoLidos > 0 && "text-foreground")}>
              {previewTxt}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {p.naoLidos > 0 && (
                <Badge className="h-4 min-w-4 px-1 text-[10px] rounded-full bg-emerald-600 hover:bg-emerald-600">{p.naoLidos}</Badge>
              )}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate capitalize">
            {p.status}
          </p>
        </div>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// MODO "TAREFAS" — agrega tarefas e subtarefas em que o usuário participa
// e que tenham chat ativo. Usado para receber, no hub central, notificações
// de mensagens trocadas dentro de tarefas/subtarefas.
// ---------------------------------------------------------------------------

function SidebarTarefasContent({
  conversaSelecionada,
  onSelectConversa,
}: {
  conversaSelecionada: string | null;
  onSelectConversa: (id: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<TarefaChatFiltro>("todas");
  const { data: tarefas = [], isLoading } = useTarefasChat();
  const filtradas = useMemo(
    () => filtrarTarefasChat(tarefas, busca, filtro),
    [tarefas, busca, filtro],
  );

  // Contadores por categoria (ignorando arquivadas e silenciadas para o total
  // visível de não lidas — silenciadas continuam no escopo, mas não somam
  // para o badge de alerta no header).
  const visiveis = tarefas.filter((t) => !t.archived);
  const naoLidasTotal = visiveis.filter((t) => !t.muted).reduce((s, t) => s + (t.nao_lidas || 0), 0);
  const totalMencoes = visiveis.reduce((s, t) => s + (t.mencoes_abertas || 0), 0);
  const countTarefas = visiveis.filter((t) => !t.is_subtask && (t.nao_lidas || 0) > 0 && !t.muted)
    .reduce((s, t) => s + t.nao_lidas, 0);
  const countSubtarefas = visiveis.filter((t) => t.is_subtask && (t.nao_lidas || 0) > 0 && !t.muted)
    .reduce((s, t) => s + t.nao_lidas, 0);
  const arquivadasCount = tarefas.filter((t) => t.archived).length;

  return (
    <>
      <header className="px-3 py-3 border-b border-border flex items-center gap-2">
        <h3 className="font-semibold text-sm flex-1">
          Tarefas {naoLidasTotal > 0 && <Badge variant="secondary" className="ml-1">{naoLidasTotal}</Badge>}
        </h3>
      </header>

      <div className="px-3 py-2 border-b border-border space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar tarefa ou trecho…"
            className="pl-8 h-9"
          />
        </div>
        <Tabs value={filtro} onValueChange={(v) => setFiltro(v as TarefaChatFiltro)}>
          <TabsList className="grid grid-cols-3 h-7 w-full">
            <TabsTrigger value="todas" className="text-[11px] px-1">
              Todas {naoLidasTotal > 0 && <span className="ml-0.5">({naoLidasTotal})</span>}
            </TabsTrigger>
            <TabsTrigger value="tarefas" className="text-[11px] px-1">
              Tarefas {countTarefas > 0 && <span className="ml-0.5">({countTarefas})</span>}
            </TabsTrigger>
            <TabsTrigger value="subtarefas" className="text-[11px] px-1">
              Subt. {countSubtarefas > 0 && <span className="ml-0.5">({countSubtarefas})</span>}
            </TabsTrigger>
          </TabsList>
          <TabsList className="grid grid-cols-3 h-7 w-full mt-1">
            <TabsTrigger value="nao_lidas" className="text-[11px] px-1">
              Não lidas {naoLidasTotal > 0 && <span className="ml-0.5">({naoLidasTotal})</span>}
            </TabsTrigger>
            <TabsTrigger value="mencoes" className="text-[11px] px-1">
              @ {totalMencoes > 0 && <span>({totalMencoes})</span>}
            </TabsTrigger>
            <TabsTrigger value="arquivadas" className="text-[11px] px-1">
              Arquiv. {arquivadasCount > 0 && <span className="ml-0.5">({arquivadasCount})</span>}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1">
        {isLoading && <p className="text-xs text-muted-foreground p-4">Carregando...</p>}
        {!isLoading && filtradas.length === 0 && (
          <div className="p-6 text-center text-xs text-muted-foreground">
            {filtro === "arquivadas"
              ? "Nenhuma conversa arquivada."
              : "Nenhuma tarefa com conversa."}
          </div>
        )}
        <ul className="py-1">
          {filtradas.map((t) => (
            <TarefaItem
              key={t.tarefa_id}
              t={t}
              ativa={t.tarefa_id === conversaSelecionada}
              onSelect={() => onSelectConversa(t.tarefa_id)}
            />
          ))}
        </ul>
      </ScrollArea>
    </>
  );
}

function TarefaItem({
  t, ativa, onSelect,
}: {
  t: TarefaChatItem;
  ativa: boolean;
  onSelect: () => void;
}) {
  const prefMutation = useTarefaChatPreferencia();
  const previewTxt = t.ultima_mensagem
    ? `${t.ultimo_autor_nome ?? "Alguém"}: ${t.ultima_mensagem}`
    : "Sem mensagens";
  const corBg = t.projeto_cor ?? "#6366f1";
  const tempo = t.ultima_mensagem_em
    ? formatDistanceToNow(new Date(t.ultima_mensagem_em), { addSuffix: false, locale: ptBR })
    : "";
  const temMencao = t.mencoes_abertas > 0;
  const mostrarBadgeNaoLidas = t.nao_lidas > 0 && !t.muted;

  return (
    <li className="group relative">
      <button
        onClick={onSelect}
        className={cn(
          "w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-muted/50 transition-colors relative",
          ativa && "bg-muted",
          t.archived && "opacity-60",
        )}
      >
        <div className="relative shrink-0">
          <Avatar className="h-11 w-11">
            <AvatarFallback
              className="text-white"
              style={{ backgroundColor: corBg }}
            >
              {t.is_subtask ? <GitBranch className="h-5 w-5" /> : <CheckSquare className="h-5 w-5" />}
            </AvatarFallback>
          </Avatar>
          {temMencao && (
            <span
              className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-amber-500 ring-2 ring-card flex items-center justify-center"
              title={`${t.mencoes_abertas} menção(ões) a você`}
            >
              <AtSign className="h-2.5 w-2.5 text-white" />
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("truncate text-sm flex items-center gap-1", mostrarBadgeNaoLidas && "font-semibold")}>
              {t.muted && <VolumeX className="h-3 w-3 text-muted-foreground shrink-0" />}
              {t.archived && <Archive className="h-3 w-3 text-muted-foreground shrink-0" />}
              <span className="truncate">{t.titulo}</span>
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">{tempo}</span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <span className={cn("truncate text-xs text-muted-foreground", mostrarBadgeNaoLidas && "text-foreground")}>
              {previewTxt}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {mostrarBadgeNaoLidas && (
                <Badge className="h-4 min-w-4 px-1 text-[10px] rounded-full bg-emerald-600 hover:bg-emerald-600">
                  {t.nao_lidas}
                </Badge>
              )}
              {t.nao_lidas > 0 && t.muted && (
                <Badge variant="outline" className="h-4 min-w-4 px-1 text-[10px] rounded-full">
                  {t.nao_lidas}
                </Badge>
              )}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
            <Briefcase className="h-2.5 w-2.5 inline mr-0.5 -mt-0.5" />
            {t.projeto_nome}
            {t.is_subtask && t.parent_titulo && (
              <> · subt. de "{t.parent_titulo}"</>
            )}
          </p>
        </div>
      </button>

      {/* Ações por item: silenciar/arquivar — visível no hover */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              onClick={() =>
                prefMutation.mutate({ tarefaId: t.tarefa_id, muted: !t.muted })
              }
            >
              {t.muted ? (
                <><BellOff className="h-3.5 w-3.5 mr-2 opacity-50" />Reativar notificações</>
              ) : (
                <><VolumeX className="h-3.5 w-3.5 mr-2" />Silenciar conversa</>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                prefMutation.mutate({ tarefaId: t.tarefa_id, archived: !t.archived })
              }
            >
              {t.archived ? (
                <><Archive className="h-3.5 w-3.5 mr-2 opacity-50" />Restaurar conversa</>
              ) : (
                <><Archive className="h-3.5 w-3.5 mr-2" />Arquivar conversa</>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
