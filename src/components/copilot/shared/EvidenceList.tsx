import { Badge } from "@/components/ui/badge";
import { Link2 } from "lucide-react";
import type { Citation } from "@/types/copilot";

export function EvidenceList({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;
  return (
    <div className="border-t border-border pt-2">
      <div className="text-xs font-medium text-muted-foreground mb-1">Evidências</div>
      <ul className="space-y-1">
        {citations.map((c) => (
          <li key={c.citationId} className="text-xs flex items-start gap-2">
            <Badge variant="secondary" className="shrink-0 font-mono">
              {c.citationId}
            </Badge>
            <div className="flex-1">
              <span className={c.confidence < 0.5 ? "text-muted-foreground italic" : "text-foreground"}>
                {c.snippet}
              </span>
              {c.confidence < 0.5 && (
                <span className="ml-1 text-[10px] text-amber-600">(fonte fraca)</span>
              )}
              {c.sourceUrl && (
                <a
                  href={c.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 inline-flex items-center text-primary hover:underline"
                >
                  <Link2 className="h-3 w-3" />
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
