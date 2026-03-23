import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
      try {
        const { data, error } = await supabase.functions.invoke("api-health-check", {
          body: { paths: [basePath] },
        });
        if (cancelled) return;
        if (error || !data?.results?.[0]) {
          setStatus("offline");
          setLatency(null);
          return;
        }
        const result = data.results[0];
        setStatus(result.status === "online" ? "online" : "offline");
        setLatency(result.latency || null);
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
