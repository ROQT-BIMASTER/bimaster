import { useState } from "react";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import { ChinaUnifiedTimeline } from "./ChinaUnifiedTimeline";
import type { ChinaTimelineScope } from "@/lib/china/timeline/types";
import { cn } from "@/lib/utils";

interface Props {
  scope: ChinaTimelineScope;
  label?: string;
  title?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "icon";
  className?: string;
  iconOnly?: boolean;
}

export function ChinaTimelineButton({
  scope,
  label = "Linha do tempo",
  title,
  variant = "outline",
  size = "sm",
  className,
  iconOnly = false,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={iconOnly ? "icon" : size}
        className={cn("gap-1.5", className)}
        onClick={() => setOpen(true)}
        title={label}
      >
        <History className="h-3.5 w-3.5" />
        {!iconOnly && <span className="text-xs">{label}</span>}
      </Button>
      <ChinaUnifiedTimeline open={open} onOpenChange={setOpen} scope={scope} title={title} />
    </>
  );
}
