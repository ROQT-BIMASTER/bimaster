import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Camera, GitCompare, Trash2 } from "lucide-react";
import { APP_VERSION } from "@/lib/version";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/hooks/useConfirm";

const STORAGE_KEY = "security_v2_version_snapshots";
const MAX_SNAPSHOTS = 20;

type Snapshot = {
  version: string;
  captured_at: string;
  metrics: {
    mfa_enrolled: number;
    mfa_required_users: number;
    waf_shadow_24h: number;
    anomalies_24h: number;
    quarantined_active: number;
    last_pentest_score: number | null;
    open_dep_findings: number;
    secrets_due_rotation: number;
  };
};

type RowDef = {
  key: keyof Snapshot["metrics"] | "mfa_pct";
  label: string;
  /** "up" = higher is better; "down" = lower is better */
  direction: "up" | "down";
  format?: (v: any) => string;
};

const ROWS: RowDef[] = [
  { key: "mfa_pct", label: "Cobertura MFA", direction: "up", format: (v) => `${v}%` },
  { key: "last_pentest_score", label: "Pentest Score", direction: "up", format: (v) => (v == null ? "—" : `${v}%`) },
  { key: "waf_shadow_24h", label: "WAF Shadow 24h", direction: "down" },
  { key: "anomalies_24h", label: "Anomalias 24h", direction: "down" },
  { key: "quarantined_active", label: "Quarentenas ativas", direction: "down" },
  { key: "open_dep_findings", label: "CVEs abertos", direction: "down" },
  { key: "secrets_due_rotation", label: "Segredos vencidos", direction: "down" },
];

function loadSnapshots(): Snapshot[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function saveSnapshots(s: Snapshot[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s.slice(-MAX_SNAPSHOTS)));
}

function pct(m: Snapshot["metrics"]) {
  return m.mfa_required_users > 0 ? Math.round((m.mfa_enrolled / m.mfa_required_users) * 100) : 0;
}
function getValue(s: Snapshot, key: RowDef["key"]): number | null {
  if (key === "mfa_pct") return pct(s.metrics);
  return (s.metrics as any)[key];
}

function deltaBadge(curr: number | null, prev: number | null, direction: "up" | "down") {
  if (curr == null || prev == null) return null;
  const diff = curr - prev;
  if (diff === 0) return <Badge variant="outline" className="text-[10px]">=</Badge>;
  const better = direction === "up" ? diff > 0 : diff < 0;
  return (
    <Badge
      variant={better ? "default" : "destructive"}
      className={cn("text-[10px] font-mono", better ? "bg-green-600 hover:bg-green-600" : "")}
    >
      {diff > 0 ? "+" : ""}{diff}
    </Badge>
  );
}

export function SecurityVersionCompare() {
  const confirm = useConfirm();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [selectedA, setSelectedA] = useState<string>("");
  const [selectedB, setSelectedB] = useState<string>("");

  useEffect(() => {
    const s = loadSnapshots();
    setSnapshots(s);
    if (s.length >= 2) {
      setSelectedA(s[s.length - 2].captured_at);
      setSelectedB(s[s.length - 1].captured_at);
    } else if (s.length === 1) {
      setSelectedB(s[0].captured_at);
    }
  }, []);

  const captureSnapshot = async () => {
    setCapturing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(
        "https://aokkyrgaqjarhlywhjju.functions.supabase.co/security-metrics-v2?op=metrics",
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      if (!r.ok) throw new Error(await r.text());
      const metrics = await r.json();
      const snap: Snapshot = {
        version: APP_VERSION,
        captured_at: new Date().toISOString(),
        metrics,
      };
      const next = [...snapshots, snap].slice(-MAX_SNAPSHOTS);
      saveSnapshots(next);
      setSnapshots(next);
      setSelectedA(selectedB || snap.captured_at);
      setSelectedB(snap.captured_at);
      toast.success(`Snapshot v${APP_VERSION} capturado`);
    } catch (e: any) {
      toast.error("Falha ao capturar: " + e.message);
    } finally {
      setCapturing(false);
    }
  };

  const clearAll = async () => {
    if (!(await confirm({ title: "Apagar todos os snapshots locais?", destructive: true }))) return;
    localStorage.removeItem(STORAGE_KEY);
    setSnapshots([]);
    setSelectedA("");
    setSelectedB("");
  };

  const snapA = snapshots.find((s) => s.captured_at === selectedA);
  const snapB = snapshots.find((s) => s.captured_at === selectedB);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" />
            Comparativo por versão
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={captureSnapshot} disabled={capturing}>
              <Camera className="h-4 w-4 mr-2" />
              {capturing ? "Capturando..." : `Capturar (v${APP_VERSION})`}
            </Button>
            {snapshots.length > 0 && (
              <Button size="sm" variant="outline" onClick={clearAll}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Snapshots locais ({snapshots.length}/{MAX_SNAPSHOTS}) — capture após cada release para acompanhar evolução.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {snapshots.length === 0 ? (
          <p className="text-sm text-center text-muted-foreground py-8">
            Nenhum snapshot capturado. Clique em "Capturar" para registrar o estado atual.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Base (anterior)</label>
                <select
                  value={selectedA}
                  onChange={(e) => setSelectedA(e.target.value)}
                  className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">— nenhum —</option>
                  {snapshots.map((s) => (
                    <option key={s.captured_at} value={s.captured_at}>
                      v{s.version} · {new Date(s.captured_at).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Comparar com</label>
                <select
                  value={selectedB}
                  onChange={(e) => setSelectedB(e.target.value)}
                  className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">— nenhum —</option>
                  {snapshots.map((s) => (
                    <option key={s.captured_at} value={s.captured_at}>
                      v{s.version} · {new Date(s.captured_at).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Métrica</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">Atual</TableHead>
                  <TableHead className="text-right w-24">Δ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ROWS.map((row) => {
                  const a = snapA ? getValue(snapA, row.key) : null;
                  const b = snapB ? getValue(snapB, row.key) : null;
                  const fmt = row.format ?? ((v: any) => (v == null ? "—" : String(v)));
                  return (
                    <TableRow key={row.key}>
                      <TableCell className="font-medium text-sm">{row.label}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(a)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(b)}</TableCell>
                      <TableCell className="text-right">{deltaBadge(b, a, row.direction)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
