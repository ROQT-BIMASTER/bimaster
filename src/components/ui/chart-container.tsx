import { useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Maximize2, X, BarChart3, Table as TableIcon, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChartContainerProps {
  title: string;
  icon?: ReactNode;
  chart: ReactNode;
  table?: ReactNode;
  /** Content to render in focus mode (full data). Falls back to chart/table. */
  focusChart?: ReactNode;
  focusTable?: ReactNode;
  onExport?: () => void;
  className?: string;
  /** Height of the chart area in normal mode */
  chartHeight?: string;
}

export function ChartContainer({
  title,
  icon,
  chart,
  table,
  focusChart,
  focusTable,
  onExport,
  className,
  chartHeight = "h-[400px]",
}: ChartContainerProps) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [focusOpen, setFocusOpen] = useState(false);
  const [focusView, setFocusView] = useState<"chart" | "table">("chart");

  const hasTable = !!table;

  const ViewToggle = ({ current, onChange }: { current: "chart" | "table"; onChange: (v: "chart" | "table") => void }) => (
    hasTable ? (
      <div className="flex items-center bg-muted/50 rounded-md border border-border p-0.5">
        <button
          onClick={() => onChange("chart")}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all",
            current === "chart" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <BarChart3 className="h-3 w-3" />
          Gráfico
        </button>
        <button
          onClick={() => onChange("table")}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all",
            current === "table" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <TableIcon className="h-3 w-3" />
          Tabela
        </button>
      </div>
    ) : null
  );

  return (
    <>
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              {icon}
              {title}
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <ViewToggle current={view} onChange={setView} />
              {onExport && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onExport} title="Exportar">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => { setFocusView(view); setFocusOpen(true); }}
                title="Modo Foco"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className={view === "chart" ? chartHeight : ""}>
            {view === "chart" ? chart : table}
          </div>
        </CardContent>
      </Card>

      {/* Focus Mode */}
      <Dialog open={focusOpen} onOpenChange={setFocusOpen}>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh] p-0 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b bg-background">
            <h2 className="text-lg font-bold flex items-center gap-2">{icon}{title}</h2>
            <div className="flex items-center gap-2">
              <ViewToggle current={focusView} onChange={setFocusView} />
              {onExport && (
                <Button variant="outline" size="sm" onClick={onExport} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Exportar
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => setFocusOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6">
            <div className="h-[calc(95vh-80px)]">
              {focusView === "chart"
                ? (focusChart || chart)
                : (focusTable || table)
              }
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
