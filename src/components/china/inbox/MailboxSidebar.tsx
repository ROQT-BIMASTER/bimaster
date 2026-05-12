import { Inbox, Star, Send, FileEdit, CheckCircle2, XCircle, Trash2, Pencil, ShoppingBag, Eye, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MailboxFolder, MailboxCounts } from "@/hooks/useChinaMailbox";
import { useChinaUserContext } from "@/hooks/useChinaUserContext";
import { useChinaI18n } from "@/hooks/useChinaI18n";

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
  /** Chave i18n em `inbox.sidebar.folders.<key>` */
  i18nKey: string;
  icon: typeof Inbox;
  countKey: keyof MailboxCounts;
  unreadKey?: keyof MailboxCounts;
  tone?: string;
}

interface FolderGroup {
  /** Chave i18n em `inbox.sidebar.<groupKey>` (opcional). */
  titleKey?: string;
  folders: FolderDef[];
}

// Sidebar do usuário Brasil — mantém semântica original (caixa = pendentes p/ aprovação)
const BRASIL_GROUPS: FolderGroup[] = [
  {
    folders: [
      { key: "oc", i18nKey: "oc", icon: ShoppingBag, countKey: "inbox" },
      { key: "inbox", i18nKey: "inbox", icon: Inbox, countKey: "inbox", unreadKey: "unread_inbox" },
      { key: "starred", i18nKey: "starred", icon: Star, countKey: "starred" },
      { key: "sent", i18nKey: "sent", icon: Send, countKey: "sent" },
      { key: "drafts", i18nKey: "drafts", icon: FileEdit, countKey: "drafts" },
      { key: "approved", i18nKey: "approved", icon: CheckCircle2, countKey: "approved", tone: "text-emerald-500" },
      { key: "rejected", i18nKey: "rejected", icon: XCircle, countKey: "rejected", tone: "text-rose-500" },
      { key: "trash", i18nKey: "trash", icon: Trash2, countKey: "trash" },
    ],
  },
];

// Sidebar do usuário China — central de comando estilo cliente de e-mail
const CHINA_GROUPS: FolderGroup[] = [
  {
    titleKey: "grupoSaida",
    folders: [
      { key: "awaiting_send", i18nKey: "awaiting_send", icon: FileEdit, countKey: "awaiting_send", tone: "text-muted-foreground" },
      { key: "sent_brazil", i18nKey: "sent_brazil", icon: Send, countKey: "sent_brazil", tone: "text-primary" },
    ],
  },
  {
    titleKey: "grupoAcompanhamento",
    folders: [
      { key: "in_analysis", i18nKey: "in_analysis", icon: Eye, countKey: "in_analysis", tone: "text-amber-500" },
      { key: "returned", i18nKey: "returned", icon: RotateCcw, countKey: "returned", tone: "text-rose-500" },
      { key: "approved", i18nKey: "approved", icon: CheckCircle2, countKey: "approved", tone: "text-emerald-500" },
    ],
  },
  {
    titleKey: "grupoOutros",
    folders: [
      { key: "starred", i18nKey: "starred", icon: Star, countKey: "starred" },
      { key: "oc", i18nKey: "oc", icon: ShoppingBag, countKey: "inbox" },
      { key: "trash", i18nKey: "trash", icon: Trash2, countKey: "trash" },
    ],
  },
];

export function MailboxSidebar({ folder, counts, onSelect, onCompose, forceChinaLayout }: Props) {
  const { isChinaUser } = useChinaUserContext();
  const { t } = useChinaI18n();
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
          {t("inbox.actions.novaSubmissao")}
        </Button>
      </div>
      <nav className="flex-1 overflow-y-auto px-1.5 pb-3">
        {groups.map((group, gi) => (
          <div key={gi} className={cn(gi > 0 && "mt-3 border-t border-border/50 pt-2")}>
            {group.titleKey && (
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                {t(`inbox.sidebar.${group.titleKey}`)}
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
                    {t(`inbox.sidebar.folders.${f.i18nKey}`)}
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
        <p className="font-medium text-foreground/80">{t("inbox.sidebar.atalhos")}</p>
        {useChina ? (
          <>
            <p>g p · g e · g a · g r · g v · b</p>
            <p>j / k · / · s</p>
          </>
        ) : (
          <>
            <p>g i · g s · g d · g a</p>
            <p>j / k · / · e · s</p>
          </>
        )}
      </div>
    </aside>
  );
}
