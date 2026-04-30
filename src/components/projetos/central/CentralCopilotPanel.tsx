import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sparkles, Send, Loader2, Plus, FileText, ListChecks,
  ShieldCheck, ArrowRight, Download, FileSpreadsheet, X, CheckCircle2,
  History, Star, Link2, Pin, LayoutDashboard,
} from "lucide-react";
import { useCentralCopilot, type CentralProposal, type CentralReport } from "@/hooks/useCentralCopilot";
import { ConfirmarAcaoDialog } from "../ConfirmarAcaoDialog";
import { VincularRelatorioCentralDialog } from "./VincularRelatorioCentralDialog";
import { downloadStorageBlob, triggerBlobDownload } from "@/lib/utils/storage-download";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CentralCopilotPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SUGESTOES = [
  { icon: LayoutDashboard, label: "Meu status hoje", prompt: "Faça um resumo executivo do meu trabalho hoje: tarefas pendentes para hoje, atrasadas, prioridades urgentes, e o que delegei e ainda não foi concluído." },
  { icon: ListChecks, label: "Minhas tarefas atrasadas", prompt: "Liste minhas tarefas atrasadas, agrupadas por projeto, com prioridade e prazo." },
  { icon: ListChecks, label: "Replanejar minha semana", prompt: "Analise minhas tarefas em aberto entre todos os projetos e proponha um replanejamento das próximas 2 semanas considerando prazos e prioridades." },
  { icon: ListChecks, label: "O que deleguei", prompt: "Mostre as tarefas que deleguei e ainda não foram concluídas, agrupadas por responsável, com tempo desde a delegação." },
  { icon: FileText, label: "PDF: meu status pessoal", prompt: "Gere um PDF com meu status pessoal multi-projeto: KPIs (totais, atrasadas, urgentes, concluídas no período), tarefas atrasadas com responsável e prazo, e próximos compromissos." },
  { icon: FileSpreadsheet, label: "XLSX: minhas tarefas por projeto", prompt: "Gere um XLSX com uma aba por projeto, listando minhas tarefas com status, prioridade e prazo." },
];

function StatusBadge({ status }: { status?: CentralProposal["status"] }) {
  if (status === "aplicada") return <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><CheckCircle2 className="size-3 mr-1" />Aplicada</Badge>;
  if (status === "descartada") return <Badge variant="outline" className="text-[10px]">Descartada</Badge>;
  if (status === "falhou") return <Badge variant="destructive" className="text-[10px]">Falhou</Badge>;
  return <Badge variant="outline" className="text-[10px]">Aguardando confirmação</Badge>;
}

function ProposalCard({ p, onApply, onDiscard }: {
  p: CentralProposal;
  onApply: (p: CentralProposal) => void;
  onDiscard: (id: string) => void;
}) {
  const locked = p.status && p.status !== "proposta";
  return (
    <div className="rounded-md border bg-background/60 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <ShieldCheck className="size-3.5 text-primary" />
          Ação proposta
        </div>
        <StatusBadge status={p.status} />
      </div>
      <div className="text-sm">{p.resumo}</div>
      {p.diff && p.diff.length > 0 && (
        <div className="space-y-0.5">
          {p.diff.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span className="text-muted-foreground">{d.campo}:</span>
              <span className="line-through text-muted-foreground">{String(d.de ?? "—")}</span>
              <ArrowRight className="size-3 text-muted-foreground" />
              <span className="font-medium">{String(d.para ?? "—")}</span>
            </div>
          ))}
        </div>
      )}
      {!locked && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onApply(p)}>
            <ShieldCheck className="size-3" /> Aplicar com senha
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => onDiscard(p.id)}>
            <X className="size-3" /> Descartar
          </Button>
        </div>
      )}
    </div>
  );
}

