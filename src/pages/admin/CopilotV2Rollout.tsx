/**
 * Admin — Copilot v2 Rollout
 *
 * Painel de observabilidade do rollout dos copilotos v2:
 * - Volume de runs nos últimos N dias por copiloto, separando legado e v2.
 * - Latência média e média de números não verificáveis por resposta.
 * - Toggle das flags `ff_copilot_v2_*` via RPC admin (auditada).
 *
 * Acessível apenas para usuários com role `admin` (RPC valida via has_role).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface StatRow {
  copilot_id: string;
  is_v2: boolean;
  runs: number;
  avg_latency_ms: number;
  avg_unverifiable: number;
  total_breaches: number;
  last_run: string | null;
}

interface FlagRow {
  codigo: string;
  ativo: boolean;
}

const FLAG_CODES = [
  "ff_copilot_v2_central",
  "ff_copilot_v2_projeto",
  "ff_copilot_v2_sofia",
  "ff_copilot_v2_estoque",
  "ff_copilot_v2_china",
];

export default function CopilotV2Rollout() {
  const [days, setDays] = useState(7);
  const [stats, setStats] = useState<StatRow[]>([]);
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingFlag, setSavingFlag] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: statsData, error: statsErr }, { data: flagData, error: flagErr }] = await Promise.all([
        (supabase as any).rpc("admin_copilot_v2_stats", { p_days: days }),
        (supabase as any)
          .from("feature_flags")
          .select("codigo, ativo")
          .in("codigo", FLAG_CODES),
      ]);
      if (statsErr) throw statsErr;
      if (flagErr) throw flagErr;
      setStats((statsData ?? []) as StatRow[]);
      setFlags(((flagData ?? []) as FlagRow[]));
    } catch (e) {
      toast.error(`Falha ao carregar painel: ${e instanceof Error ? e.message : "erro desconhecido"}`);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const m = new Map<string, { legacy?: StatRow; v2?: StatRow }>();
    for (const row of stats) {
      const cur = m.get(row.copilot_id) ?? {};
      if (row.is_v2) cur.v2 = row;
      else cur.legacy = row;
      m.set(row.copilot_id, cur);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [stats]);

  const toggleFlag = async (codigo: string, novoAtivo: boolean) => {
    setSavingFlag(codigo);
    try {
      const { error } = await (supabase as any).rpc("admin_set_copilot_v2_flag", {
        p_codigo: codigo,
        p_ativo: novoAtivo,
      });
      if (error) throw error;
      setFlags((prev) => {
        const exists = prev.some((f) => f.codigo === codigo);
        return exists
          ? prev.map((f) => (f.codigo === codigo ? { ...f, ativo: novoAtivo } : f))
          : [...prev, { codigo, ativo: novoAtivo }];
      });
      toast.success(`${codigo} = ${novoAtivo ? "ligado" : "desligado"}`);
    } catch (e) {
      toast.error(`Falha ao atualizar flag: ${e instanceof Error ? e.message : "erro"}`);
    } finally {
      setSavingFlag(null);
    }
  };

  const flagFor = (codigo: string) => flags.find((f) => f.codigo === codigo)?.ativo ?? false;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Rollout dos Copilotos v2</h1>
          <p className="text-sm text-muted-foreground">
            Observabilidade do contrato v2 (citações e números) e controle das feature flags.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[1, 7, 30].map((d) => (
            <Button
              key={d}
              variant={days === d ? "default" : "outline"}
              size="sm"
              onClick={() => setDays(d)}
            >
              {d === 1 ? "24h" : `${d}d`}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            Atualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Flags de rollout</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FLAG_CODES.map((codigo) => {
              const ativo = flagFor(codigo);
              const id = codigo.replace("ff_copilot_v2_", "");
              return (
                <div
                  key={codigo}
                  className="flex items-center justify-between rounded-lg border border-border p-3 bg-card"
                >
                  <div>
                    <Label htmlFor={codigo} className="text-sm font-medium capitalize">
                      {id}
                    </Label>
                    <p className="text-xs text-muted-foreground">{codigo}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={ativo ? "default" : "outline"}>
                      {ativo ? "v2 ligado" : "legado"}
                    </Badge>
                    <Switch
                      id={codigo}
                      checked={ativo}
                      disabled={savingFlag === codigo}
                      onCheckedChange={(v) => toggleFlag(codigo, v)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Métricas por copiloto · últimos {days === 1 ? "24h" : `${days} dias`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum run no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Copiloto</TableHead>
                  <TableHead>Runs legado</TableHead>
                  <TableHead>Runs v2</TableHead>
                  <TableHead>% v2</TableHead>
                  <TableHead>Latência média v2</TableHead>
                  <TableHead>Não verificáveis (v2)</TableHead>
                  <TableHead>Último run</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.map(([id, pair]) => {
                  const legacy = pair.legacy?.runs ?? 0;
                  const v2 = pair.v2?.runs ?? 0;
                  const total = legacy + v2;
                  const pct = total > 0 ? Math.round((v2 / total) * 100) : 0;
                  const last = pair.v2?.last_run ?? pair.legacy?.last_run;
                  return (
                    <TableRow key={id}>
                      <TableCell className="font-medium">{id || "—"}</TableCell>
                      <TableCell>{legacy.toLocaleString("pt-BR")}</TableCell>
                      <TableCell>{v2.toLocaleString("pt-BR")}</TableCell>
                      <TableCell>
                        <Badge variant={pct >= 80 ? "default" : pct > 0 ? "secondary" : "outline"}>
                          {pct}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {pair.v2 ? `${Math.round(pair.v2.avg_latency_ms)} ms` : "—"}
                      </TableCell>
                      <TableCell>
                        {pair.v2 ? pair.v2.avg_unverifiable.toFixed(2) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {last
                          ? formatDistanceToNow(new Date(last), { addSuffix: true, locale: ptBR })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Critério de promoção: ≥ 80% de runs em v2 por 14 dias e média de números não
            verificáveis ≤ 0,20 por resposta. Atingido isso, a Fase 6 (remoção do legado)
            pode ser executada.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
