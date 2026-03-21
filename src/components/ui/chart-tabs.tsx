import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ChartTabItem {
  key: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface ChartTabsProps {
  tabs: ChartTabItem[];
  defaultTab?: string;
}

export function ChartTabs({ tabs, defaultTab }: ChartTabsProps) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.key || "");
  const activeTab = tabs.find((t) => t.key === active) || tabs[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5 p-1 bg-muted/50 rounded-lg border border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
              active === tab.key
                ? "bg-background text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="w-full">{activeTab?.content}</div>
    </div>
  );
}