function ReportCard({ r, onSave, onLink, savedMap }: {
  r: CentralReport;
  onSave: (id: string, salvo: boolean) => Promise<boolean>;
  onLink: (r: CentralReport) => void;
  savedMap: Record<string, boolean>;
}) {
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const isSaved = savedMap[r.relatorio_id] ?? false;
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await downloadStorageBlob(r.signed_url, r.nome_arquivo);
      if (res.error || !res.blobUrl) { toast.error(res.error ?? "Falha ao baixar."); return; }
      triggerBlobDownload(res.blobUrl, res.filename || r.nome_arquivo);
    } finally {
      setDownloading(false);
    }
  };
  const handleToggleSave = async () => {
    setSaving(true);
    await onSave(r.relatorio_id, !isSaved);
    setSaving(false);
  };
  const Icon = r.formato === "pdf" ? FileText : FileSpreadsheet;
  return (
    <div className="rounded-md border bg-background/60 p-3 space-y-2">
      <div className="flex items-center gap-3">
        <Icon className="size-5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{r.nome_arquivo}</div>
          <div className="text-[11px] text-muted-foreground capitalize flex items-center gap-1.5">
            Relatório {r.tipo} · {r.formato.toUpperCase()}
            {isSaved && (
              <Badge variant="secondary" className="text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0 h-4">
                <Pin className="size-2.5 mr-0.5" /> Salvo
              </Badge>
            )}
          </div>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleDownload} disabled={downloading}>
          {downloading ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
          Baixar
        </Button>
      </div>
      <div className="flex gap-1.5">
        <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1 flex-1" onClick={handleToggleSave} disabled={saving}>
          {saving ? <Loader2 className="size-3 animate-spin" /> : <Star className={cn("size-3", isSaved && "fill-amber-400 text-amber-500")} />}
          {isSaved ? "Não expirar" : "Salvar"}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1 flex-1" onClick={() => onLink(r)}>
          <Link2 className="size-3" /> Vincular a tarefa
        </Button>
      </div>
    </div>
  );
}

interface ThreadItem { id: string; titulo: string; salvo: boolean; updated_at: string; expires_at: string }

