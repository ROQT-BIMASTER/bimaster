import { useNavigate } from "react-router-dom";
import { Plus, List, CheckCircle, ShoppingCart, PackageCheck, AlertTriangle, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BilingualLabel } from "@/components/china/BilingualLabel";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABELS } from "@/lib/china-document-types";
import { useChinaUserContext } from "@/hooks/useChinaUserContext";
import { ManualFabricaDrawer } from "@/components/fabrica/ManualFabricaDrawer";
import { ChinaPageShell } from "@/components/china/ChinaPageShell";
import { ChinaPageHeader } from "@/components/china/ChinaPageHeader";
import { KpiCard } from "@/components/ui/kpi-card";
import { cn } from "@/lib/utils";

export default function ChinaFabrica() {
  const navigate = useNavigate();
  const { isBrasilUser, isChinaUser } = useChinaUserContext();

  const { data: stats, isLoading: loadingStats } = useQuery({
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

  const { data: ocStats, isLoading: loadingOc } = useQuery({
    queryKey: ["china-oc-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("china_ordens_compra" as any)
        .select("status");
      const items = (data || []) as any[];
      return {
        total: items.length,
        pendentes: items.filter((s: any) => s.status === "rascunho").length,
        ativas: items.filter((s: any) => ["aprovada", "emitida", "em_producao", "parcial"].includes(s.status)).length,
        concluidas: items.filter((s: any) => s.status === "concluida").length,
      };
    },
  });

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["china-pending-actions"],
    enabled: isChinaUser,
    queryFn: async () => {
      const { data: rejDocs } = await supabase
        .from("china_produto_documentos" as any)
        .select("submissao_id")
        .eq("status", "rejeitado");
      const rejSubmIds = new Set((rejDocs || []).map((d: any) => d.submissao_id));
      const rejectedSubs = (stats?.rejeitado || 0);
      return rejSubmIds.size + rejectedSubs;
    },
  });

  const loading = loadingStats || loadingOc;

  // KPIs (substituem os 6 cards antigos com cores fixas)
  const kpis = [
    {
      title: "Submissões totais",
      value: stats?.total ?? 0,
      icon: List,
      variant: "default" as const,
      onClick: () => navigate("/dashboard/fabrica-china/recebimentos"),
      subtitle: "我的提交",
      hidden: false,
    },
    {
      title: "Em revisão",
      value: stats?.em_revisao ?? 0,
      icon: AlertTriangle,
      variant: "warning" as const,
      onClick: () => navigate("/dashboard/fabrica-china/recebimentos?status=em_revisao"),
      subtitle: "审核中",
      hidden: false,
    },
    {
      title: "Aprovados",
      value: stats?.aprovado ?? 0,
      icon: CheckCircle,
      variant: "success" as const,
      onClick: () => navigate("/dashboard/fabrica-china/recebimentos?status=aprovado"),
      subtitle: "已批准",
      hidden: false,
    },
    {
      title: "OC ativas",
      value: ocStats?.ativas ?? 0,
      icon: ShoppingCart,
      variant: "info" as const,
      onClick: () => navigate("/dashboard/fabrica-china/ordens"),
      subtitle: `${ocStats?.pendentes ?? 0} pendentes · ${ocStats?.concluidas ?? 0} concluídas`,
      hidden: false,
    },
    {
      title: "Envios oficiais",
      value: stats?.arte_enviada ?? 0,
      icon: PackageCheck,
      variant: "accent" as const,
      onClick: () => navigate("/dashboard/fabrica-china/recebimentos?status=arte_enviada"),
      subtitle: "发送至巴西",
      hidden: !isBrasilUser,
    },
    {
      title: "Pendências (China)",
      value: pendingCount,
      icon: Inbox,
      variant: "destructive" as const,
      onClick: () => navigate("/dashboard/fabrica-china/recebimentos"),
      subtitle: "待处理",
      hidden: !isChinaUser || pendingCount === 0,
    },
  ].filter((k) => !k.hidden);

  // Ações rápidas em destaque
  const quickActions = [
    {
      icon: Plus,
      labelPt: "Nova Submissão",
      labelCn: "新提交",
      desc: "Enviar novo produto 提交新产品",
      onClick: () => navigate("/dashboard/fabrica-china/nova"),
      tone: "primary" as const,
    },
    {
      icon: List,
      labelPt: "Minhas Submissões",
      labelCn: "我的提交",
      desc: `${stats?.total || 0} no total · 提交`,
      onClick: () => navigate("/dashboard/fabrica-china/recebimentos"),
      tone: "warning" as const,
    },
    {
      icon: ShoppingCart,
      labelPt: "Ordens de Compra",
      labelCn: "采购订单",
      desc: isBrasilUser
        ? `${ocStats?.pendentes || 0} pendentes · ${ocStats?.ativas || 0} ativas`
        : `${ocStats?.ativas || 0} ativas · ${ocStats?.concluidas || 0} concluídas`,
      onClick: () => navigate("/dashboard/fabrica-china/ordens"),
      tone: "primary" as const,
      badge: isBrasilUser && (ocStats?.pendentes || 0) > 0 ? ocStats?.pendentes : null,
    },
    ...(isBrasilUser
      ? [
          {
            icon: PackageCheck,
            labelPt: "Envios ao Brasil",
            labelCn: "发送至巴西",
            desc: `${stats?.arte_enviada || 0} envios oficiais 官方发送`,
            onClick: () => navigate("/dashboard/fabrica-china/recebimentos?status=arte_enviada"),
            tone: "success" as const,
          },
        ]
      : []),
  ];

  const TONE_CARD: Record<string, string> = {
    primary: "bg-primary/5 hover:bg-primary/10 border-primary/20",
    warning: "bg-warning/5 hover:bg-warning/10 border-warning/20",
    success: "bg-success/5 hover:bg-success/10 border-success/20",
  };
  const TONE_ICON: Record<string, string> = {
    primary: "text-primary",
    warning: "text-warning",
    success: "text-success",
  };

  return (
    <ChinaPageShell>
      <ChinaPageHeader
        titlePt="Fábrica China"
        titleCn="中国工厂"
        subtitle="Portal de Submissão · 提交门户"
        actions={<ManualFabricaDrawer screen="china-painel" />}
      />

      {/* KPIs (padrão Projetos / Central) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <KpiCard key={i} title="" value="" loading />
            ))
          : kpis.map((k, i) => (
              <KpiCard
                key={i}
                title={k.title}
                value={k.value}
                subtitle={k.subtitle}
                icon={k.icon}
                variant={k.variant}
                onClick={k.onClick}
                className="animate-fade-in"
              />
            ))}
      </div>

      {/* Ações rápidas em destaque */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <BilingualLabel pt="Ações rápidas" cn="快捷操作" size="md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((card, i) => {
            const Icon = card.icon;
            return (
              <Card
                key={i}
                className={cn(
                  "cursor-pointer transition-all duration-200 p-6 flex flex-col items-center gap-3 text-center relative animate-fade-in",
                  TONE_CARD[card.tone],
                )}
                onClick={card.onClick}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {(card as any).badge && (
                  <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center shadow-lg">
                    {(card as any).badge}
                  </div>
                )}
                <div className="h-16 w-16 rounded-2xl bg-background flex items-center justify-center shadow-sm">
                  <Icon className={cn("h-8 w-8", TONE_ICON[card.tone])} />
                </div>
                <BilingualLabel pt={card.labelPt} cn={card.labelCn} size="md" className="items-center" />
                <p className="text-xs text-muted-foreground">{card.desc}</p>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Status Summary */}
      {stats && stats.total > 0 && (
        <Card className="p-5">
          <BilingualLabel pt="Resumo de Status" cn="状态摘要" size="md" className="mb-4" />
          <div className="flex flex-wrap gap-2">
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <Badge key={key} variant={label.variant} className="text-xs px-2.5 py-1 gap-1">
                {label.pt} {label.cn}: {(stats as any)[key] || 0}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Aviso sobre comunicação */}
      <Card className="p-4 bg-muted/40 border-dashed">
        <div className="flex items-start gap-3">
          <Inbox className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-sm space-y-1">
            <p className="font-medium text-foreground">
              Comunicação China–Brasil unificada
            </p>
            <p className="text-xs text-muted-foreground">
              Reduza o uso de e-mail, WhatsApp e planilhas. Use o chat de cada submissão,
              a Caixa de Entrada (atalho <kbd className="px-1 py-0.5 rounded bg-background border text-[10px]">i</kbd>) e o
              botão flutuante no canto inferior direito para conversar diretamente no sistema. 减少邮件 / 微信 / 表格的使用。
            </p>
          </div>
        </div>
      </Card>
    </ChinaPageShell>
  );
}
