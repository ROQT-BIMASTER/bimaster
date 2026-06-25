import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SyncStatus {
  last_sync_at: string | null;
  total_raw: number;
  total_master: number;
}

export function ClientesSyncBadge() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["clientes-sync-status"],
    queryFn: async (): Promise<SyncStatus> => {
      const { data, error } = await supabase
        .from("vw_clientes_sync_status" as any)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? { last_sync_at: null, total_raw: 0, total_master: 0 };
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const sync = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-erp-clientes/sync", {
        body: { mode: "incremental" },
      });
      if (error) throw error;
      if (data && (data as any).ok === false) {
        throw new Error(((data as any).errors || []).join(" | ") || "Falha na sincronização");
      }
      return data;
    },
    onSuccess: (d: any) => {
      toast.success("Clientes sincronizados", {
        description: `${d?.total_upserts ?? 0} registros atualizados do ERP`,
      });
      qc.invalidateQueries({ queryKey: ["clientes-sync-status"] });
      qc.invalidateQueries({ queryKey: ["municipios-kpis"] });
      qc.invalidateQueries({ queryKey: ["municipios-intelligence"] });
      qc.invalidateQueries({ queryKey: ["municipios-top-opportunities"] });
    },
    onError: (err: any) => {
      toast.error("Não foi possível sincronizar", { description: err?.message ?? "Erro desconhecido" });
    },
  });

  const lastSync = data?.last_sync_at ? new Date(data.last_sync_at) : null;
  const ageMin = lastSync ? (Date.now() - lastSync.getTime()) / 60000 : Infinity;
  const variant: "default" | "secondary" | "destructive" =
    ageMin < 30 ? "default" : ageMin < 120 ? "secondary" : "destructive";
  const label = lastSync
    ? `Atualizado ${formatDistanceToNow(lastSync, { locale: ptBR, addSuffix: true })}`
    : "Sem sincronização registrada";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={variant} className="gap-1.5 cursor-help">
              <CheckCircle2 className="h-3 w-3" />
              {isLoading ? "Verificando…" : label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs space-y-0.5">
              <div>Carga ERP: {data?.total_raw?.toLocaleString("pt-BR") ?? "-"} clientes</div>
              <div>Base mestre: {data?.total_master?.toLocaleString("pt-BR") ?? "-"} clientes</div>
              <div className="text-muted-foreground pt-1">Sincronização automática a cada 15 min</div>
            </div>
          </TooltipContent>
        </Tooltip>

        <Button
          size="sm"
          variant="outline"
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
          className="h-7 gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${sync.isPending ? "animate-spin" : ""}`} />
          {sync.isPending ? "Sincronizando…" : "Atualizar agora"}
        </Button>
      </div>
    </TooltipProvider>
  );
}
