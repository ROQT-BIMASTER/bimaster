import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Boxes, Send, Loader2, Plus, History, Star, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useEstoqueCopilot,
  type EstoqueCopilotFiltros,
  type EstoqueCopilotKpisSnapshot,
} from "@/hooks/estoque/useEstoqueCopilot";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filtros: EstoqueCopilotFiltros;
  kpisSnapshot?: EstoqueCopilotKpisSnapshot;
}

const SUGESTOES: { label: string; prompt: string }[] = [
  { label: "Resumo executivo", prompt: "Faça um resumo executivo do estoque considerando os filtros que estou vendo agora: 5 linhas + 3 pontos de atenção." },
  { label: "Risco de ruptura", prompt: "Liste os 10 produtos com maior risco de ruptura (alta pendência em relação ao disponível) considerando os filtros atuais." },
  { label: "Excedente em CX", prompt: "Mostre os 10 produtos com maior excedente em caixas master (saldo em CX). Indique candidatos a transferência entre empresas (apenas recomendação)." },
  { label: "Disponível zerado", prompt: "Quais produtos têm Disponível = 0 mas Pendente > 0? Liste os 10 mais críticos." },
  { label: "Concentração de bloqueado", prompt: "Onde está concentrado o saldo bloqueado? Quebre por empresa e por linha." },
  { label: "Divergência ERP", prompt: "Mostre as 10 maiores divergências entre o saldo interno calculado e o ERP. Explique o que cada drift significa." },
  { label: "Como leio essa tela?", prompt: "Explique de forma didática como leio essa tela: o que são CX, BX, UN, total em UN, equivalente em CX, disponível, bloqueado e pendente." },
];

function FiltrosBadge({ filtros }: { filtros: EstoqueCopilotFiltros }) {
  const parts: string[] = [];
  if (filtros.empresaIds.length) parts.push(`${filtros.empresaIds.length} empresa(s)`);
  else parts.push("todas empresas");
  parts.push(filtros.modo.toUpperCase());
  if (filtros.marcas.length) parts.push(`marca: ${filtros.marcas.length}`);
  if (filtros.linhas.length) parts.push(`linha: ${filtros.linhas.length}`);
  if (filtros.busca) parts.push(`busca: "${filtros.busca}"`);
  if (filtros.consolidar) parts.push("consolidado");
  return (
    <Badge variant="secondary" className="text-[10px] font-normal">
      {parts.join(" · ")}
    </Badge>
  );
}

export function EstoqueCopilotPanel({ open, onOpenChange, filtros, kpisSnapshot }: Props) {
  const {
    threads, activeThreadId, messages, loading, sending,
    sendMessage, loadThread, newThread, deleteThread, toggleSalvo, reloadThreads,
  } = useEstoqueCopilot({ filtros, kpisSnapshot, enabled: open });

  const [input, setInput] = useState("");
  const [histOpen, setHistOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => textareaRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [open, activeThreadId]);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const handleSend = async (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || sending) return;
    setInput("");
    await sendMessage(value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[520px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b space-y-2">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Boxes className="h-4 w-4 text-primary" />
              Copiloto de Estoque
            </SheetTitle>
            <div className="flex items-center gap-1">
              <Popover open={histOpen} onOpenChange={(v) => { setHistOpen(v); if (v) reloadThreads(); }}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                    <History className="h-3.5 w-3.5" />
                    Histórico
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[340px] p-0">
                  <div className="px-3 py-2 text-xs font-medium border-b flex items-center justify-between">
                    Conversas recentes
                    <span className="text-[10px] text-muted-foreground">retenção 30 dias</span>
                  </div>
                  <ScrollArea className="max-h-[360px]">
                    {threads.length === 0 ? (
                      <div className="px-3 py-6 text-xs text-muted-foreground text-center">
                        Nenhuma conversa ainda.
                      </div>
                    ) : (
                      <div className="py-1">
                        {threads.map((t) => (
                          <div
                            key={t.id}
                            className={cn(
                              "px-3 py-1.5 hover:bg-accent/60 flex items-center gap-2 text-xs cursor-pointer",
                              activeThreadId === t.id && "bg-accent/40",
                            )}
                            onClick={() => { loadThread(t.id); setHistOpen(false); }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="truncate font-medium">{t.titulo}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true, locale: ptBR })}
                              </div>
                            </div>
                            <button
                              className="p-1 hover:text-amber-500"
                              title={t.salvo ? "Remover dos salvos" : "Salvar (sem expirar)"}
                              onClick={(e) => { e.stopPropagation(); toggleSalvo(t.id, !t.salvo); }}
                            >
                              <Star className={cn("h-3.5 w-3.5", t.salvo && "fill-amber-400 text-amber-500")} />
                            </button>
                            <button
                              className="p-1 hover:text-destructive"
                              title="Excluir"
                              onClick={(e) => { e.stopPropagation(); if (confirm("Excluir esta conversa?")) deleteThread(t.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={newThread}>
                <Plus className="h-3.5 w-3.5" />
                Nova
              </Button>
            </div>
          </div>
          <SheetDescription className="text-xs flex items-center gap-2 flex-wrap">
            Especialista em estoque multi-empresa. Read-only.
            <FiltrosBadge filtros={filtros} />
          </SheetDescription>
        </SheetHeader>

        <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {messages.length === 0 && !loading ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Posso analisar saldos, indicar excedente, risco de ruptura, divergência ERP, composição de caixas
                e comparar empresas. Sempre respeito os filtros que você ativou na tela.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUGESTOES.map((s) => (
                  <Button
                    key={s.label}
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => handleSend(s.prompt)}
                    disabled={sending}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {loading && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Carregando conversa...
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "rounded-lg px-3 py-2 text-sm max-w-[88%] break-words",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-foreground",
                )}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-table:text-xs prose-headings:font-semibold prose-headings:text-foreground prose-p:my-1.5 prose-li:my-0.5">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{m.content}</div>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="rounded-lg px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Analisando o estoque...
              </div>
            </div>
          )}
        </div>

        <div className="border-t p-3 space-y-2">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Pergunte sobre o estoque... (Enter para enviar, Shift+Enter para quebra de linha)"
              className="resize-none min-h-[64px] pr-12 text-sm"
              disabled={sending}
            />
            <Button
              size="icon"
              className="absolute right-2 bottom-2 h-8 w-8"
              onClick={() => handleSend()}
              disabled={sending || !input.trim()}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <div className="text-[10px] text-muted-foreground text-center">
            Respostas geradas por IA. Confira números críticos antes de tomar decisão.
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
