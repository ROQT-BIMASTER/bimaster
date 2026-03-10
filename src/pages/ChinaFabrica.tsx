import { useNavigate } from "react-router-dom";
import { Plus, List, CheckCircle, Factory, ArrowLeft, ShoppingCart, Send, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BilingualLabel } from "@/components/china/BilingualLabel";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABELS } from "@/lib/china-document-types";
import { useChinaUserContext } from "@/hooks/useChinaUserContext";

export default function ChinaFabrica() {
  const navigate = useNavigate();
  const { isBrasilUser, isChinaUser } = useChinaUserContext();

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
        arte_enviada: items.filter((s: any) => s.status === "arte_enviada").length,
      };
    },
  });

  const { data: ocStats } = useQuery({
    queryKey: ["china-oc-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("china_ordens_compra" as any)
        .select("status");
      const items = (data || []) as any[];
      return {
        total: items.length,
        ativas: items.filter((s: any) => ["emitida", "em_producao", "parcial"].includes(s.status)).length,
        concluidas: items.filter((s: any) => s.status === "concluida").length,
      };
    },
  });

  // Pending actions count for China users
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["china-pending-actions"],
    enabled: isChinaUser,
    queryFn: async () => {
      const { data: rejDocs } = await supabase
        .from("china_produto_documentos" as any)
        .select("submissao_id")
        .eq("status", "rejeitado");
      const rejSubmIds = new Set((rejDocs || []).map((d: any) => d.submissao_id));
      // Also count rejected submissions
      const rejectedSubs = (stats?.rejeitado || 0);
      return rejSubmIds.size + rejectedSubs;
    },
  });

  const allCards = [
    {
      icon: <Plus className="h-10 w-10 text-primary" />,
      labelPt: "Nova Submissão",
      labelCn: "新提交",
      desc: "Enviar novo produto 提交新产品",
      onClick: () => navigate("/dashboard/fabrica-china/nova"),
      color: "bg-primary/5 hover:bg-primary/10 border-primary/20",
      brasilOnly: false,
      badge: null,
    },
    {
      icon: <List className="h-10 w-10 text-warning" />,
      labelPt: "Minhas Submissões",
      labelCn: "我的提交",
      desc: `${stats?.total || 0} submissões 提交`,
      onClick: () => navigate("/dashboard/fabrica-china/recebimentos"),
      color: "bg-warning/5 hover:bg-warning/10 border-warning/20",
      brasilOnly: false,
      badge: null,
    },
    ...(isChinaUser && pendingCount > 0
      ? [
          {
            icon: <AlertTriangle className="h-10 w-10 text-destructive" />,
            labelPt: "Pendências",
            labelCn: "待处理",
            desc: `${pendingCount} item(ns) precisam da sua ação`,
            onClick: () => navigate("/dashboard/fabrica-china/recebimentos"),
            color: "bg-destructive/5 hover:bg-destructive/10 border-destructive/30 animate-pulse",
            brasilOnly: false,
            badge: pendingCount,
          },
        ]
      : []),
    {
      icon: <CheckCircle className="h-10 w-10 text-success" />,
      labelPt: "Aprovados",
      labelCn: "已批准",
      desc: `${stats?.aprovado || 0} aprovados 已批准`,
      onClick: () => navigate("/dashboard/fabrica-china/recebimentos"),
      color: "bg-success/5 hover:bg-success/10 border-success/20",
      brasilOnly: false,
      badge: null,
    },
    {
      icon: <ShoppingCart className="h-10 w-10 text-primary" />,
      labelPt: "Ordens de Compra",
      labelCn: "采购订单",
      desc: isBrasilUser 
        ? `${ocStats?.pendentes || 0} pendentes · ${ocStats?.ativas || 0} ativas · ${ocStats?.concluidas || 0} concluídas`
        : `${ocStats?.ativas || 0} ativas 活跃 · ${ocStats?.concluidas || 0} concluídas 已完成`,
      badge: isBrasilUser && (ocStats?.pendentes || 0) > 0 ? ocStats?.pendentes : null,
      onClick: () => navigate("/dashboard/fabrica-china/ordens"),
      color: "bg-primary/5 hover:bg-primary/10 border-primary/20",
      brasilOnly: false,
      badge: null,
    },
    {
      icon: <Send className="h-10 w-10 text-success" />,
      labelPt: "Arte Enviada",
      labelCn: "终稿已发送",
      desc: `${stats?.arte_enviada || 0} artes enviadas 终稿已发送`,
      onClick: () => navigate("/dashboard/fabrica-china/recebimentos"),
      color: "bg-success/5 hover:bg-success/10 border-success/20",
      brasilOnly: true,
      badge: null,
    },
  ];

  const cards = allCards.filter(c => !c.brasilOnly || isBrasilUser);

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card, i) => (
            <Card
              key={i}
              className={`cursor-pointer transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center relative ${card.color}`}
              onClick={card.onClick}
            >
              {card.badge && (
                <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center shadow-lg">
                  {card.badge}
                </div>
              )}
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
