import { useMemo } from "react";
import { Star, Paperclip, Clock, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { MailboxItem, MailboxFolder } from "@/hooks/useChinaMailbox";

interface Props {
  items: MailboxItem[];
  folder: MailboxFolder;
  selectedId: string | null;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleCheck: (id: string) => void;
  onToggleAllChecks: () => void;
  onToggleStar: (item: MailboxItem) => void;
  search: string;
}

function statusBadge(item: MailboxItem) {
  // Status semelhante a "labels" do Gmail
  if (item.submissao_status === "aprovado") {
    return { label: "Aprovado", icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  }
  if (item.submissao_status === "rejeitado") {
    return { label: "Rejeitado", icon: AlertTriangle, cls: "bg-rose-500/15 text-rose-400 border-rose-500/30" };
  }
  if (item.doc_status === "rejeitado") {
    return { label: "Ajuste", icon: AlertTriangle, cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
  }
  if (item.submissao_status === "rascunho") {
    return { label: "Rascunho", icon: FileText, cls: "bg-muted/40 text-muted-foreground border-border" };
  }
  return { label: "Aguardando", icon: Clock, cls: "bg-primary/15 text-primary border-primary/30" };
}

function relativeAge(hours: number) {
  if (hours < 1) return "agora";
  if (hours < 24) return `${hours}h`;
  const d = Math.floor(hours / 24);
  return `${d}d`;
}

export function MailboxList({
  items,
  folder,
  selectedId,
  selectedIds,
  onSelect,
  onToggleCheck,
  onToggleAllChecks,
  onToggleStar,
  search,
}: Props) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => {
      const blob = `${i.produto_codigo} ${i.produto_nome} ${i.numero_ordem ?? ""} ${i.nome_arquivo ?? ""} ${i.tipo_documento ?? ""} ${i.observacoes_brasil ?? ""} ${i.observacoes_china ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [items, search]);

  const allChecked = filtered.length > 0 && filtered.every((i) => selectedIds.has(i.submissao_id));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-card/30 px-3 py-1.5">
        <Checkbox
          checked={allChecked}
          onCheckedChange={onToggleAllChecks}
          aria-label="Selecionar todos"
        />
        <span className="text-[11px] text-muted-foreground">
          {filtered.length} item{filtered.length === 1 ? "" : "s"} · {folder}
        </span>
      </div>
      <ul className="flex-1 overflow-y-auto" role="list">
        {filtered.length === 0 && (
          <li className="p-8 text-center text-sm text-muted-foreground">
            Nenhum item nesta pasta / 此文件夹中没有项目
          </li>
        )}
        {filtered.map((item) => {
          const id = item.documento_id ?? item.submissao_id;
          const checked = selectedIds.has(item.submissao_id);
          const active = selectedId === id;
          const sb = statusBadge(item);
          const SbIcon = sb.icon;
          const unread = !item.is_read && folder === "inbox";
          return (
            <li
              key={id}
              onClick={() => onSelect(id)}
              className={cn(
                "group flex cursor-pointer items-start gap-2 border-b border-border/40 px-3 py-2 text-sm transition-colors",
                active ? "bg-primary/10" : "hover:bg-muted/30",
                unread && "bg-card",
              )}
            >
              <div className="flex flex-col items-center pt-0.5">
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => onToggleCheck(item.submissao_id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Selecionar"
                />
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStar(item);
                }}
                className={cn(
                  "mt-0.5 transition-colors",
                  item.is_flagged ? "text-amber-400" : "text-muted-foreground/40 hover:text-amber-300",
                )}
                aria-label={item.is_flagged ? "Desmarcar estrela" : "Marcar com estrela"}
              >
                <Star className="h-3.5 w-3.5" fill={item.is_flagged ? "currentColor" : "none"} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "truncate text-[13px]",
                      unread ? "font-semibold text-foreground" : "font-medium text-foreground/90",
                    )}
                  >
                    {item.produto_codigo} — {item.produto_nome}
                  </span>
                  {item.numero_ordem && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {item.numero_ordem}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] text-muted-foreground">
                  {item.tipo_documento && (
                    <>
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {item.tipo_documento}
                        {item.nome_arquivo ? ` · ${item.nome_arquivo}` : ""}
                      </span>
                    </>
                  )}
                  {!item.tipo_documento && (
                    <span className="truncate italic">
                      {item.observacoes_china || item.observacoes_brasil || "Sem documentos"}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge
                  variant="outline"
                  className={cn("h-4 px-1.5 text-[9.5px] gap-0.5 font-medium", sb.cls)}
                >
                  <SbIcon className="h-2.5 w-2.5" />
                  {sb.label}
                </Badge>
                {item.snooze_until && (
                  <Badge variant="outline" className="h-4 px-1.5 text-[9.5px] gap-0.5 bg-amber-500/15 text-amber-400 border-amber-500/30">
                    <Clock className="h-2.5 w-2.5" /> adiada
                  </Badge>
                )}
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {relativeAge(item.horas_pendentes)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
