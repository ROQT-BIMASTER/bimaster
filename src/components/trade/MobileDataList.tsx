import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: keyof T | string;
  label: string;
  className?: string;
  hideOnMobile?: boolean;
  render?: (item: T) => React.ReactNode;
}

interface MobileDataListProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  keyExtractor: (item: T) => string;
  renderMobileCard?: (item: T, isSelected?: boolean) => React.ReactNode;
  primaryField: keyof T;
  secondaryField?: keyof T;
  statusField?: keyof T;
  statusConfig?: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }>;
  actions?: (item: T) => React.ReactNode;
  accentColor?: string;
  // Selection support
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
}

export function MobileDataList<T>({
  data,
  columns,
  loading,
  emptyMessage = "Nenhum item encontrado",
  onRowClick,
  keyExtractor,
  renderMobileCard,
  primaryField,
  secondaryField,
  statusField,
  statusConfig,
  actions,
  accentColor = "border-l-primary",
  selectable = false,
  selectedIds,
  onSelectionChange,
}: MobileDataListProps<T>) {
  const allSelected = selectable && data.length > 0 && selectedIds?.size === data.length;
  const someSelected = selectable && (selectedIds?.size ?? 0) > 0 && !allSelected;

  const toggleItem = (id: string) => {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  };

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(data.map(keyExtractor)));
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          {emptyMessage}
        </CardContent>
      </Card>
    );
  }

  // Desktop: Table view
  const desktopColumns = columns.filter((col) => !col.hideOnMobile || window.innerWidth >= 768);

  return (
    <>
      {/* Mobile View - Cards */}
      <div className="md:hidden space-y-2">
        {data.map((item) => {
          const id = keyExtractor(item);
          const isSelected = selectedIds?.has(id) ?? false;

          return (
            <div key={id} className="flex items-start gap-2">
              {selectable && (
                <div className="pt-3 pl-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleItem(id)}
                  />
                </div>
              )}
              <div className="flex-1" onClick={() => onRowClick?.(item)}>
                {renderMobileCard
                  ? renderMobileCard(item, isSelected)
                  : (
                    <Card
                      className={cn(
                        "border-l-4 active:scale-[0.99] transition-all touch-manipulation",
                        accentColor,
                        isSelected && "ring-2 ring-primary/50 bg-primary/5",
                        onRowClick && "cursor-pointer"
                      )}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{String(item[primaryField] || "")}</p>
                            {secondaryField && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {String(item[secondaryField] || "")}
                              </p>
                            )}
                            {statusField && statusConfig?.[String(item[statusField] || "")] && (
                              <Badge
                                variant={statusConfig[String(item[statusField] || "")].variant}
                                className="mt-1.5 text-[10px] h-5"
                              >
                                {statusConfig[String(item[statusField] || "")].label}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {actions?.(item)}
                            {onRowClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop View - Table */}
      <div className="hidden md:block rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                {selectable && (
                  <th className="px-3 py-3 w-10">
                    <Checkbox
                      checked={allSelected}
                      // @ts-ignore
                      indeterminate={someSelected}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                )}
                {desktopColumns.map((col) => (
                  <th
                    key={String(col.key)}
                    className={cn(
                      "px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider",
                      col.className
                    )}
                  >
                    {col.label}
                  </th>
                ))}
                {actions && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((item) => {
                const id = keyExtractor(item);
                const isSelected = selectedIds?.has(id) ?? false;
                return (
                  <tr
                    key={id}
                    className={cn(
                      "hover:bg-muted/30 transition-colors",
                      isSelected && "bg-primary/5",
                      onRowClick && "cursor-pointer"
                    )}
                    onClick={() => onRowClick?.(item)}
                  >
                    {selectable && (
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleItem(id)}
                        />
                      </td>
                    )}
                    {desktopColumns.map((col) => (
                      <td
                        key={String(col.key)}
                        className={cn("px-4 py-3 text-sm", col.className)}
                      >
                        {col.render
                          ? col.render(item)
                          : String(item[col.key as keyof T] ?? "-")}
                      </td>
                    ))}
                    {actions && (
                      <td className="px-4 py-3 text-right">
                        <div
                          className="flex justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {actions(item)}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
