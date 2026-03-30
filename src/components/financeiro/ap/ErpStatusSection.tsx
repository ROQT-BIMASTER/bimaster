import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface ErpStatusSectionProps {
  tituloId: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "Na Fila", color: "bg-yellow-100 text-yellow-800" },
  processing: { label: "Processando", color: "bg-blue-100 text-blue-800" },
  exported: { label: "Exportado", color: "bg-blue-100 text-blue-800" },
  confirmed: { label: "Confirmado ERP", color: "bg-green-100 text-green-800" },
  error: { label: "Erro", color: "bg-red-100 text-red-800" },
  cancelled: { label: "Cancelado", color: "bg-gray-100 text-gray-700" },
};

export function ErpStatusSection({ tituloId }: ErpStatusSectionProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["erp-status", tituloId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("erp_export_queue" as any)
        .select("*")
        .eq("conta_pagar_id", tituloId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Nenhum registro de exportação ERP encontrado.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">
        Histórico de Exportação ERP
      </h4>
      <div className="relative border-l-2 border-muted pl-4 space-y-4">
        {data.map((entry: any) => {
          const st = STATUS_MAP[entry.status] || STATUS_MAP.pending;
          return (
            <div key={entry.id} className="relative">
              <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {entry.created_at &&
                  format(new Date(entry.created_at), "dd/MM/yyyy HH:mm")}
                <Badge className={`${st.color} text-[10px] px-1.5 py-0`}>
                  {st.label}
                </Badge>
                {entry.export_type && (
                  <span className="text-[10px] text-muted-foreground/70">
                    ({entry.export_type})
                  </span>
                )}
              </div>
              {entry.erp_reference && (
                <p className="text-xs mt-0.5">Ref ERP: {entry.erp_reference}</p>
              )}
              {entry.error_message && (
                <p className="text-xs text-destructive mt-0.5">
                  {entry.error_message}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
