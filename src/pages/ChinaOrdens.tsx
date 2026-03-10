import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShoppingCart, Loader2, Package, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BilingualLabel } from "@/components/china/BilingualLabel";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useChinaUserContext } from "@/hooks/useChinaUserContext";

const OC_STATUS: Record<string, { pt: string; cn: string; variant: "default" | "secondary" | "success" | "destructive" | "warning" }> = {
  rascunho: { pt: "Rascunho", cn: "草稿", variant: "secondary" },
  aprovada: { pt: "Aprovada", cn: "已批准", variant: "default" },
  rejeitada: { pt: "Rejeitada", cn: "已拒绝", variant: "destructive" },
  emitida: { pt: "Emitida", cn: "已发出", variant: "default" },
  em_producao: { pt: "Em Produção", cn: "生产中", variant: "warning" },
  parcial: { pt: "Parcial", cn: "部分完成", variant: "warning" },
  concluida: { pt: "Concluída", cn: "已完成", variant: "success" },
  cancelada: { pt: "Cancelada", cn: "已取消", variant: "destructive" },
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

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/fabrica-china")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ShoppingCart className="h-8 w-8 text-primary" />
            </div>
            <BilingualLabel pt="Ordens de Compra" cn="采购订单" size="lg" />
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : ordens.length === 0 ? (
          <Card className="p-12 flex flex-col items-center text-center">
            <Package className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <BilingualLabel pt="Nenhuma ordem de compra" cn="没有采购订单" size="lg" className="items-center" />
          </Card>
        ) : (
          <div className="space-y-4">
            {ordens.map((oc: any) => {
              const pct = oc.qty_total > 0 ? Math.round((oc.qty_produzida / oc.qty_total) * 100) : 0;
              const statusInfo = OC_STATUS[oc.status] || OC_STATUS.emitida;
              return (
                <Card
                  key={oc.id}
                  className="p-5 cursor-pointer hover:shadow-lg transition-all"
                  onClick={() => navigate(`/dashboard/fabrica-china/ordens/${oc.id}`)}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-foreground">{oc.numero_oc}</span>
                        <Badge variant={statusInfo.variant} className="text-[10px]">
                          {statusInfo.pt} {statusInfo.cn}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{oc.produto_codigo} — {oc.produto_nome}</p>
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
                  <Progress value={pct} gradient className="h-3" />
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
