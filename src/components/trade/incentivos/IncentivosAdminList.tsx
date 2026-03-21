import { useTradeIncentivos, useDeleteIncentivo, type TradeIncentivo } from "@/hooks/useTradeIncentivos";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { useUpdateIncentivo } from "@/hooks/useTradeIncentivos";

interface Props {
  onEdit: (incentivo: TradeIncentivo) => void;
}

function getStatus(incentivo: TradeIncentivo) {
  if (!incentivo.ativo) return { label: "Inativo", color: "bg-muted text-muted-foreground" };
  const today = new Date().toISOString().split("T")[0];
  if (incentivo.data_inicio > today) return { label: "Agendado", color: "bg-blue-100 text-blue-700" };
  if (incentivo.data_fim < today) return { label: "Expirado", color: "bg-red-100 text-red-700" };
  return { label: "Em andamento", color: "bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(330,81%,60%)] text-white" };
}

export function IncentivosAdminList({ onEdit }: Props) {
  const { data: incentivos, isLoading } = useTradeIncentivos();
  const deleteIncentivo = useDeleteIncentivo();
  const updateIncentivo = useUpdateIncentivo();

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-3">
      {incentivos?.map((incentivo) => {
        const status = getStatus(incentivo);
        return (
          <div key={incentivo.id} className="bg-card border rounded-2xl p-4 flex items-center gap-4">
            <span className="text-3xl">{incentivo.icone}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-sm">{incentivo.titulo}</h4>
                <Badge className={`text-[10px] border-0 ${status.color}`}>{status.label}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {incentivo.tipo} · Meta: {incentivo.meta_valor} {incentivo.meta_unidade} · {format(new Date(incentivo.data_inicio), "dd/MM", { locale: ptBR })} — {format(new Date(incentivo.data_fim), "dd/MM", { locale: ptBR })}
              </p>
              {incentivo.recompensa && (
                <p className="text-xs text-[hsl(330,81%,60%)] font-medium mt-0.5">🎁 {incentivo.recompensa}</p>
              )}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button size="icon" variant="ghost" onClick={() => onEdit(incentivo)}><Edit className="h-4 w-4" /></Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => updateIncentivo.mutate({ id: incentivo.id, ativo: !incentivo.ativo })}
              >
                {incentivo.ativo ? <ToggleRight className="h-4 w-4 text-success" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
              </Button>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteIncentivo.mutate(incentivo.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
      {!incentivos?.length && (
        <div className="text-center py-8 text-muted-foreground">Nenhum incentivo cadastrado</div>
      )}
    </div>
  );
}
