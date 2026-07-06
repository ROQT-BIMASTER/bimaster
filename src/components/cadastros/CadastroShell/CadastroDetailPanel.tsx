import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";
import type { DetailFooterAction, TabDef } from "./types";

interface Props<T> {
  item: T | null;
  getTitle: (item: T) => React.ReactNode;
  getSubtitle?: (item: T) => React.ReactNode;
  getAvatar?: (item: T) => { initials: string; color?: string };
  getBadges?: (item: T) => React.ReactNode;
  tabs: TabDef<T>[];
  footerActions?: DetailFooterAction<T>[];
}

export function CadastroDetailPanel<T>({
  item,
  getTitle,
  getSubtitle,
  getAvatar,
  getBadges,
  tabs,
  footerActions,
}: Props<T>) {
  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.key ?? "");

  if (!item) {
    return (
      <div className="hidden lg:flex w-[420px] xl:w-[480px] shrink-0 bg-muted/30 flex-col items-center justify-center p-8 text-center">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-3">
          <Inbox className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Selecione um registro</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
          Clique em um item da lista para ver os detalhes e ações disponíveis.
        </p>
      </div>
    );
  }

  const avatar = getAvatar?.(item);
  const badges = getBadges?.(item);
  const active = tabs.find((t) => t.key === activeTab) ?? tabs[0];

  return (
    <div className="hidden lg:flex w-[420px] xl:w-[480px] shrink-0 bg-muted/30 flex-col">
      <div className="p-6 flex-1 overflow-y-auto">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          {avatar && (
            <div
              className={cn(
                "h-14 w-14 rounded-2xl flex items-center justify-center text-primary-foreground text-lg font-bold shadow-md shrink-0",
                avatar.color ?? "bg-primary",
              )}
            >
              {avatar.initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold text-foreground truncate">{getTitle(item)}</div>
            {getSubtitle && (
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                {getSubtitle(item)}
              </div>
            )}
          </div>
        </div>

        {badges && <div className="flex flex-wrap gap-1.5 mb-5">{badges}</div>}

        {/* Tabs */}
        {tabs.length > 1 && (
          <div className="flex border-b border-border/60 mb-4 -mx-1 overflow-x-auto">
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = t.key === active.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={cn(
                    "px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex items-center gap-1.5",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {t.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Tab content */}
        <div className="text-sm">{active?.render(item)}</div>
      </div>

      {/* Footer */}
      {footerActions && footerActions.length > 0 && (
        <div className="p-4 bg-background border-t border-border/60 flex items-center gap-2 shrink-0">
          {footerActions.map((a) => {
            const Icon = a.icon;
            return (
              <Button
                key={a.key}
                variant={a.variant ?? "default"}
                size="sm"
                onClick={() => a.onClick(item)}
                disabled={a.disabled}
                className="flex-1 gap-1.5"
              >
                {Icon && <Icon className="h-4 w-4" />}
                {a.label}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
