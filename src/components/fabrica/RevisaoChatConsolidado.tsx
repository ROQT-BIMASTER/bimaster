import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Search, Inbox, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RevisaoChatPanel } from "@/components/fabrica/RevisaoChatPanel";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConversaResumo {
  revisaoId: string;
  configId: string;
  produtoNome: string;
  produtoCodigo: string;
  versao: number;
  status: string;
  totalMensagens: number;
  naoLidas: number;
  ultimaMensagem: string;
  ultimaMensagemData: string;
  ultimoRemetente: string;
  insumos: { id: string; nome: string; codigo: string }[];
}

export function RevisaoChatConsolidado() {
  const [conversas, setConversas] = useState<ConversaResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [conversaAberta, setConversaAberta] = useState<ConversaResumo | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const carregarConversas = useCallback(async () => {
    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const uid = user?.user?.id || null;
      setUserId(uid);

      // Buscar todas revisões ativas (pendente, revisao_solicitada, em_revisao)
      const { data: revisoes } = await supabase
        .from("fabrica_ficha_custo_revisoes")
        .select("id, config_id, produto_id, versao, status, snapshot_insumos, produto:fabrica_produtos(id, nome, codigo)")
        .in("status", ["pendente", "revisao_solicitada", "em_revisao"])
        .order("submetido_em", { ascending: false });

      if (!revisoes || revisoes.length === 0) { setConversas([]); setLoading(false); return; }

      const revisaoIds = revisoes.map((r: any) => r.id);

      // Buscar todas mensagens dessas revisões
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
          const ultimaMsg = msgs[0]; // já ordenado desc
          const naoLidas = uid ? msgs.filter((m: any) => {
            const lidaPor = m.lida_por || [];
            return !lidaPor.includes(uid) && m.usuario_id !== uid;
          }).length : 0;

          const insumos = (rev.snapshot_insumos || []).map((i: any) => ({ id: i.id, nome: i.nome, codigo: i.codigo }));

          return {
            revisaoId: rev.id,
            configId: rev.config_id,
            produtoNome: rev.produto?.nome || "Produto",
            produtoCodigo: rev.produto?.codigo || "",
            versao: rev.versao,
            status: rev.status,
            totalMensagens: msgs.length,
            naoLidas,
            ultimaMensagem: ultimaMsg.conteudo,
            ultimaMensagemData: ultimaMsg.created_at,
            ultimoRemetente: ultimaMsg.usuario_nome,
            insumos,
          } as ConversaResumo;
        })
        .filter(Boolean) as ConversaResumo[];

      setConversas(result);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { carregarConversas(); }, [carregarConversas]);

  // Marcar como lida ao abrir conversa
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
      // Atualizar badge local
      setConversas(prev => prev.map(c => c.revisaoId === conversaAberta.revisaoId ? { ...c, naoLidas: 0 } : c));
    };
    marcarLidas();
  }, [conversaAberta, userId]);

  const filtered = useMemo(() => {
    return conversas.filter((c) => {
      const matchBusca = !busca || c.produtoNome.toLowerCase().includes(busca.toLowerCase()) || c.produtoCodigo.toLowerCase().includes(busca.toLowerCase());
      const matchStatus = filtroStatus === "all" || c.status === filtroStatus;
      return matchBusca && matchStatus;
    });
  }, [conversas, busca, filtroStatus]);

  const totalNaoLidas = conversas.reduce((sum, c) => sum + c.naoLidas, 0);

  if (conversaAberta) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => { setConversaAberta(null); carregarConversas(); }}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <CardTitle className="text-base">{conversaAberta.produtoNome}</CardTitle>
              <p className="text-xs text-muted-foreground">{conversaAberta.produtoCodigo} — v{conversaAberta.versao}</p>
            </div>
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
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por produto..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
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
            Nenhuma conversa ativa encontrada.
          </div>
        ) : (
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-1">
              {filtered.map((c) => (
                <button
                  key={c.revisaoId}
                  onClick={() => setConversaAberta(c)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors hover:bg-muted/50 ${c.naoLidas > 0 ? "bg-primary/5 border-primary/20" : "border-transparent"}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate max-w-[200px]">{c.produtoNome}</span>
                      <Badge variant="outline" className="text-[10px]">v{c.versao}</Badge>
                      <Badge variant={c.status === "pendente" ? "warning" : "secondary"} className="text-[10px] capitalize">
                        {c.status.replace("_", " ")}
                      </Badge>
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
                  <p className="text-xs text-muted-foreground truncate">
                    <span className="font-medium">{c.ultimoRemetente}:</span> {c.ultimaMensagem}
                  </p>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
