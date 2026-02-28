import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare, Search, Inbox, Loader2, Lock, Plus, X, Filter, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RevisaoChatPanel } from "@/components/fabrica/RevisaoChatPanel";
import { NovaComunicacaoDialog } from "@/components/fabrica/NovaComunicacaoDialog";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatRelativeTime } from "@/lib/formatters";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";

interface ConversaResumo {
  revisaoId: string;
  configId: string;
  produtoNome: string;
  produtoCodigo: string;
  produtoMarca: string;
  produtoLinha: string;
  produtoId: string;
  versao: number;
  status: string;
  chatStatus: string;
  totalMensagens: number;
  naoLidas: number;
  ultimaMensagem: string;
  ultimaMensagemData: string;
  ultimoRemetente: string;
  remetentes: string[];
  insumos: { id: string; nome: string; codigo: string }[];
  highlightNew?: boolean;
}

const MARCA_COLORS: Record<string, string> = {};
const COLOR_PALETTE = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-orange-500", "bg-teal-500",
];
let colorIndex = 0;

function getMarcaColor(marca: string) {
  if (!marca) return "bg-primary";
  if (!MARCA_COLORS[marca]) {
    MARCA_COLORS[marca] = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
    colorIndex++;
  }
  return MARCA_COLORS[marca];
}

