import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Skeleton para a visão Kanban de projetos. */
export function KanbanSkeleton({ darkBg = false }: { darkBg?: boolean }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            "flex-shrink-0 w-72 rounded-xl border flex flex-col",
            darkBg ? "bg-white/5 border-white/15" : "bg-muted/30 border-border/50"
          )}
        >
          <div className={cn("px-3 py-3 border-b flex items-center justify-between", darkBg ? "border-white/10" : "border-border/30")}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-8" />
          </div>
          <div className="p-2 space-y-2">
            {[0, 1, 2].map((j) => (
              <div
                key={j}
                className={cn(
                  "rounded-lg border p-3 space-y-2",
                  darkBg ? "bg-white/5 border-white/10" : "bg-background border-border/60"
                )}
              >
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex items-center gap-1.5 pt-1">
                  <Skeleton className="h-5 w-12 rounded" />
                  <Skeleton className="h-5 w-16 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton para a visão Lista de projetos. */
export function ListSkeleton() {
  return (
    <div className="space-y-3 p-2">
      {[0, 1].map((s) => (
        <div key={s} className="border rounded-lg overflow-hidden">
          <div className="bg-muted/30 px-3 py-2 flex items-center gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-10 ml-auto" />
          </div>
          <div className="divide-y">
            {[0, 1, 2, 3].map((r) => (
              <div key={r} className="grid grid-cols-[20px_1fr_120px_100px_80px] gap-2 items-center px-3 py-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-6 w-6 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
