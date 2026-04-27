import { useNavigate } from "react-router-dom";
import { ShoppingCart, Loader2, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BilingualLabel } from "@/components/china/BilingualLabel";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useChinaUserContext } from "@/hooks/useChinaUserContext";
import { ManualFabricaDrawer } from "@/components/fabrica/ManualFabricaDrawer";
import { ChinaPageShell } from "@/components/china/ChinaPageShell";
import { ChinaPageHeader } from "@/components/china/ChinaPageHeader";
import { EmptyState } from "@/components/ui/empty-state";

const OC_STATUS: Record<
  string,
  { pt: string; cn: string; variant: "default" | "secondary" | "success" | "destructive" | "warning"; bar: string }
> = {
  rascunho: { pt: "Rascunho", cn: "草稿", variant: "secondary", bar: "border-l-muted-foreground/40" },
  aprovada: { pt: "Aprovada", cn: "已批准", variant: "default", bar: "border-l-primary" },
  rejeitada: { pt: "Rejeitada", cn: "已拒绝", variant: "destructive", bar: "border-l-destructive" },
  emitida: { pt: "Emitida", cn: "已发出", variant: "default", bar: "border-l-primary" },
  em_producao: { pt: "Em Produção", cn: "生产中", variant: "warning", bar: "border-l-warning" },
  parcial: { pt: "Parcial", cn: "部分完成", variant: "warning", bar: "border-l-warning" },
  concluida: { pt: "Concluída", cn: "已完成", variant: "success", bar: "border-l-success" },
  cancelada: { pt: "Cancelada", cn: "已取消", variant: "destructive", bar: "border-l-destructive" },
};

export default function ChinaOrdens() {
  const navigate = useNavigate();
  const { isChinaUser } = useChinaUserContext();

  const { data: ordens = [], isLoading } = useQuery({
    queryKey: ["china-ordens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_ordens_compra" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const visible = (ordens as any[]).filter(
    (oc) => !isChinaUser || !["rascunho", "rejeitada"].includes(oc.status),
  );

  return (
    <ChinaPageShell>
      <ChinaPageHeader
        titlePt="Ordens de Compra"
        titleCn="采购订单"
        icon={ShoppingCart}
        iconTone="primary"
        showBack
        backTo="/dashboard/fabrica-china"
        actions={<ManualFabricaDrawer screen="china-ordens" />}
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={Package}
            title="Nenhuma ordem de compra"
            description="没有采购订单 — quando uma OC for emitida pelo Brasil ela aparecerá aqui."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((oc: any) => {
            const pct = oc.qty_total > 0 ? Math.round((oc.qty_produzida / oc.qty_total) * 100) : 0;
            const statusInfo = OC_STATUS[oc.status] || OC_STATUS.emitida;
            return (
              <Card
                key={oc.id}
                className={`p-5 cursor-pointer hover:shadow-soft-lg hover:-translate-y-0.5 transition-all border-l-[3px] ${statusInfo.bar} animate-fade-in`}
                onClick={() => navigate(`/dashboard/fabrica-china/ordens/${oc.id}`)}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-lg text-foreground">{oc.numero_oc}</span>
                      <Badge variant={statusInfo.variant} className="text-[10px]">
                        {statusInfo.pt} {statusInfo.cn}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {oc.produto_codigo} — {oc.produto_nome}
                    </p>
                    {oc.data_entrega_prevista && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Entrega 交货: {new Date(oc.data_entrega_prevista).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-primary">{pct}%</p>
                    <p className="text-xs text-muted-foreground">
                      {oc.qty_produzida?.toLocaleString()} / {oc.qty_total?.toLocaleString()}
                    </p>
                  </div>
                </div>
                <Progress value={pct} gradient className="h-2.5" />
              </Card>
            );
          })}
        </div>
      )}
    </ChinaPageShell>
  );
}