function getInitials(name: string) {
  return name.split(" ").map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function ConversaListSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

interface ActiveFilter {
  key: string;
  label: string;
  value: string;
  displayValue: string;
}

export function RevisaoChatConsolidado() {
  const [conversas, setConversas] = useState<ConversaResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [filtroChatStatus, setFiltroChatStatus] = useState("aberto");
  const [filtroMarca, setFiltroMarca] = useState("all");
  const [filtroLinha, setFiltroLinha] = useState("all");
  const [filtroProduto, setFiltroProduto] = useState("all");
  const [filtroUsuario, setFiltroUsuario] = useState("all");
  const [conversaAberta, setConversaAberta] = useState<ConversaResumo | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [dialogNovaCom, setDialogNovaCom] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const isMobile = useIsMobile();

  const carregarConversas = useCallback(async () => {
    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const uid = user?.user?.id || null;
      setUserId(uid);

      const { data: revisoes } = await supabase
        .from("fabrica_ficha_custo_revisoes")
        .select("id, config_id, produto_id, versao, status, chat_status, snapshot_insumos, produto:fabrica_produtos(id, nome, codigo, marca, linha)")
        .in("status", ["pendente", "revisao_solicitada", "em_revisao"])
        .order("submetido_em", { ascending: false });

      if (!revisoes || revisoes.length === 0) { setConversas([]); setLoading(false); return; }

      const revisaoIds = revisoes.map((r: any) => r.id);

      const { data: mensagens } = await supabase
        .from("fabrica_revisao_mensagens" as any)
        .select("*")
        .in("revisao_id", revisaoIds)
        .order("created_at", { ascending: false });

      const msgList = (mensagens as any[]) || [];
      const msgByRevisao = new Map<string, any[]>();
      msgList.forEach((m) => {
        const arr = msgByRevisao.get(m.revisao_id) || [];
        arr.push(m);
        msgByRevisao.set(m.revisao_id, arr);
      });

      const result: ConversaResumo[] = revisoes
        .map((rev: any) => {
          const msgs = msgByRevisao.get(rev.id) || [];
          if (msgs.length === 0) return null;
          const ultimaMsg = msgs[0];
          const naoLidas = uid ? msgs.filter((m: any) => {
            const lidaPor = m.lida_por || [];
            return !lidaPor.includes(uid) && m.usuario_id !== uid;
          }).length : 0;

          const insumos = (rev.snapshot_insumos || []).map((i: any) => ({ id: i.id, nome: i.nome, codigo: i.codigo }));
          const remetentes = [...new Set(msgs.map((m: any) => m.usuario_nome as string))];

          return {
            revisaoId: rev.id,
            configId: rev.config_id,
            produtoNome: rev.produto?.nome || "Produto",
            produtoCodigo: rev.produto?.codigo || "",
            produtoMarca: rev.produto?.marca || "",
            produtoLinha: rev.produto?.linha || "",
            produtoId: rev.produto?.id || "",
            versao: rev.versao,
            status: rev.status,
            chatStatus: (rev as any).chat_status || "aberto",
            totalMensagens: msgs.length,
            naoLidas,
            ultimaMensagem: ultimaMsg.conteudo,
            ultimaMensagemData: ultimaMsg.created_at,
            ultimoRemetente: ultimaMsg.usuario_nome,
            remetentes,
            insumos,
          } as ConversaResumo;
        })
        .filter(Boolean) as ConversaResumo[];

      // Sort: unread first, then by date
      result.sort((a, b) => {
        if (a.naoLidas > 0 && b.naoLidas === 0) return -1;
        if (a.naoLidas === 0 && b.naoLidas > 0) return 1;
        return new Date(b.ultimaMensagemData).getTime() - new Date(a.ultimaMensagemData).getTime();
      });

      setConversas(result);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { carregarConversas(); }, [carregarConversas]);

  // Realtime: highlight new messages in list
  useEffect(() => {
    const channel = supabase
      .channel("revisao-chat-list")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "fabrica_revisao_mensagens",
      }, (payload) => {
        const newMsg = payload.new as any;
        if (newMsg.usuario_id === userId) return;
        
        setConversas(prev => prev.map(c => {
          if (c.revisaoId === newMsg.revisao_id) {
            const isCurrentlyOpen = conversaAberta?.revisaoId === newMsg.revisao_id;
            return {
              ...c,
              naoLidas: isCurrentlyOpen ? c.naoLidas : c.naoLidas + 1,
              ultimaMensagem: newMsg.conteudo,
              ultimaMensagemData: newMsg.created_at,
              ultimoRemetente: newMsg.usuario_nome,
              highlightNew: !isCurrentlyOpen,
            };
          }
          return c;
        }));

        // Clear highlight after 3s
        setTimeout(() => {
          setConversas(prev => prev.map(c => ({ ...c, highlightNew: false })));
        }, 3000);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, conversaAberta]);

  // Mark as read on open
  useEffect(() => {
    if (!conversaAberta || !userId) return;
    const marcarLidas = async () => {
      const { data: msgs } = await supabase
        .from("fabrica_revisao_mensagens" as any)
        .select("id, lida_por")
        .eq("revisao_id", conversaAberta.revisaoId);
      if (!msgs) return;
      for (const m of msgs as any[]) {
        const lidaPor = m.lida_por || [];
        if (!lidaPor.includes(userId)) {
          await supabase.from("fabrica_revisao_mensagens" as any)
            .update({ lida_por: [...lidaPor, userId] } as any)
            .eq("id", m.id);
        }
      }
      setConversas(prev => prev.map(c => c.revisaoId === conversaAberta.revisaoId ? { ...c, naoLidas: 0 } : c));
    };
    marcarLidas();
  }, [conversaAberta, userId]);

  const finalizarDaLista = async (revisaoId: string) => {
    try {
      await supabase.from("fabrica_ficha_custo_revisoes")
        .update({ chat_status: "finalizado", chat_finalizado_por: userId, chat_finalizado_em: new Date().toISOString() } as any)
        .eq("id", revisaoId);
      setConversas(prev => prev.map(c => c.revisaoId === revisaoId ? { ...c, chatStatus: "finalizado" } : c));
      toast.success("Conversa finalizada.");
    } catch (err: any) { toast.error(err.message); }
  };

  // Filter option lists
  const marcas = useMemo(() => {
    const set = new Set<string>();
    conversas.forEach(c => { if (c.produtoMarca) set.add(c.produtoMarca); });
    return [...set].sort();
  }, [conversas]);

  const linhas = useMemo(() => {
    const set = new Set<string>();
    conversas.forEach(c => {
      if (c.produtoLinha && (filtroMarca === "all" || c.produtoMarca === filtroMarca))
        set.add(c.produtoLinha);
    });
    return [...set].sort();
  }, [conversas, filtroMarca]);

  const produtos = useMemo(() => {
    const map = new Map<string, string>();
    conversas.forEach(c => {
      if (filtroMarca !== "all" && c.produtoMarca !== filtroMarca) return;
      if (filtroLinha !== "all" && c.produtoLinha !== filtroLinha) return;
      map.set(c.produtoId, c.produtoNome);
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [conversas, filtroMarca, filtroLinha]);

  const usuarios = useMemo(() => {
    const set = new Set<string>();
    conversas.forEach(c => c.remetentes.forEach(r => set.add(r)));
    return [...set].sort();
  }, [conversas]);

  const filtered = useMemo(() => {
    return conversas.filter((c) => {
      if (filtroMarca !== "all" && c.produtoMarca !== filtroMarca) return false;
      if (filtroLinha !== "all" && c.produtoLinha !== filtroLinha) return false;
      if (filtroProduto !== "all" && c.produtoId !== filtroProduto) return false;
      if (filtroUsuario !== "all" && !c.remetentes.includes(filtroUsuario)) return false;
      const matchBusca = !busca || c.produtoNome.toLowerCase().includes(busca.toLowerCase()) || c.produtoCodigo.toLowerCase().includes(busca.toLowerCase());
      const matchStatus = filtroStatus === "all" || c.status === filtroStatus;
      const matchChat = filtroChatStatus === "all" || c.chatStatus === filtroChatStatus;
      return matchBusca && matchStatus && matchChat;
    });
  }, [conversas, busca, filtroStatus, filtroChatStatus, filtroMarca, filtroLinha, filtroProduto, filtroUsuario]);

  const totalNaoLidas = conversas.reduce((sum, c) => sum + c.naoLidas, 0);

  // Active filters as chips
  const activeFilters = useMemo(() => {
    const filters: ActiveFilter[] = [];
    if (filtroMarca !== "all") filters.push({ key: "marca", label: "Marca", value: filtroMarca, displayValue: filtroMarca });
    if (filtroLinha !== "all") filters.push({ key: "linha", label: "Linha", value: filtroLinha, displayValue: filtroLinha });
    if (filtroProduto !== "all") {
      const p = produtos.find(([id]) => id === filtroProduto);
      filters.push({ key: "produto", label: "Produto", value: filtroProduto, displayValue: p?.[1] || filtroProduto });
    }
    if (filtroUsuario !== "all") filters.push({ key: "usuario", label: "Usuário", value: filtroUsuario, displayValue: filtroUsuario });
    if (filtroChatStatus !== "all") filters.push({ key: "chatStatus", label: "Chat", value: filtroChatStatus, displayValue: filtroChatStatus === "aberto" ? "Abertas" : "Finalizadas" });
    if (filtroStatus !== "all") filters.push({ key: "status", label: "Status", value: filtroStatus, displayValue: filtroStatus.replace("_", " ") });
    return filters;
  }, [filtroMarca, filtroLinha, filtroProduto, filtroUsuario, filtroChatStatus, filtroStatus, produtos]);

  const removeFilter = (key: string) => {
    switch (key) {
      case "marca": setFiltroMarca("all"); setFiltroLinha("all"); setFiltroProduto("all"); break;
      case "linha": setFiltroLinha("all"); setFiltroProduto("all"); break;
      case "produto": setFiltroProduto("all"); break;
      case "usuario": setFiltroUsuario("all"); break;
      case "chatStatus": setFiltroChatStatus("aberto"); break;
      case "status": setFiltroStatus("all"); break;
    }
  };

  const clearAllFilters = () => {
    setFiltroMarca("all"); setFiltroLinha("all"); setFiltroProduto("all");
    setFiltroUsuario("all"); setFiltroChatStatus("aberto"); setFiltroStatus("all");
    setBusca("");
  };

  // ─── Conversation list component ───
  const renderConversaList = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b bg-card">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Conversas</span>
            {totalNaoLidas > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5 min-w-[20px] justify-center">{totalNaoLidas}</Badge>
            )}
          </div>
          <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => setDialogNovaCom(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Nova
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {activeFilters.map(f => (
              <Badge key={f.key} variant="secondary" className="text-[10px] gap-1 py-0.5 px-2 capitalize">
                {f.label}: {f.displayValue}
                <button onClick={() => removeFilter(f.key)} className="hover:text-destructive">
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
            <button onClick={clearAllFilters} className="text-[10px] text-muted-foreground hover:text-destructive ml-1">
              Limpar
            </button>
          </div>
        )}

        {/* Collapsible filters */}
        <Collapsible open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground mt-1 w-full justify-between px-1">
              <span className="flex items-center gap-1">
                <Filter className="h-3 w-3" />
                Filtros
              </span>
              <ChevronDown className={`h-3 w-3 transition-transform ${filtrosAbertos ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1.5 mt-1.5">
            <Select value={filtroMarca} onValueChange={(v) => { setFiltroMarca(v); setFiltroLinha("all"); setFiltroProduto("all"); }}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Marca" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Marcas</SelectItem>
                {marcas.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroLinha} onValueChange={(v) => { setFiltroLinha(v); setFiltroProduto("all"); }}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Linha" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Linhas</SelectItem>
                {linhas.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroProduto} onValueChange={setFiltroProduto}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Produto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Produtos</SelectItem>
                {produtos.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Usuário" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Usuários</SelectItem>
                {usuarios.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-1.5">
              <Select value={filtroChatStatus} onValueChange={setFiltroChatStatus}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="aberto">Abertas</SelectItem>
                  <SelectItem value="finalizado">Finalizadas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="revisao_solicitada">Revisão Solicitada</SelectItem>
                  <SelectItem value="em_revisao">Em Revisão</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Result count */}
        <div className="text-[10px] text-muted-foreground mt-1 px-1">
          {filtered.length} conversa{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        {loading ? (
          <ConversaListSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <MessageSquare className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Nenhuma conversa</p>
            <p className="text-xs text-muted-foreground/70">Ajuste os filtros ou inicie uma nova comunicação.</p>
          </div>
        ) : (
          <div className="p-1">
            <AnimatePresence>
              {filtered.map((c) => {
                const isFinalizada = c.chatStatus === "finalizado";
                const isSelected = conversaAberta?.revisaoId === c.revisaoId;
                const marcaColor = getMarcaColor(c.produtoMarca);

                return (
                  <motion.div
                    key={c.revisaoId}
                    initial={c.highlightNew ? { backgroundColor: "hsl(var(--primary) / 0.15)" } : false}
                    animate={{ backgroundColor: c.highlightNew ? "hsl(var(--primary) / 0.15)" : "transparent" }}
                    transition={{ duration: 2 }}
                  >
                    <button
                      onClick={() => setConversaAberta(c)}
                      className={`w-full text-left p-3 rounded-lg transition-all duration-150 flex gap-3 items-start mb-0.5
                        ${isSelected
                          ? "bg-primary/10 border border-primary/20"
                          : isFinalizada
                            ? "opacity-50 hover:opacity-70 hover:bg-muted/30"
                            : c.naoLidas > 0
                              ? "bg-primary/5 hover:bg-primary/10"
                              : "hover:bg-muted/50"
                        }`}
                    >
                      {/* Avatar with status dot */}
                      <div className="relative shrink-0">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className={`text-xs font-bold text-white ${marcaColor}`}>
                            {getInitials(c.produtoNome)}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                          isFinalizada ? "bg-muted-foreground/40" : "bg-emerald-500"
                        }`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className={`text-sm truncate ${c.naoLidas > 0 ? "font-bold" : "font-medium"}`}>
                            {c.produtoNome}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatRelativeTime(c.ultimaMensagemData)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 mb-1">
                          <Badge variant="outline" className="text-[9px] py-0 px-1 h-4">{c.produtoCodigo}</Badge>
                          {c.produtoMarca && (
                            <Badge variant="secondary" className="text-[9px] py-0 px-1 h-4">{c.produtoMarca}</Badge>
                          )}
                          {isFinalizada && (
                            <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-1">
                          <p className={`text-xs truncate ${c.naoLidas > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                            <span className="font-medium">{c.ultimoRemetente}:</span> {c.ultimaMensagem}
                          </p>
                          {c.naoLidas > 0 && (
                            <Badge variant="destructive" className="text-[10px] h-5 min-w-[20px] justify-center shrink-0 rounded-full">
                              {c.naoLidas}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>
    </div>
  );

  // ─── Chat panel (right side) ───
  const renderChatPanel = () => {
    if (!conversaAberta) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center px-6">
          <div className="h-20 w-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
            <MessageSquare className="h-9 w-9 text-muted-foreground/30" />
          </div>
          <h3 className="text-lg font-semibold text-muted-foreground mb-1">Selecione uma conversa</h3>
          <p className="text-sm text-muted-foreground/70 max-w-xs">
            Escolha uma conversa na lista à esquerda para visualizar as mensagens e participar da discussão.
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        {/* Rich chat header */}
        <div className="border-b bg-card p-3">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setConversaAberta(null)}>
                <X className="h-4 w-4" />
              </Button>
            )}
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className={`text-xs font-bold text-white ${getMarcaColor(conversaAberta.produtoMarca)}`}>
                {getInitials(conversaAberta.produtoNome)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm truncate">{conversaAberta.produtoNome}</span>
                <Badge variant="outline" className="text-[10px] py-0">v{conversaAberta.versao}</Badge>
                <Badge
                  variant={
                    conversaAberta.status === "pendente" ? "warning" :
                    conversaAberta.status === "em_revisao" ? "default" : "secondary"
                  }
                  className="text-[10px] py-0 capitalize"
                >
                  {conversaAberta.status.replace(/_/g, " ")}
                </Badge>
                {conversaAberta.chatStatus === "finalizado" && (
                  <Badge variant="outline" className="text-[10px] py-0 gap-0.5">
                    <Lock className="h-2.5 w-2.5" /> Finalizada
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-muted-foreground">{conversaAberta.produtoCodigo}</span>
                {conversaAberta.produtoMarca && (
                  <span className="text-[11px] text-muted-foreground">• {conversaAberta.produtoMarca}</span>
                )}
                {conversaAberta.produtoLinha && (
                  <span className="text-[11px] text-muted-foreground">• {conversaAberta.produtoLinha}</span>
                )}
              </div>
            </div>
            {!isMobile && conversaAberta.chatStatus !== "finalizado" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => finalizarDaLista(conversaAberta.revisaoId)}
              >
                <Lock className="h-3.5 w-3.5 mr-1" /> Finalizar
              </Button>
            )}
          </div>

          {/* Insumos chips */}
          {conversaAberta.insumos.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {conversaAberta.insumos.slice(0, 5).map(i => (
                <Badge key={i.id} variant="outline" className="text-[10px] py-0 px-1.5">
                  {i.codigo} - {i.nome}
                </Badge>
              ))}
              {conversaAberta.insumos.length > 5 && (
                <Badge variant="secondary" className="text-[10px] py-0">
                  +{conversaAberta.insumos.length - 5}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Chat panel body */}
        <div className="flex-1 overflow-hidden">
          <RevisaoChatPanel
            revisaoId={conversaAberta.revisaoId}
            configId={conversaAberta.configId}
            insumos={conversaAberta.insumos}
            tipoRemetente="diretoria"
            produtoId={conversaAberta.produtoId}
          />
        </div>
      </div>
    );
  };

  // ─── Mobile: show list or chat ───
  if (isMobile) {
    return (
      <>
        {conversaAberta ? (
          <div className="h-[calc(100vh-8rem)] bg-background rounded-lg border overflow-hidden">
            {renderChatPanel()}
          </div>
        ) : (
          <div className="h-[calc(100vh-8rem)] bg-background rounded-lg border overflow-hidden">
            {renderConversaList()}
          </div>
        )}
        <NovaComunicacaoDialog
          open={dialogNovaCom}
          onOpenChange={setDialogNovaCom}
          onCriada={(revisaoId, configId, produto, insumos) => {
            const novaConversa: ConversaResumo = {
              revisaoId, configId,
              produtoNome: produto.nome, produtoCodigo: produto.codigo,
              produtoMarca: produto.marca, produtoLinha: produto.linha,
              produtoId: produto.id, versao: 1, status: "revisao_solicitada",
              chatStatus: "aberto", totalMensagens: 1, naoLidas: 0,
              ultimaMensagem: "", ultimaMensagemData: new Date().toISOString(),
              ultimoRemetente: "", remetentes: [], insumos,
            };
            setConversaAberta(novaConversa);
            carregarConversas();
          }}
        />
      </>
    );
  }

  // ─── Desktop: split-view ───
  return (
    <>
      <div className="flex h-[calc(100vh-8rem)] rounded-xl border bg-background overflow-hidden shadow-sm">
        {/* Left panel: conversation list */}
        <div className="w-[340px] min-w-[280px] max-w-[400px] border-r flex flex-col bg-card/50">
          {renderConversaList()}
        </div>

        {/* Right panel: chat */}
        <div className="flex-1 flex flex-col min-w-0">
          {renderChatPanel()}
        </div>
      </div>

      <NovaComunicacaoDialog
        open={dialogNovaCom}
        onOpenChange={setDialogNovaCom}
        onCriada={(revisaoId, configId, produto, insumos) => {
          const novaConversa: ConversaResumo = {
            revisaoId, configId,
            produtoNome: produto.nome, produtoCodigo: produto.codigo,
            produtoMarca: produto.marca, produtoLinha: produto.linha,
            produtoId: produto.id, versao: 1, status: "revisao_solicitada",
            chatStatus: "aberto", totalMensagens: 1, naoLidas: 0,
            ultimaMensagem: "", ultimaMensagemData: new Date().toISOString(),
            ultimoRemetente: "", remetentes: [], insumos,
          };
          setConversaAberta(novaConversa);
          carregarConversas();
        }}
      />
    </>
  );
}
