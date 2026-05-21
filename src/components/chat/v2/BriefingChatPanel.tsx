/**
 * BriefingChatPanel — painel central do Chat quando o usuário seleciona
 * um briefing. Mostra: cabeçalho com título/status/completude, abas
 * Resumo (campos preenchidos) e Atividade (comentários + mensagens IA),
 * e um input embaixo pra adicionar comentário geral no briefing.
 *
 * Edição de campos continua sendo feita no BriefingWorkspace; daqui só
 * leitura + comentários. Cada item clicável leva ao workspace já posicionado
 * no campo (?campo=...&comentario=...).
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, MessageSquare, Sparkles, Send, AtSign, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBriefingChat } from "@/hooks/useBriefingChat";
import { useBriefingComentarios, type BriefingComentario } from "@/hooks/useBriefingComentarios";
import { useBriefingMembros } from "@/hooks/useBriefingMembros";
import { marcarBriefingLido } from "@/hooks/chat/useBriefingsChat";
import { initials, formatRelativo } from "./utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { resolveMentionsFromText } from "@/lib/briefings/resolveMentions";

interface Props {
  briefingId: string;
}

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_andamento: "Em andamento",
  em_aprovacao: "Em aprovação",
  aprovado: "Aprovado",
  concluido: "Concluído",
};

const STATUS_TONE: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground border-border",
  em_andamento: "bg-briefing/10 text-briefing border-briefing/30",
  em_aprovacao: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  aprovado: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  concluido: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30",
};

export function BriefingChatPanel({ briefingId }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { briefing, sections, messages, loading } = useBriefingChat(briefingId);
  const coments = useBriefingComentarios(briefingId);
  const { membros } = useBriefingMembros(briefingId);
  const [tab, setTab] = useState<"resumo" | "comentarios" | "ia">("comentarios");
  const [filtroComent, setFiltroComent] = useState<"todos" | "abertos" | "mencionam">("todos");
  const [novoComentario, setNovoComentario] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Marca como lido ao abrir / mudar de briefing
  useEffect(() => {
    if (briefingId) {
      marcarBriefingLido(briefingId).catch(() => { /* silencioso */ });
    }
  }, [briefingId]);

  const goWorkspace = (params?: { campo?: string; comentario?: string }) => {
    const qs = new URLSearchParams();
    if (params?.campo) qs.set("campo", params.campo);
    if (params?.comentario) qs.set("comentario", params.comentario);
    const url = `/dashboard/briefings/${briefingId}${qs.toString() ? `?${qs.toString()}` : ""}`;
    navigate(url);
  };

  const camposPreenchidos = useMemo(() => {
    if (!briefing) return [] as { key: string; label: string; valor: string }[];
    return sections
      .filter((s) => ((briefing.payload as any)?.[s.key] ?? "").trim().length > 0)
      .map((s) => ({ key: s.key, label: s.label, valor: (briefing.payload as any)[s.key] }));
  }, [briefing, sections]);

  const labelByCampo = useMemo(() => {
    const m: Record<string, string> = {};
    sections.forEach((s) => { m[s.key] = s.label; });
    return m;
  }, [sections]);

  // Listas separadas: comentários humanos e mensagens da IA
  const comentariosFiltrados = useMemo(() => {
    const arr = [...coments.comentarios].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (filtroComent === "abertos") return arr.filter((c) => !c.resolved);
    if (filtroComent === "mencionam") {
      return arr.filter((c) => {
        const m = (c as any).mentions;
        return Array.isArray(m) && user?.id && m.includes(user.id);
      });
    }
    return arr;
  }, [coments.comentarios, filtroComent, user?.id]);

  const mensagensIa = useMemo(
    () =>
      messages
        .filter((m) => m.role === "assistant" || (m.proposals && m.proposals.length > 0))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [messages],
  );

  const abertos = coments.comentarios.filter((c) => !c.resolved).length;

  const enviarComentario = async () => {
    const t = novoComentario.trim();
    if (!t || !briefingId) return;
    setEnviando(true);
    try {
      const mentionMembers = (membros ?? []).map((m) => ({
        user_id: m.user_id,
        nome: m.profile?.nome ?? null,
      }));
      const mentions = resolveMentionsFromText(t, mentionMembers);
      await coments.add({ campo_key: "__geral__", body: t, mentions });
      setNovoComentario("");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível enviar o comentário");
    } finally {
      setEnviando(false);
    }
  };


  if (loading || !briefing) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Carregando briefing…
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-background">
      {/* Header sticky com identidade do módulo Briefing */}
      <header
        className="px-4 py-3.5 border-b border-briefing/15 flex items-start gap-3"
        style={{ backgroundImage: "var(--gradient-briefing)" }}
      >
        <div className="h-10 w-10 rounded-xl bg-briefing/15 ring-1 ring-briefing/25 flex items-center justify-center shrink-0">
          <FileText className="h-5 w-5 text-briefing" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold tracking-tight truncate">{briefing.titulo}</h2>
            <Badge
              variant="outline"
              className="text-[10px] uppercase bg-briefing/10 text-briefing border-briefing/30"
            >
              {briefing.tipo}
            </Badge>
            <Badge
              variant="outline"
              className={cn("text-[10px]", STATUS_TONE[briefing.status] ?? "")}
            >
              {STATUS_LABEL[briefing.status] ?? briefing.status}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex-1 max-w-[220px] h-1.5 rounded-full bg-background/60 overflow-hidden ring-1 ring-briefing/10">
              <div
                className="h-full transition-all rounded-full"
                style={{
                  width: `${briefing.completude}%`,
                  backgroundImage:
                    "linear-gradient(90deg, hsl(var(--briefing-accent)) 0%, hsl(var(--primary)) 100%)",
                }}
              />
            </div>
            <span className="text-[11px] text-briefing font-medium tabular-nums">
              {briefing.completude}% completo
            </span>
            {membros.length > 0 && (
              <div className="flex -space-x-2">
                {membros.slice(0, 4).map((m) => (
                  <Avatar key={m.id} className="h-6 w-6 ring-2 ring-card">
                    <AvatarFallback className="text-[10px] bg-briefing/15 text-briefing">
                      {initials(m.profile?.nome, null)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {membros.length > 4 && (
                  <div className="h-6 w-6 rounded-full bg-briefing/15 text-briefing text-[10px] flex items-center justify-center ring-2 ring-card">
                    +{membros.length - 4}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => goWorkspace()}
          className="gap-1.5 shrink-0 bg-card/80 border-briefing/30 text-briefing hover:bg-briefing/10 hover:text-briefing"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Abrir briefing
        </Button>
      </header>

      {/* Abas */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-2 border-b border-border bg-card shadow-[0_1px_0_0_hsl(var(--briefing-accent)/0.08)]">
          <TabsList className="h-9 bg-muted/40 p-1">
            <TabsTrigger
              value="resumo"
              className="text-xs gap-1.5 data-[state=active]:text-briefing data-[state=active]:shadow-sm"
            >
              <FileText className="h-3.5 w-3.5" /> Resumo
              {camposPreenchidos.length > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground tabular-nums">
                  {camposPreenchidos.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="comentarios"
              className="text-xs gap-1.5 data-[state=active]:text-briefing data-[state=active]:shadow-sm"
            >
              <MessageSquare className="h-3.5 w-3.5" /> Comentários
              {abertos > 0 && (
                <Badge className="ml-1 h-4 px-1 text-[10px] bg-briefing text-briefing-foreground hover:bg-briefing">
                  {abertos}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="ia"
              className="text-xs gap-1.5 data-[state=active]:text-briefing data-[state=active]:shadow-sm"
            >
              <Sparkles className="h-3.5 w-3.5" /> Atividade IA
              {mensagensIa.length > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground tabular-nums">
                  {mensagensIa.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="resumo" className="flex-1 min-h-0 m-0">
          <ScrollArea className="h-full">
            <div className="px-4 py-3 space-y-2">
              {camposPreenchidos.length === 0 && (
                <EmptyState
                  icon={<FileText className="h-8 w-8" />}
                  title="Nenhum campo preenchido ainda"
                  hint="Abra o briefing para começar a preencher."
                />
              )}
              {camposPreenchidos.map((c) => (
                <button
                  key={c.key}
                  onClick={() => goWorkspace({ campo: c.key })}
                  className="w-full text-left rounded-lg border border-border border-l-2 border-l-briefing/40 bg-card hover:bg-briefing-soft/40 hover:border-l-briefing transition-colors p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-briefing">
                      {c.label}
                    </span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <p className="text-sm mt-1 line-clamp-3 whitespace-pre-wrap">{c.valor}</p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="comentarios" className="flex-1 min-h-0 m-0">
          <div className="px-4 pt-2 pb-1 flex items-center gap-1">
            {(
              [
                { v: "todos", l: "Todos" },
                { v: "abertos", l: "Não resolvidos" },
                { v: "mencionam", l: "Me marcaram" },
              ] as const
            ).map((f) => (
              <button
                key={f.v}
                onClick={() => setFiltroComent(f.v)}
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-full border transition-colors",
                  filtroComent === f.v
                    ? "bg-briefing/10 text-briefing border-briefing/30"
                    : "bg-transparent text-muted-foreground border-border hover:bg-muted/60",
                )}
              >
                {f.l}
              </button>
            ))}
          </div>
          <ScrollArea className="h-[calc(100%-2rem)]">
            <div className="px-4 py-2 space-y-2">
              {comentariosFiltrados.length === 0 && (
                <EmptyState
                  icon={<MessageSquare className="h-8 w-8" />}
                  title="Nenhum comentário ainda"
                  hint="Use o composer abaixo, ou abra um campo no briefing e marque alguém com @."
                />
              )}
              {comentariosFiltrados.map((c) => (
                <ComentarioCard
                  key={c.id}
                  c={c}
                  authorNome={coments.authors[(c as any).author_id]?.nome ?? null}
                  campoLabel={labelByCampo[c.campo_key] ?? c.campo_key}
                  isMe={(c as any).author_id === user?.id}
                  mencionaMe={
                    Array.isArray((c as any).mentions) &&
                    !!user?.id &&
                    (c as any).mentions.includes(user.id)
                  }
                  onOpen={() =>
                    goWorkspace({
                      campo: c.campo_key === "__geral__" ? undefined : c.campo_key,
                      comentario: c.id,
                    })
                  }
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="ia" className="flex-1 min-h-0 m-0">
          <ScrollArea className="h-full">
            <div className="px-4 py-3 space-y-2">
              {mensagensIa.length === 0 && (
                <EmptyState
                  icon={<Sparkles className="h-8 w-8" />}
                  title="Sem mensagens da IA"
                  hint="Quando o assistente sugerir conteúdo no briefing, aparece aqui."
                />
              )}
              {mensagensIa.map((m) => (
                <MensagemIaCard key={m.id} m={m} onOpen={() => goWorkspace()} />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>


      {/* Composer comentário geral */}
      <div className="border-t border-border bg-card p-3">
        <div className="rounded-xl border border-border bg-background focus-within:border-briefing/50 focus-within:ring-2 focus-within:ring-briefing/15 transition-colors p-2">
          <Textarea
            value={novoComentario}
            onChange={(e) => setNovoComentario(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviarComentario();
              }
            }}
            placeholder="Comentário geral sobre o briefing… use @ para marcar alguém no workspace"
            rows={2}
            className="resize-none border-0 focus-visible:ring-0 shadow-none px-1.5 py-1 min-h-0 text-sm"
          />
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground px-1.5 flex items-center gap-1">
              <AtSign className="h-3 w-3" /> Para mencionar com @, use o painel do campo
            </span>
            <Button
              size="sm"
              disabled={enviando || !novoComentario.trim()}
              onClick={enviarComentario}
              className="gap-1.5 bg-briefing text-briefing-foreground hover:bg-briefing/90"
            >
              <Send className="h-3.5 w-3.5" /> Enviar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6 gap-2">
      <div className="text-briefing/40">{icon}</div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="text-xs text-muted-foreground max-w-[280px]">{hint}</p>}
    </div>
  );
}

function ComentarioCard({
  c, authorNome, campoLabel, isMe, mencionaMe, onOpen,
}: {
  c: BriefingComentario;
  authorNome: string | null;
  campoLabel: string;
  isMe: boolean;
  mencionaMe: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className={cn(
        "w-full text-left rounded-lg border bg-card hover:bg-briefing-soft/30 transition-colors p-3 space-y-1.5 shadow-sm",
        "border-l-2 border-l-briefing/30",
        c.resolved && "opacity-60",
        mencionaMe && "border-l-amber-500 bg-amber-500/[0.04]",
      )}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Avatar className={cn("h-5 w-5", mencionaMe && "ring-2 ring-amber-500/40")}>
          <AvatarFallback className="text-[9px] bg-briefing/15 text-briefing">
            {initials(authorNome)}
          </AvatarFallback>
        </Avatar>
        <span className="text-[12px] font-medium truncate">
          {isMe ? "Você" : authorNome ?? "Usuário"}
        </span>
        <Badge variant="outline" className="text-[9px] px-1 py-0 bg-briefing/5 text-briefing border-briefing/20">
          {c.campo_key === "__geral__" ? "Geral" : campoLabel}
        </Badge>
        {mencionaMe && (
          <Badge className="text-[9px] px-1 py-0 bg-amber-500 hover:bg-amber-500 text-white">@ você</Badge>
        )}
        {c.resolved && (
          <Badge variant="outline" className="text-[9px] px-1 py-0">resolvido</Badge>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {formatRelativo(c.created_at)}
        </span>
      </div>
      <p className="text-[13px] whitespace-pre-wrap line-clamp-3">{c.body}</p>
    </button>
  );
}

function MensagemIaCard({ m, onOpen }: { m: any; onOpen: () => void }) {
  const isProposal = Array.isArray(m.proposals) && m.proposals.length > 0;
  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors p-3 space-y-1.5"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-[12px] font-medium">IA</span>
        {isProposal && (
          <Badge variant="secondary" className="text-[9px] px-1 py-0">proposta</Badge>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {format(new Date(m.created_at), "dd MMM HH:mm", { locale: ptBR })}
        </span>
      </div>
      <p className="text-[13px] whitespace-pre-wrap line-clamp-3">{m.content}</p>
    </button>
  );
}
