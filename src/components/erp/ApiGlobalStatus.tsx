import { useState, useEffect, useCallback } from "react";
import { Activity, Circle, RefreshCw, Wifi, WifiOff } from "lucide-react";

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

interface ApiGlobalStatusProps {
  basePaths: string[];
}

interface StatusResult {
  path: string;
  status: "online" | "offline";
  latency: number;
}

export default function ApiGlobalStatus({ basePaths }: ApiGlobalStatusProps) {
  const [results, setResults] = useState<StatusResult[]>([]);
  const [loading, setLoading] = useState(true);

  const checkAll = useCallback(async () => {
    setLoading(true);
    const checks = basePaths.map(async (path): Promise<StatusResult> => {
      const start = performance.now();
      try {
        const res = await fetch(`${BASE_URL}${path}/status`, {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        });
        await res.text().catch(() => {});
        const latency = Math.round(performance.now() - start);
        const online = res.ok || res.status === 401 || res.status === 403 || res.status === 405;
        return { path, status: online ? "online" : "offline", latency };
      } catch {
        return { path, status: "offline", latency: 0 };
      }
    });
    const all = await Promise.all(checks);
    setResults(all);
    setLoading(false);
  }, [basePaths]);

  useEffect(() => { checkAll(); }, [checkAll]);

  const online = results.filter(r => r.status === "online").length;
  const offline = results.filter(r => r.status === "offline").length;
  const total = results.length;
  const avgLatency = results.filter(r => r.status === "online" && r.latency > 0).length > 0
    ? Math.round(results.filter(r => r.status === "online").reduce((s, r) => s + r.latency, 0) / results.filter(r => r.status === "online").length)
    : 0;

  const allOnline = online === total && total > 0;
  const hasOffline = offline > 0;

  return (
    <div className={`rounded-lg border p-3 mb-3 transition-colors ${
      loading ? "border-border bg-muted/30" :
      allOnline ? "border-emerald-500/30 bg-emerald-500/5" :
      hasOffline ? "border-red-500/30 bg-red-500/5" :
      "border-border bg-muted/30"
    }`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Status Global</span>
        </div>
        <button
          onClick={checkAll}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-1.5">
          <Circle className="h-2 w-2 animate-pulse fill-muted-foreground text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Verificando...</span>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            {allOnline ? (
              <Wifi className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-red-500" />
            )}
            <span className="text-xs font-semibold">
              {online}/{total} online
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Latência média: {avgLatency}ms</span>
            {offline > 0 && (
              <span className="text-red-500 font-medium">{offline} offline</span>
            )}
          </div>
          {/* Mini bar */}
          <div className="flex gap-0.5 h-1 rounded-full overflow-hidden">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex-1 rounded-full ${r.status === "online" ? "bg-emerald-500" : "bg-red-500"}`}
                title={`${r.path}: ${r.status} (${r.latency}ms)`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
