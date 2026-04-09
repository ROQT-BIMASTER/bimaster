import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Shield, ShieldAlert, ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Anomaly {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  ip?: string;
  endpoint?: string;
  description: string;
  confidence: number;
}

interface Defense {
  action: "block_ip" | "disable_token" | "alert_only";
  target: string;
  reason: string;
  executed: boolean;
}

interface SentinelResult {
  anomalies: Anomaly[];
  defenses: Defense[];
  risk_assessment: string;
  logs_analyzed: number;
  incidents_found: number;
  analysis_timestamp: string;
}

export default function SecuritySentinelPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SentinelResult | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("security-ai-sentinel", {
        body: {},
      });
      if (error) throw error;
      setResult(data);
      setLastRun(new Date().toISOString());

      if (data.anomalies?.length > 0) {
        toast.warning(`Sentinel detectou ${data.anomalies.length} anomalia(s)`, {
          description: data.risk_assessment?.substring(0, 100),
        });
      } else {
        toast.success("Nenhuma anomalia detectada", {
          description: "O tráfego está dentro dos padrões normais.",
        });
      }
    } catch (err: any) {
      console.error("Sentinel error:", err);
      toast.error("Erro ao executar análise", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    const map: Record<string, { className: string; label: string }> = {
      critical: { className: "bg-destructive text-destructive-foreground", label: "Crítico" },
      high: { className: "bg-red-500/15 text-red-600 border-red-500/30", label: "Alto" },
      medium: { className: "bg-amber-500/15 text-amber-600 border-amber-500/30", label: "Médio" },
      low: { className: "bg-blue-500/15 text-blue-600 border-blue-500/30", label: "Baixo" },
    };
    const s = map[severity] || map.low;
    return <Badge className={s.className}>{s.label}</Badge>;
  };

  const getStatusBadge = () => {
    if (!result) return <Badge variant="secondary">Aguardando</Badge>;
    const critCount = result.anomalies.filter((a) => a.severity === "critical" || a.severity === "high").length;
    const defenseCount = result.defenses.filter((d) => d.executed).length;
    if (defenseCount > 0) return <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" /> Defesa Ativa</Badge>;
    if (critCount > 0) return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 gap-1"><AlertTriangle className="h-3 w-3" /> Alerta</Badge>;
    return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1"><ShieldCheck className="h-3 w-3" /> Sem Anomalias</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Agente IA Sentinel
          </CardTitle>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <Button onClick={runAnalysis} disabled={loading} size="sm" className="gap-1.5">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
              {loading ? "Analisando..." : "Executar Análise IA"}
            </Button>
          </div>
        </div>
        {lastRun && (
          <p className="text-xs text-muted-foreground mt-1">
            Última análise: {format(new Date(lastRun), "dd/MM/yyyy HH:mm:ss")}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {!result ? (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Clique em "Executar Análise IA" para que o Sentinel analise os logs das últimas 2 horas em busca de anomalias e ameaças.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Risk Assessment */}
            <div className="bg-muted/50 rounded-lg p-4 border">
              <h4 className="text-sm font-semibold mb-1">Avaliação de Risco</h4>
              <p className="text-sm text-muted-foreground">{result.risk_assessment}</p>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                <span>Logs analisados: <strong>{result.logs_analyzed}</strong></span>
                <span>Incidentes encontrados: <strong>{result.incidents_found}</strong></span>
              </div>
            </div>

            {/* Anomalies */}
            {result.anomalies.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Anomalias Detectadas ({result.anomalies.length})</h4>
                <div className="space-y-2">
                  {result.anomalies.map((a, i) => (
                    <div key={i} className="flex items-start gap-3 bg-muted/30 rounded-lg p-3 border">
                      <div className="mt-0.5">{getSeverityBadge(a.severity)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{a.type}</p>
                        <p className="text-xs text-muted-foreground">{a.description}</p>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          {a.ip && <span>IP: <code className="font-mono">{a.ip}</code></span>}
                          {a.endpoint && <span>Endpoint: <code className="font-mono">{a.endpoint}</code></span>}
                          <span>Confiança: {(a.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Defenses */}
            {result.defenses.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Ações de Defesa ({result.defenses.length})</h4>
                <div className="space-y-2">
                  {result.defenses.map((d, i) => (
                    <div key={i} className="flex items-center gap-3 bg-muted/30 rounded-lg p-3 border">
                      {d.executed ? (
                        <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" /> Executada</Badge>
                      ) : (
                        <Badge variant="secondary">Recomendada</Badge>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <strong>{d.action === "block_ip" ? "Bloquear IP" : d.action === "disable_token" ? "Desativar Token" : "Alerta"}</strong>
                          {" — "}{d.target}
                        </p>
                        <p className="text-xs text-muted-foreground">{d.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.anomalies.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                <p className="text-sm">Nenhuma anomalia detectada. O tráfego está dentro dos padrões esperados.</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
