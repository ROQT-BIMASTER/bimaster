import { Inbox, Star, Send, FileEdit, CheckCircle2, XCircle, Trash2, Pencil, ShoppingBag, Eye, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MailboxFolder, MailboxCounts } from "@/hooks/useChinaMailbox";
import { useChinaUserContext } from "@/hooks/useChinaUserContext";

interface Props {
  folder: MailboxFolder;
  counts: MailboxCounts;
  onSelect: (f: MailboxFolder) => void;
  onCompose?: () => void;
  /** Força layout de central de comando da China, ignorando o contexto de usuário. */
  forceChinaLayout?: boolean;
}

interface FolderDef {
  key: MailboxFolder;
  label: string;
  labelCn: string;
  icon: typeof Inbox;
  countKey: keyof MailboxCounts;
  unreadKey?: keyof MailboxCounts;
  tone?: string;
}

interface FolderGroup {
  title?: string;
  folders: FolderDef[];
}

// Sidebar do usuário Brasil — mantém semântica original (caixa = pendentes p/ aprovação)
const BRASIL_GROUPS: FolderGroup[] = [
  {
    folders: [
      { key: "oc", label: "Ordens de Compra", labelCn: "采购单", icon: ShoppingBag, countKey: "inbox" },
      { key: "inbox", label: "Caixa de Entrada", labelCn: "收件箱", icon: Inbox, countKey: "inbox", unreadKey: "unread_inbox" },
      { key: "starred", label: "Marcados", labelCn: "已标记", icon: Star, countKey: "starred" },
      { key: "sent", label: "Enviados", labelCn: "已发送", icon: Send, countKey: "sent" },
      { key: "drafts", label: "Rascunhos", labelCn: "草稿", icon: FileEdit, countKey: "drafts" },
      { key: "approved", label: "Aprovados", labelCn: "已批准", icon: CheckCircle2, countKey: "approved", tone: "text-emerald-500" },
      { key: "rejected", label: "Rejeitados", labelCn: "已拒绝", icon: XCircle, countKey: "rejected", tone: "text-rose-500" },
      { key: "trash", label: "Lixeira", labelCn: "回收站", icon: Trash2, countKey: "trash" },
    ],
  },
];

// Sidebar do usuário China — central de comando estilo cliente de e-mail
const CHINA_GROUPS: FolderGroup[] = [
  {
    title: "Saída",
    folders: [
      { key: "awaiting_send", label: "Pendentes de envio", labelCn: "待发送", icon: FileEdit, countKey: "awaiting_send", tone: "text-muted-foreground" },
      { key: "sent_brazil", label: "Enviadas ao Brasil", labelCn: "已发送至巴西", icon: Send, countKey: "sent_brazil", tone: "text-primary" },
    ],
  },
  {
    title: "Acompanhamento",
    folders: [
      { key: "in_analysis", label: "Em análise no Brasil", labelCn: "巴西分析中", icon: Eye, countKey: "in_analysis", tone: "text-amber-500" },
      { key: "returned", label: "Retorno: ajustes", labelCn: "返回：需调整", icon: RotateCcw, countKey: "returned", tone: "text-rose-500" },
      { key: "approved", label: "Aprovadas", labelCn: "已批准", icon: CheckCircle2, countKey: "approved", tone: "text-emerald-500" },
    ],
  },
  {
    title: "Outros",
    folders: [
      { key: "starred", label: "Marcadas", labelCn: "已标记", icon: Star, countKey: "starred" },
      { key: "oc", label: "Ordens de Compra", labelCn: "采购单", icon: ShoppingBag, countKey: "inbox" },
      { key: "trash", label: "Lixeira", labelCn: "回收站", icon: Trash2, countKey: "trash" },
    ],
  },
];

export function MailboxSidebar({ folder, counts, onSelect, onCompose, forceChinaLayout }: Props) {
  const { isChinaUser } = useChinaUserContext();
  const useChina = forceChinaLayout || isChinaUser;
  const groups = useChina ? CHINA_GROUPS : BRASIL_GROUPS;

  return (
    <aside className="flex h-full flex-col border-r border-border bg-card/40">
      <div className="p-3">
        <Button
          className="w-full justify-start gap-2"
          size="sm"
          onClick={onCompose}
          disabled={!onCompose}
        >
          <Pencil className="h-4 w-4" />
          Nova submissão / 新提交
        </Button>
      </div>
      <nav className="flex-1 overflow-y-auto px-1.5 pb-3">
        {groups.map((group, gi) => (
          <div key={gi} className={cn(gi > 0 && "mt-3 border-t border-border/50 pt-2")}>
            {group.title && (
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                {group.title}
              </p>
            )}
            {group.folders.map((f) => {
              const Icon = f.icon;
              const active = folder === f.key;
              const total = counts[f.countKey];
              const unread = f.unreadKey ? counts[f.unreadKey] : 0;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => onSelect(f.key)}
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-primary/15 text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", f.tone, active && "text-primary")} />
                  <span className="truncate flex-1 text-left">
                    {f.label}
                    <span className="ml-1 text-[10px] text-muted-foreground/70">{f.labelCn}</span>
                  </span>
                  {unread > 0 ? (
                    <Badge className="h-4 px-1.5 text-[10px] bg-primary text-primary-foreground">
                      {unread}
                    </Badge>
                  ) : total > 0 ? (
                    <span className="text-[11px] text-muted-foreground tabular-nums">{total}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-border/60 p-3 text-[10px] leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground/80">Atalhos</p>
        {isChinaUser ? (
          <>
            <p>g p — Pendentes · g e — Enviadas</p>
            <p>g a — Em análise · g r — Retorno</p>
            <p>g v — Aprovadas · b — Enviar ao Brasil</p>
            <p>j / k — Navegar · / — Buscar · s — Estrela</p>
          </>
        ) : (
          <>
            <p>g i — Caixa de Entrada</p>
            <p>g s — Enviados · g d — Rascunhos</p>
            <p>j / k — Navegar · / — Buscar</p>
            <p>e — Aprovar · s — Estrela</p>
          </>
        )}
      </div>
    </aside>
  );
}
