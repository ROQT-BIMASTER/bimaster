import { useState } from "react";
import { Inbox, Star, Send, FileEdit, CheckCircle2, XCircle, Trash2, Pencil, ShoppingBag, Eye, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
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
  /** Quando informado, exibe sub-linha "X submissões" usando essa chave como contagem de submissões. */
  subCountKey?: keyof MailboxCounts;
  tone?: string;
}

interface FolderGroup {
  /** Chave i18n em `inbox.sidebar.<groupKey>` (opcional). */
  titleKey?: string;
  /** Quando true, grupo inicia colapsado e exibe um cabeçalho clicável. */
  collapsible?: boolean;
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
// Para as pastas operacionais, exibimos a contagem de ITENS (documentos) como
// número principal e a contagem de SUBMISSÕES como sub-linha. Isso reflete a
// nova regra de classificação: itens novos do checklist (rascunho/sem doc/sem
// parecer) caem em "Pendentes de envio" mesmo quando a submissão pai já está
// em análise no Brasil — então contar só por submissão escondia volume real.
const CHINA_GROUPS: FolderGroup[] = [
  {
    titleKey: "grupoSaida",
    folders: [
      { key: "awaiting_send", i18nKey: "awaiting_send", icon: FileEdit, countKey: "awaiting_send_items", subCountKey: "awaiting_send", tone: "text-muted-foreground" },
      { key: "sent_brazil", i18nKey: "sent_brazil", icon: Send, countKey: "sent_brazil_items", subCountKey: "sent_brazil", tone: "text-primary" },
    ],
  },
  {
    titleKey: "grupoAcompanhamento",
    folders: [
      { key: "in_analysis", i18nKey: "in_analysis", icon: Eye, countKey: "in_analysis_items", subCountKey: "in_analysis", tone: "text-amber-500" },
      { key: "returned", i18nKey: "returned", icon: RotateCcw, countKey: "returned_items", subCountKey: "returned", tone: "text-rose-500" },
      { key: "approved", i18nKey: "approved", icon: CheckCircle2, countKey: "approved", tone: "text-emerald-500" },
    ],
  },
  {
    titleKey: "grupoOutros",
    collapsible: true,
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
  // Estado de colapso dos grupos colapsáveis (default = fechado).
  // Se a pasta atual pertence ao grupo, força aberto para evitar "perder" a seleção.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const isGroupOpen = (g: FolderGroup, gi: number) => {
    if (!g.collapsible) return true;
    if (g.folders.some((f) => f.key === folder)) return true;
    return collapsed[gi] === false; // default false → fechado
  };
  const toggleGroup = (gi: number) =>
    setCollapsed((prev) => ({ ...prev, [gi]: !(prev[gi] === false) ? false : true }));

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
        {groups.map((group, gi) => {
          const open = isGroupOpen(group, gi);
          return (
          <div key={gi} className={cn(gi > 0 && "mt-3 border-t border-border/50 pt-2")}>
            {group.titleKey && (
              group.collapsible ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(gi)}
                  className="flex w-full items-center gap-1 px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 hover:text-foreground"
                >
                  {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <span>{t(`inbox.sidebar.${group.titleKey}`)}</span>
                </button>
              ) : (
                <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                  {t(`inbox.sidebar.${group.titleKey}`)}
                </p>
              )
            )}
            {open && (
            {group.folders.map((f) => {
              const Icon = f.icon;
              const active = folder === f.key;
              const total = counts[f.countKey];
              const unread = f.unreadKey ? counts[f.unreadKey] : 0;
              const subCount = f.subCountKey ? counts[f.subCountKey] : 0;
              const showSub = !!f.subCountKey && total > 0 && subCount !== total;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => onSelect(f.key)}
                  className={cn(
                    "group flex w-full items-start gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-primary/15 text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  )}
                  title={
                    f.subCountKey
                      ? `${total} item${total === 1 ? "" : "s"} em ${subCount} submissã${subCount === 1 ? "o" : "es"}`
                      : undefined
                  }
                >
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", f.tone, active && "text-primary")} />
                  <span className="flex min-w-0 flex-1 flex-col text-left">
                    <span className="truncate">
                      {t(`inbox.sidebar.folders.${f.i18nKey}`)}
                    </span>
                    {showSub && (
                      <span className="truncate text-[9.5px] leading-tight text-muted-foreground/70">
                        em {subCount} submissã{subCount === 1 ? "o" : "es"}
                      </span>
                    )}
                  </span>
                  {unread > 0 ? (
                    <Badge className="mt-0.5 h-4 px-1.5 text-[10px] bg-primary text-primary-foreground">
                      {unread}
                    </Badge>
                  ) : total > 0 ? (
                    <span className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{total}</span>
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