export function CentralCopilotPanel({ open, onOpenChange }: CentralCopilotPanelProps) {
  const {
    messages, sending, send, newThread, applyProposal, discardProposal,
    loadThread, listThreads, setThreadSalvo, salvarRelatorio,
  } = useCentralCopilot();
  const [input, setInput] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeProposal, setActiveProposal] = useState<CentralProposal | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkRel, setLinkRel] = useState<CentralReport | null>(null);
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const refreshThreads = async () => {
    setLoadingThreads(true);
    const list = await listThreads();
    setThreads(list as ThreadItem[]);
    setLoadingThreads(false);
  };

  useEffect(() => { if (open && historyOpen) refreshThreads(); /* eslint-disable-next-line */ }, [open, historyOpen]);

  const handleSend = async (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || sending) return;
    setInput("");
    await send(value);
  };

  const openConfirm = (p: CentralProposal) => {
    setActiveProposal(p);
    setConfirmOpen(true);
  };

  const handleSaveReport = async (id: string, salvo: boolean) => {
    const ok = await salvarRelatorio(id, { salvo });
    if (ok) setSavedMap((m) => ({ ...m, [id]: salvo }));
    return ok;
  };

  const handleLinkReport = (r: CentralReport) => {
    setLinkRel(r);
    setLinkOpen(true);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
          <SheetHeader className="px-5 py-4 border-b">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="size-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <SheetTitle className="text-base">Copiloto da Central</SheetTitle>
                  <SheetDescription className="text-xs truncate">
                    Visão pessoal multi-projeto: tarefas, agenda, inbox e relatórios.
                  </SheetDescription>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 gap-1">
                      <History className="size-3.5" /> Conversas
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80 p-0">
                    <div className="px-3 py-2 border-b text-xs font-medium flex items-center justify-between">
                      <span>Conversas (30 dias)</span>
                      <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1" onClick={refreshThreads}>
                        <Loader2 className={cn("size-3", loadingThreads && "animate-spin")} />
                        Atualizar
                      </Button>
                    </div>
                    <ScrollArea className="max-h-80">
                      {threads.length === 0 && !loadingThreads && (
                        <div className="text-xs text-muted-foreground text-center py-6">Sem conversas anteriores.</div>
                      )}
                      <ul className="divide-y">
                        {threads.map((t) => {
                          const expiresIn = formatDistanceToNow(new Date(t.expires_at), { locale: ptBR, addSuffix: true });
                          return (
                            <li key={t.id} className="px-3 py-2 hover:bg-accent group flex items-center gap-2">
                              <button
                                onClick={() => { loadThread(t.id); setHistoryOpen(false); }}
                                className="text-left flex-1 min-w-0"
                              >
                                <div className="text-xs font-medium truncate">{t.titulo}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {t.salvo ? "Salva (não expira)" : `Expira ${expiresIn}`}
                                </div>
                              </button>
                              <Button
                                size="icon" variant="ghost" className="h-6 w-6"
                                onClick={async () => {
                                  const ok = await setThreadSalvo(t.id, !t.salvo);
                                  if (ok) refreshThreads();
                                }}
                                title={t.salvo ? "Remover salvo" : "Salvar conversa"}
                              >
                                <Star className={cn("size-3", t.salvo && "fill-amber-400 text-amber-500")} />
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                <Button variant="ghost" size="sm" onClick={newThread} className="h-8 gap-1">
                  <Plus className="size-3.5" /> Nova conversa
                </Button>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1" ref={scrollRef as any}>
            <div className="px-5 py-4 space-y-4">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Este copiloto vê apenas o seu trabalho — tarefas atribuídas a você, delegadas por você, sua inbox e sua agenda — entre todos os projetos a que tem acesso. Pode propor ações (com confirmação por senha) e gerar relatórios pessoais.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {SUGESTOES.map((s) => (
                      <button
                        key={s.label}
                        onClick={() => handleSend(s.prompt)}
                        className="text-left rounded-lg border p-3 hover:bg-accent transition-colors flex items-start gap-2"
                        disabled={sending}
                      >
                        <s.icon className="size-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <div className="text-sm font-medium">{s.label}</div>
                          <div className="text-xs text-muted-foreground line-clamp-2">{s.prompt}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "rounded-lg px-3 py-2 max-w-[90%] text-sm",
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}>
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown>{m.content || "_Sem resposta._"}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    )}

                    {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/50 flex flex-wrap gap-1">
                        {m.sources.slice(0, 8).map((s) => (
                          <Badge key={`${s.tipo}-${s.id}`} variant="secondary" className="text-[10px] font-normal">
                            {s.tipo}: {s.label.length > 30 ? s.label.slice(0, 30) + "…" : s.label}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {m.role === "assistant" && m.proposals && m.proposals.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {m.proposals.map((p) => (
                          <ProposalCard key={p.id} p={p} onApply={openConfirm} onDiscard={discardProposal} />
                        ))}
                      </div>
                    )}

                    {m.role === "assistant" && m.reports && m.reports.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {m.reports.map((r) => (
                          <ReportCard key={r.relatorio_id} r={r} onSave={handleSaveReport} onLink={handleLinkReport} savedMap={savedMap} />
                        ))}
                      </div>
                    )}

                    {m.role === "assistant" && m.model && (
                      <div className="mt-2 text-[10px] text-muted-foreground/70">
                        modelo: {m.model.includes("gpt-5.2") ? "GPT-5.2 (reasoning)" : m.model.includes("flash-lite") ? "Gemini Flash-Lite" : "Gemini Flash"}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-lg px-3 py-2 bg-muted text-sm flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" /> Pensando…
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <Separator />
          <div className="p-3 flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Pergunte sobre o seu trabalho, peça uma ação ou um relatório pessoal..."
              rows={2}
              className="resize-none"
              disabled={sending}
            />
            <Button onClick={() => handleSend()} disabled={sending || !input.trim()} size="icon" className="shrink-0">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
          <div className="px-3 pb-2 text-[10px] text-muted-foreground/80 text-center">
            Conversas e relatórios não salvos expiram em 30 dias. A IA aprende seu perfil para personalizar respostas. Atalho: Ctrl/Cmd + J.
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmarAcaoDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        proposal={activeProposal as any}
        onConfirm={async (pw) => {
          if (!activeProposal) return false;
          return await applyProposal(activeProposal.id, pw);
        }}
      />

      <VincularRelatorioCentralDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        onConfirm={async (projetoId, tarefaId) => {
          if (!linkRel) return false;
          const ok = await salvarRelatorio(linkRel.relatorio_id, { salvo: true, tarefa_id: tarefaId, projeto_id: projetoId });
          if (ok) setSavedMap((m) => ({ ...m, [linkRel.relatorio_id]: true }));
          return ok;
        }}
      />
    </>
  );
}
