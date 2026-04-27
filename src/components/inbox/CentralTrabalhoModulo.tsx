import { ReactNode, useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useInbox, type InboxOrigem } from "@/hooks/useInbox";
import { useInboxDrawer } from "@/contexts/InboxDrawerContext";
import {
  Inbox, Send, Eye, UserCheck, Users, ExternalLink,
  Archive, Clock, Star, CheckCheck, Keyboard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

interface CentralTrabalhoModuloProps {
  /** Origem da Inbox a focar (filtra automaticamente) */
  origem: InboxOrigem;
  /** Título do módulo (ex.: "Central — Motor de Artes") */
  titulo: string;
  /** Subtítulo opcional descrevendo o ambiente */
  subtitulo?: string;
  /** Cor de marca do módulo (HSL via CSS var ou string css) */
  corModulo?: string;
  /** Ícone do módulo */
  Icon?: React.ComponentType<{ className?: string }>;
  /** Conteúdo extra a renderizar na aba "Visão geral" (ex.: KPIs do módulo) */
  visaoGeral?: ReactNode;
  /** Conteúdo da aba "Equipe" (membros do módulo, fila por pessoa, etc.) */
  equipeContent?: ReactNode;
}

/**
 * Central de Trabalho por Módulo — análoga à Central de Trabalho de Projetos,
 * mas focada na fila do módulo (Aprovações, Motor de Artes, Composição etc.).
 * Usa a Inbox unificada filtrada pela origem do módulo.
 */
export function CentralTrabalhoModulo({
  origem,
  titulo,
  subtitulo,
  corModulo = "hsl(var(--primary))",
  Icon = Inbox,
  visaoGeral,
  equipeContent,
}: CentralTrabalhoModuloProps) {
  const [tab, setTab] = useState<"acao_minha" | "atribuida_a_mim" | "acompanho" | "delegada_por_mim">("acao_minha");
  const { openDrawer } = useInboxDrawer();
  const navigate = useNavigate();

  const { items, counts, isLoading, marcarLido, arquivar } = useInbox({
    caixa: tab,
    origem,
  });

  return (
    <div className="space-y-4">
      {/* Header do módulo */}
      <Card className="p-4 hover:shadow-none hover:translate-y-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-12 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${corModulo}20`, color: corModulo }}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">{titulo}</h1>
              {subtitulo && <p className="text-sm text-muted-foreground mt-0.5">{subtitulo}</p>}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={openDrawer} className="gap-2">
            <Inbox className="h-4 w-4" />
            Abrir Caixa de Entrada global
          </Button>
        </div>
      </Card>

      {/* KPIs rápidos da fila do módulo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Ação minha" value={counts.acao_minha} Icon={Inbox} active={tab === "acao_minha"} onClick={() => setTab("acao_minha")} corModulo={corModulo} />
        <KpiCard label="Atribuídas" value={counts.atribuida_a_mim} Icon={UserCheck} active={tab === "atribuida_a_mim"} onClick={() => setTab("atribuida_a_mim")} corModulo={corModulo} />
        <KpiCard label="Acompanho" value={counts.acompanho} Icon={Eye} active={tab === "acompanho"} onClick={() => setTab("acompanho")} corModulo={corModulo} />
        <KpiCard label="Delegadas" value={counts.delegada_por_mim} Icon={Send} active={tab === "delegada_por_mim"} onClick={() => setTab("delegada_por_mim")} corModulo={corModulo} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="acao_minha">Minha fila</TabsTrigger>
          <TabsTrigger value="atribuida_a_mim">Atribuídas</TabsTrigger>
          <TabsTrigger value="acompanho">Acompanho</TabsTrigger>
          <TabsTrigger value="delegada_por_mim">Delegadas</TabsTrigger>
          {equipeContent && <TabsTrigger value="equipe">Equipe do módulo</TabsTrigger>}
          {visaoGeral && <TabsTrigger value="visao">Visão geral</TabsTrigger>}
        </TabsList>

        {(["acao_minha", "atribuida_a_mim", "acompanho", "delegada_por_mim"] as const).map((k) => (
          <TabsContent key={k} value={k} className="mt-3">
            <Card className="p-0 hover:shadow-none hover:translate-y-0 overflow-hidden">
              <ScrollArea className="h-[calc(100vh-380px)] min-h-[300px]">
                {isLoading ? (
                  <div className="p-12 text-center text-sm text-muted-foreground">Carregando...</div>
                ) : items.length === 0 ? (
                  <div className="p-12 text-center text-sm text-muted-foreground">
                    <Icon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    Nada nesta caixa. Bom trabalho!
                  </div>
                ) : (
                  <ul className="divide-y">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className={cn(
                          "p-3 hover:bg-muted/40 transition-colors flex items-start gap-3 group",
                          !item.lido_em && "bg-primary/[0.03]"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {item.modo_leitura === "acao" && (
                              <Badge className="text-[10px] bg-warning/15 text-warning border-0 hover:bg-warning/20">
                                Requer ação
                              </Badge>
                            )}
                            {!item.lido_em && <span className="h-2 w-2 rounded-full bg-primary" />}
                            <span className="text-[11px] text-muted-foreground">
                              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                            </span>
                            {item.favorito && <Star className="h-3 w-3 text-warning fill-warning" />}
                          </div>
                          <p className={cn("text-sm leading-snug", !item.lido_em && "font-semibold")}>
                            {item.titulo}
                          </p>
                          {item.resumo && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.resumo}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.action_url && (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-8 gap-1.5"
                              onClick={() => {
                                if (item.modo_leitura === "auto" && !item.lido_em) marcarLido([item.id]);
                                navigate(item.action_url!);
                              }}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Abrir
                            </Button>
                          )}
                          {!item.lido_em && (
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Marcar como lido" onClick={() => marcarLido([item.id])}>
                              <CheckCheck className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Arquivar" onClick={() => arquivar([item.id])}>
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </Card>
          </TabsContent>
        ))}

        {equipeContent && (
          <TabsContent value="equipe" className="mt-3">
            {equipeContent}
          </TabsContent>
        )}
        {visaoGeral && (
          <TabsContent value="visao" className="mt-3">
            {visaoGeral}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function KpiCard({ label, value, Icon, active, onClick, corModulo }: {
  label: string; value: number; Icon: React.ComponentType<{ className?: string }>;
  active: boolean; onClick: () => void; corModulo: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-[10px] border bg-card p-3 text-left transition-all flex items-center justify-between gap-3",
        "hover:shadow-md hover:-translate-y-[1px]",
        active && "ring-2 ring-primary/40"
      )}
      style={active ? { borderColor: corModulo } : undefined}
    >
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-display font-bold mt-0.5">{value}</p>
      </div>
      <div
        className="h-10 w-10 rounded-md flex items-center justify-center"
        style={{ backgroundColor: `${corModulo}15`, color: corModulo }}
      >
        <Icon className="h-5 w-5" />
      </div>
    </button>
  );
}
