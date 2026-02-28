import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Search, Inbox, ArrowLeft, Loader2, Lock, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RevisaoChatPanel } from "@/components/fabrica/RevisaoChatPanel";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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
}

function getInitials(name: string) {
  return name.split(" ").map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
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

      setConversas(result);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { carregarConversas(); }, [carregarConversas]);

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

  if (conversaAberta) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => { setConversaAberta(null); carregarConversas(); }}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {getInitials(conversaAberta.produtoNome)}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base">{conversaAberta.produtoNome}</CardTitle>
              <p className="text-xs text-muted-foreground">{conversaAberta.produtoCodigo} — v{conversaAberta.versao}</p>
            </div>
            {conversaAberta.chatStatus === "finalizado" && (
              <Badge variant="outline" className="ml-auto text-xs gap-1">
                <Lock className="h-3 w-3" /> Finalizada
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <RevisaoChatPanel
            revisaoId={conversaAberta.revisaoId}
            configId={conversaAberta.configId}
            insumos={conversaAberta.insumos}
            tipoRemetente="diretoria"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            Comunicação — Revisões
            {totalNaoLidas > 0 && (
              <Badge variant="destructive" className="text-xs">{totalNaoLidas} não lida{totalNaoLidas !== 1 ? "s" : ""}</Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por produto..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={filtroMarca} onValueChange={(v) => { setFiltroMarca(v); setFiltroLinha("all"); setFiltroProduto("all"); }}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Marca" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Marcas</SelectItem>
              {marcas.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroLinha} onValueChange={(v) => { setFiltroLinha(v); setFiltroProduto("all"); }}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Linha" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Linhas</SelectItem>
              {linhas.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroProduto} onValueChange={setFiltroProduto}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Produto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Produtos</SelectItem>
              {produtos.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Usuário" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Usuários</SelectItem>
              {usuarios.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroChatStatus} onValueChange={setFiltroChatStatus}>
            <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="aberto">Abertas</SelectItem>
              <SelectItem value="finalizado">Finalizadas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="revisao_solicitada">Revisão Solicitada</SelectItem>
              <SelectItem value="em_revisao">Em Revisão</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Nenhuma conversa encontrada.
          </div>
        ) : (
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-1">
              {filtered.map((c) => {
                const isFinalizada = c.chatStatus === "finalizado";
                return (
                  <div
                    key={c.revisaoId}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-colors hover:bg-muted/50 ${
                      isFinalizada ? "opacity-50" : ""
                    } ${c.naoLidas > 0 ? "bg-primary/5 border-primary/20" : "border-transparent"}`}
                  >
                    <button
                      onClick={() => setConversaAberta(c)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {getInitials(c.produtoNome)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm truncate max-w-[180px]">{c.produtoNome}</span>
                          <Badge variant="outline" className="text-[10px]">v{c.versao}</Badge>
                          <Badge variant={c.status === "pendente" ? "warning" : "secondary"} className="text-[10px] capitalize">
                            {c.status.replace("_", " ")}
                          </Badge>
                          {isFinalizada && (
                            <Badge variant="outline" className="text-[10px] gap-0.5">
                              <Lock className="h-2.5 w-2.5" /> Finalizada
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {c.naoLidas > 0 && (
                            <Badge variant="destructive" className="text-[10px] min-w-[20px] justify-center">{c.naoLidas}</Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(c.ultimaMensagemData), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground truncate pl-9">
                        <span className="font-medium">{c.ultimoRemetente}:</span> {c.ultimaMensagem}
                      </p>
                    </button>
                    {!isFinalizada && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); finalizarDaLista(c.revisaoId); }}
                        title="Finalizar conversa"
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
