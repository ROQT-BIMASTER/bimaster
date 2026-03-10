import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RotateCcw, CheckCircle2, AlertTriangle, Clock, Send } from "lucide-react";
import { toast } from "sonner";

interface ErpExportStatusBadgeProps {
  paymentQueueId: string;
  showRetry?: boolean;
}

interface ExportRecord {
  id: string;
  export_channel: string;
  export_status: string;
  attempts: number;
  error_message: string | null;
  exported_at: string | null;
  last_attempt_at: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; variant: "default" | "success" | "destructive" | "warning" | "secondary" }> = {
  success: { label: "Enviado ao ERP", icon: CheckCircle2, variant: "success" },
  error: { label: "Erro no envio", icon: AlertTriangle, variant: "destructive" },
  pending: { label: "Envio pendente", icon: Clock, variant: "warning" },
  sent: { label: "Enviado", icon: Send, variant: "secondary" },
};

export function ErpExportStatusBadge({ paymentQueueId, showRetry = true }: ErpExportStatusBadgeProps) {
  const [exportRecord, setExportRecord] = useState<ExportRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  const fetchStatus = async () => {
    try {
      const { data } = await supabase
        .from("erp_export_queue" as any)
        .select("*")
        .eq("payment_queue_id", paymentQueueId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setExportRecord(data as unknown as ExportRecord | null);
    } catch (err) {
      console.error("Error fetching ERP export status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [paymentQueueId]);

  const handleRetry = async () => {
    if (!exportRecord) return;
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke("erp-export-payment", {
        body: { action: "retry", export_queue_id: exportRecord.id },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Reenvio ao ERP realizado com sucesso");
      } else {
        toast.error(data?.message || "Falha no reenvio ao ERP");
      }
      await fetchStatus();
    } catch (err: any) {
      toast.error("Erro ao reenviar: " + (err.message || ""));
    } finally {
      setRetrying(false);
    }
  };

  if (loading) return null;
  if (!exportRecord) return null;

  const config = STATUS_CONFIG[exportRecord.export_status] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={config.variant} className="gap-1 text-xs">
              <Icon className="h-3 w-3" />
              {config.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs space-y-1">
              <p>Canal: {exportRecord.export_channel}</p>
              <p>Tentativas: {exportRecord.attempts}</p>
              {exportRecord.error_message && (
                <p className="text-destructive">Erro: {exportRecord.error_message}</p>
              )}
              {exportRecord.exported_at && (
                <p>Exportado em: {new Date(exportRecord.exported_at).toLocaleString("pt-BR")}</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {showRetry && exportRecord.export_status === "error" && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={handleRetry}
          disabled={retrying}
        >
          {retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
          Reenviar
        </Button>
      )}
    </div>
  );
}
