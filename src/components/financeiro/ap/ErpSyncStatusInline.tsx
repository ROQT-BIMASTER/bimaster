import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CloudUpload, CheckCircle2, Clock, Loader2, AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";

interface ErpSyncStatusInlineProps {
  tituloId: string;
  importadoApi?: boolean;
  codigoIntegracao?: string;
  status?: string;
}

const SYNC_STATUS_MAP: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  pendente: { label: "Na Fila", cls: "bg-yellow-100 text-yellow-800", icon: Clock },
  enviado: { label: "Enviado", cls: "bg-blue-100 text-blue-800", icon: Send },
  sucesso: { label: "Confirmado ERP", cls: "bg-green-100 text-green-800", icon: CheckCircle2 },
  erro: { label: "Erro ERP", cls: "bg-red-100 text-red-800", icon: AlertTriangle },
};

export function ErpSyncStatusInline({ tituloId, importadoApi, codigoIntegracao, status }: ErpSyncStatusInlineProps) {
  const qc = useQueryClient();
  const [sending, setSending] = useState(false);

  const { data: syncEntry, isLoading } = useQuery({
    queryKey: ["erp-sync-inline", tituloId],
    queryFn: async () => {
      const { data } = await supabase
        .from("erp_sync_log" as any)
        .select("id, sync_status, created_at, erp_mensagem, operacao")
        .eq("conta_pagar_id", tituloId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    staleTime: 10_000,
  });

  const handleSendToErp = async () => {
    setSending(true);
    try {
      const { error } = await supabase.from("erp_sync_log" as any).insert({
        entity_type: "conta_pagar",
        entity_id: tituloId,
        conta_pagar_id: tituloId,
        action: "export_titulo",
        direction: "outbound",
        sync_status: "pendente",
        tabela_origem: "contas_pagar",
        registro_id: tituloId,
        operacao: "provisao",
      });
      if (error) throw error;
      toast.success("Título adicionado à fila de envio ao ERP");
      qc.invalidateQueries({ queryKey: ["erp-sync-inline", tituloId] });
      qc.invalidateQueries({ queryKey: ["cp-detalhe"] });
    } catch (err: any) {
      console.error("ERP enqueue error:", err);
      toast.error("Erro ao enfileirar: " + (err?.message || ""));
    } finally {
      setSending(false);
    }
  };

  const syncStatus = syncEntry?.sync_status;
  const st = syncStatus ? SYNC_STATUS_MAP[syncStatus] || SYNC_STATUS_MAP.pendente : null;

  return (
    <div className="border-t pt-2 space-y-2">
      <div className="flex justify-between items-center py-1">
        <span className="text-muted-foreground">Status ERP</span>
        <div className="flex items-center gap-2">
          {importadoApi ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs gap-1">
              <CheckCircle2 className="h-3 w-3" /> Sincronizado
            </Badge>
          ) : st ? (
            <Badge className={`${st.cls} border-0 text-xs gap-1`}>
              <st.icon className="h-3 w-3" /> {st.label}
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-700 border-0 text-xs gap-1">
              <Clock className="h-3 w-3" /> Pendente de envio
            </Badge>
          )}
        </div>
      </div>

      {codigoIntegracao && (
        <div className="flex justify-between items-center py-1">
          <span className="text-muted-foreground">Cód. Integração</span>
          <span className="font-medium">{codigoIntegracao}</span>
        </div>
      )}

      {syncEntry?.erp_mensagem && (
        <p className="text-xs text-red-600">{syncEntry.erp_mensagem}</p>
      )}

      {!importadoApi && !syncStatus && status !== "cancelado" && (
        <Button
          size="sm"
          variant="outline"
          className="w-full mt-1 gap-2 text-xs"
          onClick={handleSendToErp}
          disabled={sending}
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
          Enviar ao ERP
        </Button>
      )}

      {syncStatus === "erro" && (
        <Button
          size="sm"
          variant="outline"
          className="w-full mt-1 gap-2 text-xs text-red-600 border-red-200"
          onClick={handleSendToErp}
          disabled={sending}
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
          Reenviar ao ERP
        </Button>
      )}
    </div>
  );
}
