import { ReactNode, useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { useInbox, type InboxOrigem } from "@/hooks/useInbox";
import { useInboxDrawer } from "@/contexts/InboxDrawerContext";
import {
  Inbox, Send, Eye, UserCheck, ExternalLink,
  Archive, Star, CheckCheck, Keyboard, ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { usePageBgColor } from "@/hooks/usePageBgColor";
import { getBgPaletteVars } from "@/lib/colorUtils";
import { ProjetoBgColorPicker } from "@/components/projetos/ProjetoBgColorPicker";

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
  Icon?: LucideIcon;
  /** Conteúdo extra a renderizar na aba "Visão geral" (ex.: KPIs do módulo) */
  visaoGeral?: ReactNode;
  /** Conteúdo da aba "Equipe" (membros do módulo, fila por pessoa, etc.) */
  equipeContent?: ReactNode;
}

/**
 * Central de Trabalho por Módulo — alinhada visualmente ao módulo Projetos
 * (CentralHeader / CentralKPIs / ProjetoInboxFeed). A lógica, atalhos e
 * mutations permanecem idênticos.
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { bgColor, setBgColor } = usePageBgColor(`central_${origem}`);

  // Pop-up de atalhos: abre automaticamente na primeira visita por módulo
  const shortcutKey = `central-shortcuts-seen-${origem}`;
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(shortcutKey)) {
      setShortcutsOpen(true);
      localStorage.setItem(shortcutKey, "1");
    }
  }, [shortcutKey]);

  const { items, counts, isLoading, marcarLido, arquivar } = useInbox({
    caixa: tab,
    origem,
  });

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  // Atalhos de teclado: j/k para navegar, e para arquivar, ? para abrir modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (!items.length) return;
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const idx = items.findIndex((i) => i.id === (selectedItem?.id ?? ""));
        const next = e.key === "j" ? Math.min(items.length - 1, idx + 1) : Math.max(0, idx - 1);
        if (items[next]) setSelectedId(items[next].id);
      }
      if (e.key === "e" && selectedItem) {
        e.preventDefault();
        arquivar([selectedItem.id]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [items, selectedItem, arquivar]);

  return (
    <div
      className="space-y-4 w-full max-w-none"
      style={
        bgColor
          ? ({
              backgroundColor: bgColor,
              minHeight: "100vh",
              width: "100%",
              color: "hsl(var(--foreground))",
              ...getBgPaletteVars(bgColor),
            } as React.CSSProperties)
          : { width: "100%" }
      }
    >
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} titulo={titulo} />

      {/* Header alinhado ao padrão do CentralHeader (Projetos) */}
      <Card>
        <CardContent className="p-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-9 w-9 flex-shrink-0"
              title="Voltar"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div
              className="h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${corModulo}1A`, color: corModulo }}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              {subtitulo && (
                <p className="text-xs text-muted-foreground truncate">{subtitulo}</p>
              )}
              <h1 className="font-display text-2xl font-bold text-foreground truncate">
                {titulo}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ProjetoBgColorPicker value={bgColor} onChange={setBgColor} />
            <Button variant="outline" size="sm" onClick={() => setShortcutsOpen(true)} className="gap-1.5" title="Atalhos (?)">
              <Keyboard className="h-4 w-4" />
              <span className="hidden sm:inline">Atalhos</span>
            </Button>
            <Button variant="outline" size="sm" onClick={openDrawer} className="gap-1.5">
              <Inbox className="h-4 w-4" />
              <span className="hidden sm:inline">Caixa de Entrada global</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs no padrão CentralKPIs — usa o componente compartilhado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Ação minha"
          value={counts.acao_minha}
          icon={Inbox}
          variant="info"
          subtitle="dependem de você"
          loading={isLoading}
          onClick={() => setTab("acao_minha")}
          className={tab === "acao_minha" ? "ring-2 ring-primary/40" : undefined}
        />
        <KpiCard
          title="Atribuídas"
          value={counts.atribuida_a_mim}
          icon={UserCheck}
          variant="default"
          subtitle="você é responsável"
          loading={isLoading}
          onClick={() => setTab("atribuida_a_mim")}
          className={tab === "atribuida_a_mim" ? "ring-2 ring-primary/40" : undefined}
        />
        <KpiCard
          title="Acompanho"
          value={counts.acompanho}
          icon={Eye}
          variant="accent"
          subtitle="observador / CC"
          loading={isLoading}
          onClick={() => setTab("acompanho")}
          className={tab === "acompanho" ? "ring-2 ring-primary/40" : undefined}
        />
        <KpiCard
          title="Delegadas"
          value={counts.delegada_por_mim}
          icon={Send}
          variant="warning"
          subtitle="você delegou"
          loading={isLoading}
          onClick={() => setTab("delegada_por_mim")}
          className={tab === "delegada_por_mim" ? "ring-2 ring-primary/40" : undefined}
        />
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
            <Card className="overflow-hidden">
              <ScrollArea className="h-[calc(100vh-380px)] min-h-[300px]">
                {isLoading ? (
                  <FilaSkeleton />
                ) : items.length === 0 ? (
                  <EmptyState
                    icon={Icon}
                    title="Nada nesta caixa"
                    description="Quando algo precisar da sua atenção neste módulo, aparecerá aqui."
                    className="py-20"
                  />
                ) : (
                  <ul className="divide-y divide-border/30">
                    {items.map((item, idx) => (
                      <li
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={cn(
                          "relative flex items-start gap-3 px-4 py-3 transition-all border-l-[3px] cursor-pointer group animate-fade-in",
                          !item.lido_em && "bg-primary/[0.04]",
                          selectedItem?.id === item.id
                            ? "bg-primary/10 ring-1 ring-primary/30"
                            : "hover:bg-muted/40",
                        )}
                        style={{
                          animationDelay: `${idx * 25}ms`,
                          borderLeftColor: corModulo,
                        }}
                      >
                        {/* Bolinha não-lido */}
                        <div className="w-2 pt-2 flex-shrink-0">
                          {!item.lido_em && (
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                          )}
                        </div>

                        {/* Pílula de tipo (cor do módulo) */}
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: `${corModulo}26`, color: corModulo }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>

                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {item.modo_leitura === "acao" && (
                              <Badge variant="warning" className="h-4 text-[10px] px-1.5">
                                Requer ação
                              </Badge>
                            )}
                            {item.favorito && <Star className="h-3 w-3 text-warning fill-warning" />}
                            <span className="text-[11px] text-muted-foreground">
                              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                            </span>
                          </div>
                          <p className={cn("text-sm leading-snug", !item.lido_em && "font-semibold")}>
                            {item.titulo}
                          </p>
                          {item.resumo && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 bg-muted/30 rounded px-2 py-1 border-l-2 border-muted-foreground/20">
                              {item.resumo}
                            </p>
                          )}
                        </div>

                        {/* Ações rápidas */}
                        <div
                          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
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

/** Skeleton dos itens da fila — mesmo ritmo do FeedSkeleton de Projetos. */
function FilaSkeleton() {
  return (
    <div className="divide-y divide-border/30">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3">
          <Skeleton className="h-2 w-2 rounded-full mt-2" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-3 w-16 rounded-md" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function ShortcutsDialog({
  open, onOpenChange, titulo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titulo: string;
}) {
  const shortcuts: { keys: string[]; label: string }[] = [
    { keys: ["j"], label: "Mover seleção para o próximo item" },
    { keys: ["k"], label: "Mover seleção para o item anterior" },
    { keys: ["e"], label: "Arquivar item selecionado" },
    { keys: ["?"], label: "Abrir esta janela de atalhos" },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Keyboard className="h-5 w-5 text-primary" />
            Atalhos da Central
          </DialogTitle>
          <DialogDescription>
            Atalhos disponíveis nesta {titulo.toLowerCase()}. Eles funcionam quando você não está digitando em um campo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {shortcuts.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm">{s.label}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd key={k} className="px-2 py-0.5 rounded border bg-background font-mono text-xs shadow-sm">
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Dica: pressione <kbd className="px-1 py-0.5 rounded border bg-muted font-mono">i</kbd> de qualquer tela para abrir a Caixa de Entrada global.
        </p>
      </DialogContent>
    </Dialog>
  );
}
