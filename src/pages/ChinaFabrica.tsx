import { useNavigate } from "react-router-dom";
import { Plus, List, CheckCircle, Factory, ArrowLeft, ShoppingCart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BilingualLabel } from "@/components/china/BilingualLabel";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABELS } from "@/lib/china-document-types";

export default function ChinaFabrica() {
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ["china-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("china_produto_submissoes" as any)
        .select("status");
      const items = (data || []) as any[];
      return {
        total: items.length,
        rascunho: items.filter((s: any) => s.status === "rascunho").length,
        enviado: items.filter((s: any) => s.status === "enviado").length,
        em_revisao: items.filter((s: any) => s.status === "em_revisao").length,
        aprovado: items.filter((s: any) => s.status === "aprovado").length,
        rejeitado: items.filter((s: any) => s.status === "rejeitado").length,
      };
    },
  });

  const cards = [
    {
      icon: <Plus className="h-10 w-10 text-primary" />,
      labelPt: "Nova Submissão",
      labelCn: "新提交",
      desc: "Enviar novo produto 提交新产品",
      onClick: () => navigate("/dashboard/fabrica-china/nova"),
      color: "bg-primary/5 hover:bg-primary/10 border-primary/20",
    },
    {
      icon: <List className="h-10 w-10 text-warning" />,
      labelPt: "Minhas Submissões",
      labelCn: "我的提交",
      desc: `${stats?.total || 0} submissões 提交`,
      onClick: () => navigate("/dashboard/fabrica-china/recebimentos"),
      color: "bg-warning/5 hover:bg-warning/10 border-warning/20",
    },
    {
      icon: <CheckCircle className="h-10 w-10 text-success" />,
      labelPt: "Aprovados",
      labelCn: "已批准",
      desc: `${stats?.aprovado || 0} aprovados 已批准`,
      onClick: () => navigate("/dashboard/fabrica-china/recebimentos"),
      color: "bg-success/5 hover:bg-success/10 border-success/20",
    },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/fabrica")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <Factory className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Fábrica China</h1>
              <p className="text-lg text-muted-foreground">中国工厂 · Portal de Submissão 提交门户</p>
            </div>
          </div>
        </div>

        {/* Main Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card, i) => (
            <Card
              key={i}
              className={`cursor-pointer transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center ${card.color}`}
              onClick={card.onClick}
            >
              <div className="h-20 w-20 rounded-2xl bg-background flex items-center justify-center shadow-sm">
                {card.icon}
              </div>
              <BilingualLabel pt={card.labelPt} cn={card.labelCn} size="lg" className="items-center" />
              <p className="text-sm text-muted-foreground">{card.desc}</p>
            </Card>
          ))}
        </div>

        {/* Status Summary */}
        {stats && stats.total > 0 && (
          <Card className="p-6">
            <BilingualLabel pt="Resumo de Status" cn="状态摘要" size="md" className="mb-4" />
            <div className="flex flex-wrap gap-3">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <Badge key={key} variant={label.variant} className="text-sm px-3 py-1 gap-1">
                  {label.pt} {label.cn}: {(stats as any)[key] || 0}
                </Badge>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
