import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { bucketToTone, type FlowBucket } from "@/lib/china/flowTones";

interface Props {
  fromBucket: FlowBucket;
}

/** Linha horizontal + chevron, com cor herdada do nó anterior. */
export function FlowConnector({ fromBucket }: Props) {
  const tone = bucketToTone(fromBucket);
  const color =
    tone === "done"
      ? "text-emerald-500/60"
      : tone === "prog"
      ? "text-amber-500/60"
      : tone === "block"
      ? "text-rose-500/60"
      : "text-border";
  return (
    <div className="mt-4 flex shrink-0 items-center self-start" aria-hidden>
      <div className={cn("h-px w-3 bg-current", color)} />
      <ChevronRight className={cn("-ml-0.5 h-3.5 w-3.5", color)} />
    </div>
  );
}
