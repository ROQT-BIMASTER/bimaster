import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Search, Inbox, X } from "lucide-react";
import { PaymentChatPanel } from "./PaymentChatPanel";
import { useAllPaymentConversations, type PaymentConversation } from "@/hooks/usePaymentMessages";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatRelativeTime } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

const SOURCE_LABELS: Record<string, string> = {
  trade: "Trade",
  eventos: "Eventos",
  departamentos: "Departamentos",
};

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

export function PaymentChatConsolidado() {
  const { data: conversas = [], isLoading } = useAllPaymentConversations();
  const [busca, setBusca] = useState("");
  const [selected, setSelected] = useState<PaymentConversation | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  }, []);

  // Mark messages as read when opening a conversation
  useEffect(() => {
    if (!selected || !userId) return;
    const markRead = async () => {
      const { data: msgs } = await supabase
        .from("financial_payment_messages")
        .select("id, lida_por")
        .eq("payment_queue_id", selected.paymentQueueId);

      if (!msgs) return;
      for (const m of msgs as any[]) {
        const lidaPor = (m.lida_por as string[]) || [];
        if (!lidaPor.includes(userId)) {
          await supabase
            .from("financial_payment_messages")
            .update({ lida_por: [...lidaPor, userId] } as any)
            .eq("id", m.id);
        }
      }
    };
    markRead();
  }, [selected, userId]);

  const filtered = useMemo(() => {
    if (!busca) return conversas;
    const lower = busca.toLowerCase();
    return conversas.filter(c =>
      c.fornecedor.toLowerCase().includes(lower) ||
      c.descricao.toLowerCase().includes(lower) ||
      c.sourceType.toLowerCase().includes(lower)
    );
  }, [conversas, busca]);

  const totalUnread = conversas.reduce((sum, c) => sum + c.unread, 0);

  const renderList = () => (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b bg-card">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Conversas</span>
            {totalUnread > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5 min-w-[20px] justify-center">{totalUnread}</Badge>
            )}
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar fornecedor / descrição..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="text-[10px] text-muted-foreground mt-1 px-1">
          {filtered.length} conversa{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <ConversaListSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <MessageSquare className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Nenhuma conversa</p>
            <p className="text-xs text-muted-foreground/70">
              As conversas aparecerão quando houver comunicação sobre pagamentos.
            </p>
          </div>
        ) : (
          <div className="p-1">
            <AnimatePresence>
              {filtered.map((c) => {
                const isSelected = selected?.paymentQueueId === c.paymentQueueId;

                return (
                  <motion.div
                    key={c.paymentQueueId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <button
                      onClick={() => setSelected(c)}
                      className={`w-full text-left p-3 rounded-lg transition-all duration-150 flex gap-3 items-start mb-0.5
                        ${isSelected
                          ? "bg-primary/10 border border-primary/20"
                          : c.unread > 0
                            ? "bg-primary/5 hover:bg-primary/10"
                            : "hover:bg-muted/50"
                        }`}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="text-xs font-bold text-white bg-primary">
                            {getInitials(c.fornecedor)}
                          </AvatarFallback>
                        </Avatar>
                        {c.unread > 0 && (
                          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-destructive" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className={`text-sm truncate ${c.unread > 0 ? "font-bold" : "font-medium"}`}>
                            {c.fornecedor}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatRelativeTime(c.lastMessageDate)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 mb-1">
                          <Badge variant="outline" className="text-[9px] py-0 px-1 h-4">
                            {SOURCE_LABELS[c.sourceType] || c.sourceType}
                          </Badge>
                          <Badge
                            variant={
                              c.status === "pending" ? "warning" :
                              c.status === "approved" ? "success" :
                              c.status === "paid" ? "default" :
                              c.status === "rejected" ? "destructive" : "secondary"
                            }
                            className="text-[9px] py-0 px-1 h-4 capitalize"
                          >
                            {c.status}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between gap-1">
                          <p className={`text-xs truncate ${c.unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                            <span className="font-medium">{c.lastSender}:</span> {c.lastMessage}
                          </p>
                          {c.unread > 0 && (
                            <Badge variant="destructive" className="text-[10px] h-5 min-w-[20px] justify-center shrink-0 rounded-full">
                              {c.unread}
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

  const renderChat = () => {
    if (!selected) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center px-6">
          <div className="h-20 w-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
            <MessageSquare className="h-9 w-9 text-muted-foreground/30" />
          </div>
          <h3 className="text-lg font-semibold text-muted-foreground mb-1">Selecione uma conversa</h3>
          <p className="text-sm text-muted-foreground/70 max-w-xs">
            Escolha uma conversa na lista à esquerda para visualizar as mensagens.
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        <div className="border-b bg-card p-3">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setSelected(null)}>
                <X className="h-4 w-4" />
              </Button>
            )}
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="text-xs font-bold text-white bg-primary">
                {getInitials(selected.fornecedor)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm truncate">{selected.fornecedor}</span>
                <Badge variant="outline" className="text-[10px] py-0">
                  {SOURCE_LABELS[selected.sourceType] || selected.sourceType}
                </Badge>
              </div>
              {selected.descricao && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{selected.descricao}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <PaymentChatPanel
            paymentQueueId={selected.paymentQueueId}
            userType="financeiro"
            className="h-full border-0 rounded-none"
          />
        </div>
      </div>
    );
  };

  if (isMobile) {
    return selected ? (
      <div className="h-[calc(100vh-8rem)] bg-background rounded-lg border overflow-hidden">
        {renderChat()}
      </div>
    ) : (
      <div className="h-[calc(100vh-8rem)] bg-background rounded-lg border overflow-hidden">
        {renderList()}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-14rem)] rounded-xl border bg-background overflow-hidden shadow-sm">
      <div className="w-[340px] min-w-[280px] max-w-[400px] border-r flex flex-col bg-card/50">
        {renderList()}
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        {renderChat()}
      </div>
    </div>
  );
}
