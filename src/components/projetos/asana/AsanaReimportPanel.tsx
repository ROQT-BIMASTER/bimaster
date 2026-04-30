import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  pat?: string;
}

interface RunStats {
  imported: number;
  expired: number;
  failed: number;
}

export function AsanaReimportPanel({ pat }: Props) {
  const [pending, setPending] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<RunStats>({ imported: 0, expired: 0, failed: 0 });
  const [total, setTotal] = useState<number>(0);

  const refreshCount = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("asana-reimport-attachments", {
        body: { mode: "count", pat },
      });
      if (error) throw error;
      setPending((data as any)?.pending ?? 0);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao consultar pendentes.");
    } finally {
      setLoading(false);
    }
  }, [pat]);

  useEffect(() => { refreshCount(); }, [refreshCount]);

  const runAll = async () => {
    if (!pending) { await refreshCount(); return; }
    setRunning(true);
    setTotal(pending);
    setStats({ imported: 0, expired: 0, failed: 0 });
    try {
      let remaining = pending;
      let safetyLoops = 0;
      const acc: RunStats = { imported: 0, expired: 0, failed: 0 };
      while (remaining > 0 && safetyLoops < 60) {
        safetyLoops++;
        const { data, error } = await supabase.functions.invoke("asana-reimport-attachments", {
          body: { mode: "run", batch_size: 25, pat },
        });
        if (error) throw error;
        const r = data as any;
        acc.imported += r?.imported || 0;
        acc.expired += r?.expired || 0;
        acc.failed += r?.failed || 0;
        setStats({ ...acc });
        remaining = r?.remaining ?? 0;
        setPending(remaining);
        if (!r?.processed) break;
      }
      toast.success(`Reimportação concluída: ${acc.imported} importados, ${acc.expired} expirados, ${acc.failed} falhas.`);
    } catch (e: any) {
      toast.error(e?.message || "Erro durante reimportação.");
    } finally {
      setRunning(false);
    }
  };

  if (pending === 0 && !running && stats.imported === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Anexos sincronizados
          </CardTitle>
          <CardDescription>Nenhum anexo legacy do Asana pendente de reimportação.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={refreshCount} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Reverificar
          </Button>
        </CardContent>
      </Card>
    );
  }

  const processed = stats.imported + stats.expired + stats.failed;
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" /> Anexos legacy do Asana
        </CardTitle>
        <CardDescription>
          Anexos importados em sincronizações antigas guardaram apenas a URL temporária do Asana, que já expirou.
          Reimporte agora para gravar os arquivos no storage do projeto e garantir a abertura.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant="secondary">
            {pending ?? "—"} pendente{(pending ?? 0) === 1 ? "" : "s"}
          </Badge>
          <Button size="sm" onClick={runAll} disabled={running || !pending}>
            {running
              ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Reimportando…</>
              : <><RefreshCw className="h-4 w-4 mr-1.5" /> Reimportar todos</>}
          </Button>
          <Button size="sm" variant="outline" onClick={refreshCount} disabled={running || loading}>
            Atualizar
          </Button>
        </div>

        {(running || processed > 0) && (
          <div className="space-y-2">
            <Progress value={pct} className="h-2" />
            <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
              <span>Importados: <strong className="text-emerald-500">{stats.imported}</strong></span>
              <span>Expirados no Asana: <strong className="text-amber-500">{stats.expired}</strong></span>
              <span>Falhas: <strong className="text-destructive">{stats.failed}</strong></span>
              {total > 0 && <span>Total: {total}</span>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
