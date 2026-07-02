import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, Send, X, Save, RotateCcw, AlertTriangle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePedidosCopilot, type PedidosCopilotScope } from "@/hooks/fornecedor/usePedidosCopilot";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  scope: PedidosCopilotScope;
}

const SUGESTOES = [
  "Quais pedidos estão atrasados agora?",
  "Novos pedidos hoje",
  "Top 10 clientes por faturamento no período",
  "Estatísticas comerciais do período",
  "Gerar relatório executivo do período",
];

export function PedidosCopilotDrawer({ open, onOpenChange, scope }: Props) {
  const { messages, loading, send, reset } = usePedidosCopilot(scope);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => textareaRef.current?.focus());
  }, [open]);

  const scopeLabel = useMemo(() => {
    if (!scope.date_from && !scope.date_to) return "Período: últimos 30d";
    return `Período: ${scope.date_from ?? "?"} → ${scope.date_to ?? "?"}`;
  }, [scope]);

  const handleSend = () => {
    const t = input.trim();
    if (!t) return;
    setInput("");
    void send(t);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const salvarUltimoRelatorio = async () => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (!last) {
      toast.error("Nenhuma resposta para salvar.");
      return;
    }
    const titulo = last.content.split("\n")[0].replace(/^#+\s*/, "").slice(0, 120) || "Relatório de pedidos";
    const { error } = await (supabase as any).from("pedidos_copilot_relatorios").insert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      titulo,
      filtros: scope,
      markdown: last.content,
      origem: "chat",
      salvo: true,
    });
    if (error) {
      toast.error(`Falha ao salvar: ${error.message}`);
      return;
    }
    toast.success("Relatório salvo.");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-pink-100 dark:bg-pink-900/40">
                <Sparkles className="h-4 w-4 text-pink-600 dark:text-pink-400" />
              </div>
              <div>
                <SheetTitle className="text-base">Copiloto de Pedidos</SheetTitle>
                <p className="text-xs text-muted-foreground">{scopeLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={reset} title="Nova conversa">
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sou especialista em pedidos, rastreamento de carga, faturamento e vendas.
                Uso o período em foco na tela por padrão.
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={loading}
                    className="text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-muted transition disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  "max-w-[92%] rounded-lg px-3 py-2 text-sm " +
                  (m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground")
                }
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{m.content}</div>
                )}
                {m.meta?.unverifiable_count ? (
                  <div className="mt-2 flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    {m.meta.unverifiable_count} valor(es) sem verificação foram ocultados
                  </div>
                ) : null}
                {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.sources.slice(0, 8).map((s, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] font-normal">
                        {s.label}
                      </Badge>
                    ))}
                    {m.sources.length > 8 && (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        +{m.sources.length - 8}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted text-muted-foreground rounded-lg px-3 py-2 text-sm italic">
                Analisando pedidos…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t p-3 space-y-2">
          {messages.some((m) => m.role === "assistant") && (
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={salvarUltimoRelatorio} className="gap-1 text-xs h-7">
                <Save className="h-3 w-3" />
                Salvar última resposta como relatório
              </Button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              disabled={loading}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={2}
              placeholder="Pergunte sobre pedidos, atrasos, faturamento…"
              className="resize-none min-h-[44px] text-sm"
            />
            <Button size="sm" onClick={handleSend} disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
