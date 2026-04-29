import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface VirtualizedRowsProps<T> {
  items: T[];
  estimatedRowHeight?: number;
  maxHeight?: number;
  overscan?: number;
  getKey: (item: T, index: number) => string;
  renderRow: (item: T, index: number) => React.ReactNode;
}

/**
 * Lightweight virtualization wrapper for long flat lists of rows.
 *
 * Designed to be opt-in (used only when a section has many tasks) so the default
 * render path stays identical for small/medium projects.
 *
 * Uses dynamic measurement via `measureElement`, which supports rows of variable
 * height (subtasks, badges, etc.) without clipping content.
 */
export function VirtualizedRows<T>({
  items,
  estimatedRowHeight = 40,
  maxHeight = 600,
  overscan = 8,
  getKey,
  renderRow,
}: VirtualizedRowsProps<T>) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan,
    getItemKey: (index) => getKey(items[index], index),
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      ref={parentRef}
      style={{ maxHeight, overflowY: "auto", overflowX: "hidden" }}
      className="relative"
    >
      <div style={{ height: totalSize, width: "100%", position: "relative" }}>
        {virtualItems.map((vi) => {
          const item = items[vi.index];
          return (
            <div
              key={vi.key}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${vi.start}px)`,
              }}
            >
              {renderRow(item, vi.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
