import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Circle } from "lucide-react";

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

interface ApiStatusBadgeProps {
  basePath: string;
  className?: string;
}

export default function ApiStatusBadge({ basePath, className }: ApiStatusBadgeProps) {
  const [status, setStatus] = useState<"loading" | "online" | "offline">("loading");
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const start = performance.now();
      try {
        const res = await fetch(`${BASE_URL}${basePath}/status`, {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        });
        if (!cancelled) {
          setLatency(Math.round(performance.now() - start));
          setStatus(res.ok ? "online" : "offline");
        }
      } catch {
        if (!cancelled) {
          setLatency(null);
          setStatus("offline");
        }
      }
    };
    check();
    return () => { cancelled = true; };
  }, [basePath]);

  if (status === "loading") {
    return (
      <Badge variant="outline" className={`text-[9px] gap-1 px-1.5 py-0 ${className}`}>
        <Circle className="h-2 w-2 text-muted-foreground animate-pulse fill-muted-foreground" />
        ...
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={`text-[9px] gap-1 px-1.5 py-0 ${
        status === "online"
          ? "text-emerald-600 border-emerald-500/30"
          : "text-red-600 border-red-500/30"
      } ${className}`}
    >
      <Circle className={`h-2 w-2 ${status === "online" ? "fill-emerald-500 text-emerald-500" : "fill-red-500 text-red-500"}`} />
      {status === "online" ? `${latency}ms` : "offline"}
    </Badge>
  );
}
