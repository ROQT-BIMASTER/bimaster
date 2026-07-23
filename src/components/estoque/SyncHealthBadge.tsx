import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUserRole } from "@/hooks/useUserRole";
import { useConfirm } from "@/hooks/useConfirm";
import { toast } from "sonner";


interface HealthRow {
  fonte: string;
  last_run_at: string | null;
  last_success_at: string | null;
  last_row_count: number | null;
  last_status: string | null;
  last_error: string | null;
}

// TTL em minutos por fonte — deve casar com check_estoque_freshness()
const TTL_MIN: Record<string, number> = {
  estoque: 360,
  estoque_live: 90,
  estoque_fisico: 120,
};
const LABEL: Record<string, string> = {
  estoque: "Estoque ERP (por filial)",
  estoque_live: "Estoque disponível",
  estoque_fisico: "Estoque físico (fornecedor)",
};

function ageMinutes(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 60_000;
}

export function SyncHealthBadge() {
  const qc = useQueryClient();
  const { isAdmin } = useUserRole();
  const confirm = useConfirm();


  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["estoque-sync-health"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_sync_health" as any)
        .select("*")
        .order("fonte");
      if (error) throw error;
      return (data ?? []) as unknown as HealthRow[];
    },
    refetchInterval: 60_000,
  });

  const summary = useMemo(() => {
    if (!rows.length) return { level: "muted" as const, atrasadas: 0 };
    const atrasadas = rows.filter((r) => {
      const ttl = TTL_MIN[r.fonte];
      if (!ttl) return false;
      const age = ageMinutes(r.last_success_at ?? r.last_run_at);
      return age != null && age > ttl;
    }).length;
    if (atrasadas === 0) return { level: "ok" as const, atrasadas: 0 };
    return { level: "warn" as const, atrasadas };
  }, [rows]);

  const handleForceSync = async (path: "sync-estoque-full" | "sync-estoque-live") => {
    const ok = await confirm({
      title: "Consultar ERP do Result agora?",
      description:
        "Esta ação consulta o ERP do Result imediatamente. Por acordo com a equipe do Result, as consultas devem ocorrer só fora do horário comercial (janelas automáticas 05:30 e 21:30). Use apenas em urgência real. Continuar?",
      confirmLabel: "Executar mesmo assim",
      cancelLabel: "Cancelar",
      destructive: true,
    });
    if (!ok) return;
    try {

      const { error } = await supabase.functions.invoke("erp-sync-engine", { body: { path } });
      if (error) throw error;
      toast.success(
        path === "sync-estoque-full"
          ? "Sincronização completa iniciada"
          : "Sincronização de estoque disponível iniciada",
      );
      setTimeout(() => qc.invalidateQueries({ queryKey: ["estoque-sync-health"] }), 3000);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao iniciar sincronização");
    }
  };

  const Icon = summary.level === "warn" ? AlertTriangle : CheckCircle2;
  const chipClass =
    summary.level === "warn"
      ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      : summary.level === "ok"
        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
        : "";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={`h-8 ${chipClass}`} disabled={isLoading}>
          <Icon className="mr-2 h-3.5 w-3.5" />
          {summary.level === "warn"
            ? `Sync atrasada (${summary.atrasadas})`
            : summary.level === "ok"
              ? "Sync em dia"
              : "Sync…"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-3">
        <div className="mb-2 text-sm font-medium">Saúde da sincronização de estoque</div>
        <div className="space-y-2">
          {rows.length === 0 && (
            <div className="text-xs text-muted-foreground">Sem histórico ainda — aguarde a primeira execução.</div>
          )}
          {rows.map((r) => {
            const ttl = TTL_MIN[r.fonte];
            const iso = r.last_success_at ?? r.last_run_at;
            const age = ageMinutes(iso);
            const stale = ttl && age != null && age > ttl;
            return (
              <div key={r.fonte} className="rounded border border-border p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{LABEL[r.fonte] ?? r.fonte}</div>
                  <Badge variant={stale ? "destructive" : "outline"} className="text-[10px]">
                    {stale ? "Atrasada" : "OK"}
                  </Badge>
                </div>
                <div className="mt-1 text-muted-foreground">
                  {iso
                    ? `Atualizado há ${formatDistanceToNow(new Date(iso), { locale: ptBR })}`
                    : "Sem execução registrada"}
                  {ttl ? ` · TTL ${Math.round(ttl / 60)}h` : ""}
                  {r.last_row_count != null ? ` · ${r.last_row_count} linhas` : ""}
                </div>
                {r.last_error && (
                  <div className="mt-1 text-destructive">Último erro: {r.last_error.slice(0, 160)}</div>
                )}
              </div>
            );
          })}
        </div>
        {isAdmin && (
          <div className="mt-3 flex gap-2 border-t border-border pt-3">
            <Button size="sm" variant="secondary" className="flex-1" onClick={() => handleForceSync("sync-estoque-full")}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Forçar full
            </Button>
            <Button size="sm" variant="secondary" className="flex-1" onClick={() => handleForceSync("sync-estoque-live")}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Forçar live
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
