import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CadastroKpiStrip } from "./CadastroKpiStrip";
import { CadastroListPanel } from "./CadastroListPanel";
import { CadastroDetailPanel } from "./CadastroDetailPanel";
import type { CadastroShellProps } from "./types";

export function CadastroShell<T>({
  title,
  subtitle,
  icon: Icon,
  primaryAction,
  secondaryActions,
  banner,
  kpis,
  items,
  getId,
  isLoading,
  columns,
  detail,
  search,
  filters,
  batchActions,
  emptyMessage,
  breadcrumb,
}: CadastroShellProps<T>) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedItem = useMemo(
    () => items.find((i) => getId(i) === selectedId) ?? null,
    [items, getId, selectedId],
  );

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const allIds = items.map(getId);
      const allSelected = allIds.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(allIds);
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] bg-background">
      {breadcrumb && <div className="px-6 pt-4 shrink-0">{breadcrumb}</div>}

      {/* Header */}
      <header className="px-6 py-4 flex items-start justify-between gap-4 border-b border-border/60 shrink-0 bg-background">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground leading-tight truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {secondaryActions?.map((a) => {
            const AIcon = a.icon;
            return (
              <Button key={a.label} variant="outline" size="sm" onClick={a.onClick} className="gap-2">
                {AIcon && <AIcon className="h-4 w-4" />}
                <span className="hidden sm:inline">{a.label}</span>
              </Button>
            );
          })}
          {primaryAction && (
            <Button size="sm" onClick={primaryAction.onClick} className="gap-2">
              {primaryAction.icon ? <primaryAction.icon className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {primaryAction.label}
            </Button>
          )}
        </div>
      </header>

      {banner && <div className="px-6 pt-4 shrink-0">{banner}</div>}

      <CadastroKpiStrip kpis={kpis} />

      {/* Split view */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <CadastroListPanel
          items={items}
          getId={getId}
          isLoading={isLoading}
          columns={columns}
          search={search}
          filters={filters}
          batchActions={batchActions}
          selectedId={selectedId}
          onSelect={setSelectedId}
          selectedIds={selectedIds}
          onToggle={toggle}
          onToggleAll={toggleAll}
          emptyMessage={emptyMessage}
        />
        <CadastroDetailPanel
          item={selectedItem}
          getTitle={detail.getTitle}
          getSubtitle={detail.getSubtitle}
          getAvatar={detail.getAvatar}
          getBadges={detail.getBadges}
          tabs={detail.tabs}
          footerActions={detail.footerActions}
        />
      </div>
    </div>
  );
}
