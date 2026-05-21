import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageCircle, Check, RotateCcw, Sparkles, Trash2, Pencil, X, Send, Reply, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { BriefingComentario, ReworkResult } from "@/hooks/useBriefingComentarios";
import { resolveMentionsFromText, type MentionableMember } from "@/lib/briefings/resolveMentions";

interface Props {
  briefingId: string;
  campoKey: string;
  campoLabel: string;
  comentarios: BriefingComentario[];
  authors: Record<string, { nome: string | null; avatar: string | null }>;
  currentUserId: string | null;
  readOnly?: boolean;
  /** Se definido, abre a popover automaticamente uma vez (deep-link). */
  defaultOpen?: boolean;
  /** Se definido, destaca visualmente o comentário com este id. */
  highlightCommentId?: string | null;
  onAdd: (p: { campo_key: string; body: string; parent_id?: string | null }) => Promise<void>;
  onUpdate: (id: string, body: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onToggleResolved: (c: BriefingComentario) => Promise<void>;
  onRework: (p: { campo_key: string; comment_ids: string[]; mode: "apply" | "propose" }) => Promise<ReworkResult | null>;
  onReworkApplied: (r: ReworkResult) => void;
}

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("");
}

export function BriefingFieldComments({
  briefingId, campoKey, campoLabel,
  comentarios, authors, currentUserId, readOnly,
  defaultOpen, highlightCommentId,
  onAdd, onUpdate, onRemove, onToggleResolved, onRework, onReworkApplied,
}: Props) {
  void briefingId;
  const [open, setOpen] = useState(!!defaultOpen);
  const [showResolved, setShowResolved] = useState(false);
  const [newBody, setNewBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);

  const abertos = comentarios.filter((c) => !c.resolved);
  const totalCount = comentarios.length;
  const abertosCount = abertos.length;

  const roots = useMemo(
    () => comentarios
      .filter((c) => !c.parent_id && (showResolved || !c.resolved))
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [comentarios, showResolved],
  );

  const repliesOf = (id: string) =>
    comentarios
      .filter((c) => c.parent_id === id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const submitNew = async () => {
    const t = newBody.trim();
    if (!t) return;
    await onAdd({ campo_key: campoKey, body: t });
    setNewBody("");
  };

  const submitReply = async (parentId: string) => {
    const t = replyBody.trim();
    if (!t) return;
    await onAdd({ campo_key: campoKey, body: t, parent_id: parentId });
    setReplyBody(""); setReplyTo(null);
  };

  const submitEdit = async () => {
    if (!editingId) return;
    const t = editBody.trim();
    if (!t) { setEditingId(null); return; }
    await onUpdate(editingId, t);
    setEditingId(null); setEditBody("");
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const runRework = async (mode: "apply" | "propose") => {
    if (selected.size === 0) return;
    setWorking(true);
    const r = await onRework({ campo_key: campoKey, comment_ids: Array.from(selected), mode });
    setWorking(false);
    if (!r) return;
    setSelected(new Set());
    if (mode === "apply" && r.novo_texto !== undefined) {
      onReworkApplied(r);
      toast.success("Campo atualizado pela IA");
    } else if (mode === "propose") {
      toast.success("Proposta enviada para o chat");
    }
  };

  const fmt = (s: string) =>
    format(new Date(s), "dd/MM HH:mm", { locale: ptBR });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 px-2 text-[11px] gap-1",
            abertosCount > 0
              ? "text-amber-600 hover:text-amber-700"
              : totalCount > 0
                ? "text-muted-foreground hover:text-foreground"
                : "opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground",
          )}
        >
          <MessageCircle className="h-3 w-3" />
          {totalCount > 0 ? (abertosCount > 0 ? `${abertosCount}` : `${totalCount}`) : "Comentar"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px] p-0" sideOffset={6}>
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
            Comentários · {campoLabel}
          </div>
          <Button
            variant="ghost" size="sm" className="h-6 px-2 text-[11px]"
            onClick={() => setShowResolved((v) => !v)}
          >
            {showResolved ? "Ocultar resolvidos" : `Mostrar resolvidos (${totalCount - abertosCount})`}
          </Button>
        </div>

        <div className="max-h-[360px] overflow-y-auto px-3 py-3 space-y-3">
          {roots.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              Nenhum comentário ainda. Adicione abaixo.
            </p>
          )}
          {roots.map((c) => {
            const author = authors[c.author_id];
            const isOwn = c.author_id === currentUserId;
            const replies = repliesOf(c.id);
            const isEditing = editingId === c.id;
            return (
              <div
                key={c.id}
                className={cn(
                  "rounded-md border border-border p-2 space-y-2",
                  c.resolved && "opacity-60",
                  c.ai_status === "applied" && "border-emerald-500/40 bg-emerald-500/5",
                  c.ai_status === "proposed" && "border-primary/40 bg-primary/5",
                  highlightCommentId === c.id && "ring-2 ring-amber-500/70",
                )}
              >
                <div className="flex items-start gap-2">
                  {!readOnly && !c.resolved && (
                    <Checkbox
                      className="mt-1"
                      checked={selected.has(c.id)}
                      onCheckedChange={() => toggleSelect(c.id)}
                      aria-label="Marcar para IA"
                    />
                  )}
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px]">
                      {initials(author?.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-medium truncate">
                        {author?.nome ?? "Usuário"}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <span>{fmt(c.created_at)}</span>
                        {c.ai_status === "applied" && (
                          <span className="text-emerald-600 ml-1">· IA aplicou</span>
                        )}
                        {c.ai_status === "proposed" && (
                          <span className="text-primary ml-1">· IA propôs</span>
                        )}
                      </div>
                    </div>
                    {isEditing ? (
                      <div className="mt-1 space-y-1">
                        <Textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          rows={2}
                          className="text-xs"
                        />
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                            onClick={() => { setEditingId(null); setEditBody(""); }}>
                            Cancelar
                          </Button>
                          <Button size="sm" className="h-6 px-2 text-[11px]" onClick={submitEdit}>
                            Salvar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs whitespace-pre-wrap mt-0.5">{c.body}</p>
                    )}
                    {!isEditing && (
                      <div className="flex items-center gap-1 mt-1">
                        {!readOnly && (
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                            onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>
                            <Reply className="h-3 w-3 mr-1" /> Responder
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                          onClick={() => onToggleResolved(c)}>
                          {c.resolved
                            ? (<><RotateCcw className="h-3 w-3 mr-1" /> Reabrir</>)
                            : (<><Check className="h-3 w-3 mr-1" /> Resolver</>)}
                        </Button>
                        {isOwn && (
                          <>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                              onClick={() => { setEditingId(c.id); setEditBody(c.body); }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-destructive"
                              onClick={() => onRemove(c.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {replies.length > 0 && (
                  <div className="pl-8 space-y-2 border-l border-border ml-2">
                    {replies.map((r) => {
                      const ra = authors[r.author_id];
                      const own = r.author_id === currentUserId;
                      const editingThis = editingId === r.id;
                      return (
                        <div key={r.id} className="pl-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className="text-[9px]">{initials(ra?.nome)}</AvatarFallback>
                              </Avatar>
                              <span className="text-[11px] font-medium">{ra?.nome ?? "Usuário"}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{fmt(r.created_at)}</span>
                          </div>
                          {editingThis ? (
                            <div className="mt-1 space-y-1">
                              <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={2} className="text-xs" />
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                                  onClick={() => { setEditingId(null); setEditBody(""); }}>Cancelar</Button>
                                <Button size="sm" className="h-6 px-2 text-[11px]" onClick={submitEdit}>Salvar</Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs whitespace-pre-wrap mt-0.5">{r.body}</p>
                          )}
                          {own && !editingThis && (
                            <div className="flex gap-1 mt-0.5">
                              <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]"
                                onClick={() => { setEditingId(r.id); setEditBody(r.body); }}>
                                <Pencil className="h-2.5 w-2.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px] text-destructive"
                                onClick={() => onRemove(r.id)}>
                                <Trash2 className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {replyTo === c.id && !readOnly && (
                  <div className="pl-8 space-y-1">
                    <Textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Responder…"
                      rows={2}
                      className="text-xs"
                    />
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                        onClick={() => { setReplyTo(null); setReplyBody(""); }}>
                        <X className="h-3 w-3 mr-1" /> Cancelar
                      </Button>
                      <Button size="sm" className="h-6 px-2 text-[11px]"
                        onClick={() => submitReply(c.id)}>
                        <Send className="h-3 w-3 mr-1" /> Enviar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!readOnly && (
          <div className="border-t border-border p-3 space-y-2">
            {selected.size > 0 && (
              <div className="flex items-center justify-between gap-2 rounded-md bg-primary/5 border border-primary/30 px-2 py-1.5">
                <div className="text-[11px] text-primary font-medium">
                  {selected.size} marcado(s) para IA
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                    onClick={() => setSelected(new Set())}
                  >Limpar</Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="h-7 px-2.5 text-[11px] gap-1" disabled={working}>
                        <Sparkles className="h-3 w-3" />
                        {working ? "Processando…" : "Retrabalhar com IA"}
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => runRework("apply")}>
                        Aplicar direto (com diff)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => runRework("propose")}>
                        Enviar como proposta no chat
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}
            <Textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Adicionar comentário…"
              rows={2}
              className="text-xs"
            />
            <div className="flex justify-end">
              <Button size="sm" className="h-7 px-3 text-[11px]" onClick={submitNew} disabled={!newBody.trim()}>
                <Send className="h-3 w-3 mr-1" /> Comentar
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
