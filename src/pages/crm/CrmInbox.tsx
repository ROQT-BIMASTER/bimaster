import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { useAuth } from "@/contexts/AuthContext";
import { CrmPageHeader } from "@/components/crm/CrmPageHeader";
import { CrmStatusBadge } from "@/components/crm/CrmStatusBadge";
import { MessageBody } from "@/components/crm/MessageBody";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Inbox, Search, UserPlus, Send, Lock, AlertTriangle, Filter, RefreshCw } from "lucide-react";
import { channelIcon, initials, relativeTime } from "@/lib/crm/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Conv = {
  id: string; canal: string; status: string; operador_id: string | null;
  ultima_mensagem_em: string; sla_due_at: string | null; fila_id: string | null;
  bot_id: string | null;
  contato: { nome: string | null; telefone: string | null; email: string | null } | null;
  bot?: { nome: string; modo_leitura: boolean } | null;
};

export default function CrmInbox() {
  const { empresaSelecionada, empresaIds } = useEmpresaContext();
  const { user } = useAuth();
  const qc = useQueryClient();
  const empresaId = empresaSelecionada?.id ?? empresaIds[0];

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("abertas");
  const [canal, setCanal] = useState<string>("all");
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("conv");
  const setSelectedId = (id: string | null) => { const p = new URLSearchParams(params); id ? p.set("conv", id) : p.delete("conv"); setParams(p, { replace: true }); };

  const { data: conversas = [], isLoading } = useQuery({
    queryKey: ["crm-inbox", empresaId, status, canal, search],
    enabled: !!empresaId,
    refetchInterval: 30_000,
    queryFn: async () => {
      let q = supabase
        .from("crm_conversas")
        .select("id, canal, status, operador_id, ultima_mensagem_em, sla_due_at, fila_id, bot_id, contato:crm_contatos(nome, telefone, email), bot:crm_bots(nome, modo_leitura)")
        .eq("empresa_id", empresaId!)
        .order("ultima_mensagem_em", { ascending: false })
        .limit(200);
      if (status === "abertas") q = q.in("status", ["open", "assigned", "pending"]);
      else if (status !== "all") q = q.eq("status", status as any);
      if (canal !== "all") q = q.eq("canal", canal as any);
      const { data, error } = await q;
      if (error) throw error;
      const filtered = (data as any as Conv[]).filter(c => {
        if (!search.trim()) return true;
        const s = search.toLowerCase();
        return (c.contato?.nome?.toLowerCase().includes(s) || c.contato?.telefone?.includes(s) || c.contato?.email?.toLowerCase().includes(s));
      });
      return filtered;
    },
  });

  useEffect(() => {
    if (!empresaId) return;
    const ch = supabase.channel(`crm-inbox-${empresaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_conversas", filter: `empresa_id=eq.${empresaId}` }, () => {
        qc.invalidateQueries({ queryKey: ["crm-inbox", empresaId] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "crm_mensagens", filter: `empresa_id=eq.${empresaId}` }, () => {
        qc.invalidateQueries({ queryKey: ["crm-inbox", empresaId] });
        if (selectedId) qc.invalidateQueries({ queryKey: ["crm-thread", selectedId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [empresaId, qc, selectedId]);

  const selected = useMemo(() => conversas.find(c => c.id === selectedId), [conversas, selectedId]);

  const assignToMe = async () => {
    if (!selected || !user) return;
    const { error } = await supabase.from("crm_conversas").update({ operador_id: user.id, status: "assigned" }).eq("id", selected.id);
    if (error) toast.error(error.message); else { toast.success("Conversa atribuída a você"); qc.invalidateQueries({ queryKey: ["crm-inbox", empresaId] }); }
  };
  const closeConv = async () => {
    if (!selected) return;
    const { error } = await supabase.from("crm_conversas").update({ status: "closed", fechada_em: new Date().toISOString() }).eq("id", selected.id);
    if (error) toast.error(error.message); else { toast.success("Conversa fechada"); qc.invalidateQueries({ queryKey: ["crm-inbox", empresaId] }); }
  };

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col">
      <CrmPageHeader
        icon={Inbox}
        title="Inbox unificada"
        count={conversas.length}
        subtitle="Conversas em tempo real · canais omnichannel"
        actions={
          <>
            <div className="relative w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar contato, telefone, email" value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-7 text-xs" />
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => qc.invalidateQueries({ queryKey: ["crm-inbox", empresaId] })}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </>
        }
      />
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={32} minSize={24}>
          <div className="h-full flex flex-col border-r">
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="abertas">Abertas</SelectItem>
                  <SelectItem value="open">Aberta</SelectItem>
                  <SelectItem value="assigned">Atribuída</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="closed">Fechada</SelectItem>
                  <SelectItem value="all">Todas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos canais</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="messenger">Messenger</SelectItem>
                  <SelectItem value="webchat">Webchat</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ScrollArea className="flex-1">
              {isLoading && <div className="p-4 text-center text-xs text-muted-foreground">Carregando…</div>}
              {!isLoading && conversas.length === 0 && (
                <div className="p-6 text-center text-xs text-muted-foreground">Nenhuma conversa</div>
              )}
              <div className="divide-y">
                {conversas.map(c => {
                  const CIcon = channelIcon(c.canal);
                  const isSel = c.id === selectedId;
                  const slaBad = c.sla_due_at && new Date(c.sla_due_at).getTime() < Date.now();
                  return (
                    <button key={c.id} onClick={() => setSelectedId(c.id)} className={cn("w-full text-left px-3 py-2 hover:bg-muted/50 flex items-start gap-2", isSel && "bg-primary/10 border-l-2 border-l-primary")}>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[10px] font-medium shrink-0">{initials(c.contato?.nome ?? c.contato?.telefone)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-xs text-foreground truncate">{c.contato?.nome ?? c.contato?.telefone ?? "Sem contato"}</div>
                          <div className="text-[10px] text-muted-foreground shrink-0">{relativeTime(c.ultima_mensagem_em)}</div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <CIcon className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[11px] text-muted-foreground truncate">{c.contato?.telefone ?? c.bot?.nome ?? c.canal}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <CrmStatusBadge status={c.status} />
                          {slaBad && <span className="inline-flex items-center gap-1 text-[10px] text-destructive"><AlertTriangle className="h-2.5 w-2.5" /> SLA</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={68}>
          {selected ? (
            <Thread conv={selected} onAssign={assignToMe} onClose={closeConv} />
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Selecione uma conversa</div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function Thread({ conv, onAssign, onClose }: { conv: Conv; onAssign: () => void; onClose: () => void }) {
  const { data: mensagens = [] } = useQuery({
    queryKey: ["crm-thread", conv.id],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_mensagens").select("id, direction, tipo, conteudo, autor_nome, criada_em").eq("conversa_id", conv.id).order("criada_em", { ascending: true }).limit(500);
      if (error) throw error; return data ?? [];
    },
  });

  const readonly = conv.bot?.modo_leitura ?? true;

  return (
    <div className="h-full flex flex-col">
      <div className="border-b px-4 py-2.5 flex items-center gap-3 bg-card">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">{initials(conv.contato?.nome ?? conv.contato?.telefone)}</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground truncate">{conv.contato?.nome ?? conv.contato?.telefone ?? "Sem contato"}</div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
            <span>{conv.contato?.telefone ?? "—"}</span>
            <span>·</span>
            <span>{conv.bot?.nome ?? conv.canal}</span>
            <CrmStatusBadge status={conv.status} />
          </div>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={onAssign}><UserPlus className="h-3.5 w-3.5" /> Atribuir-me</Button>
        <Button size="sm" variant="outline" className="h-8" onClick={onClose}>Fechar</Button>
      </div>
      <ScrollArea className="flex-1 bg-muted/20">
        <div className="p-4 space-y-2 max-w-3xl mx-auto">
          {mensagens.length === 0 && <div className="text-center text-xs text-muted-foreground py-12">Sem mensagens</div>}
          {mensagens.map((m: any) => {
            const out = m.direction === "out";
            return (
              <div key={m.id} className={cn("flex", out ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[70%] rounded-lg px-3 py-2 text-xs", out ? "bg-primary text-primary-foreground" : "bg-card border")}>
                  {!out && m.autor_nome && <div className="text-[10px] opacity-70 mb-0.5">{m.autor_nome}</div>}
                  <MessageBody conteudo={m.conteudo} tipo={m.tipo} />
                  <div className={cn("text-[10px] mt-1", out ? "opacity-80" : "text-muted-foreground")}>{relativeTime(m.criada_em)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      <div className="border-t bg-card p-3">
        {readonly ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
            <Lock className="h-3.5 w-3.5" />
            Modo leitura — envio de mensagens segue pelo bot externo. Ative o envio nas Configurações do bot quando a fase 2 for liberada.
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input placeholder="Digite uma mensagem…" className="h-9 text-xs" disabled />
            <Button size="sm" className="h-9 gap-1" disabled><Send className="h-3.5 w-3.5" /> Enviar</Button>
          </div>
        )}
      </div>
    </div>
  );
}
