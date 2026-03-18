import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Clock, UserCircle, Plus, FilePen, ShieldCheck, XCircle, FileText,
  ArrowRight, Package, Loader2, Filter, ChevronDown, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProductProcess } from "@/hooks/useProductProcess";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Props {
  produtoTipo: "china" | "brasil" | "fabrica";
  produtoRefId: string;
  maxHeight?: string;
}

const EVENT_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  INSERT: { icon: Plus, color: "text-emerald-500", label: "Cadastro" },
  UPDATE: { icon: FilePen, color: "text-blue-500", label: "Alteração" },
  criacao: { icon: Plus, color: "text-emerald-500", label: "Criação" },
  edicao: { icon: FilePen, color: "text-blue-500", label: "Edição" },
  aprovacao: { icon: ShieldCheck, color: "text-emerald-500", label: "Aprovação" },
  aprovado: { icon: ShieldCheck, color: "text-emerald-500", label: "Aprovado" },
  reprovacao: { icon: XCircle, color: "text-destructive", label: "Reprovação" },
  reprovar: { icon: XCircle, color: "text-destructive", label: "Reprovado" },
  documento: { icon: FileText, color: "text-amber-500", label: "Documento" },
  upload: { icon: FileText, color: "text-blue-400", label: "Upload" },
  etapa_change: { icon: ArrowRight, color: "text-purple-500", label: "Mudança de Etapa" },
  status_change: { icon: ArrowRight, color: "text-purple-400", label: "Status" },
  despacho: { icon: Package, color: "text-primary", label: "Despacho" },
  foto_adicionada: { icon: Plus, color: "text-emerald-400", label: "Foto" },
  fotos_china_importadas: { icon: Plus, color: "text-amber-400", label: "Fotos China" },
};

const MODULE_COLORS: Record<string, string> = {
  fabrica: "bg-orange-500/10 text-orange-600 border-orange-200",
  brasil: "bg-green-500/10 text-green-600 border-green-200",
  china: "bg-red-500/10 text-red-600 border-red-200",
  documentos: "bg-blue-500/10 text-blue-600 border-blue-200",
  aprovacao: "bg-purple-500/10 text-purple-600 border-purple-200",
  processo: "bg-primary/10 text-primary border-primary/20",
  manual: "bg-muted text-muted-foreground border-border",
};

export function ProcessoTimeline({ produtoTipo, produtoRefId, maxHeight = "500px" }: Props) {
  const { combinedTimeline, isLoading } = useProductProcess(produtoTipo, produtoRefId);
  const [filterModule, setFilterModule] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Carregando timeline...
      </div>
    );
  }

  const filtered = filterModule
    ? combinedTimeline.filter(e => e.modulo_origem === filterModule)
    : combinedTimeline;

  const modules = [...new Set(combinedTimeline.map(e => e.modulo_origem))];

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (filtered.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Nenhum evento registrado para este produto.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Module filter */}
      {modules.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Button
            variant={filterModule === null ? "default" : "outline"}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => setFilterModule(null)}
          >
            Todos ({combinedTimeline.length})
          </Button>
          {modules.map(mod => (
            <Button
              key={mod}
              variant={filterModule === mod ? "default" : "outline"}
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => setFilterModule(mod)}
            >
              {mod} ({combinedTimeline.filter(e => e.modulo_origem === mod).length})
            </Button>
          ))}
        </div>
      )}

      <ScrollArea style={{ maxHeight }} className="pr-3">
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-border/40" />

          <div className="space-y-0">
            {filtered.map((event, index) => {
              const config = EVENT_CONFIG[event.tipo_evento] || {
                icon: FileText,
                color: "text-muted-foreground",
                label: event.tipo_evento,
              };
              const IconComp = config.icon;
              const moduleClass = MODULE_COLORS[event.modulo_origem] || MODULE_COLORS.manual;
              const metadata = event.metadata || {};
              const hasMetadata = Object.keys(metadata).length > 0 &&
                !Object.values(metadata).every(v => v === null || v === "" || v === "{}");
              const isExpanded = expandedIds.has(event.id);

              return (
                <div key={`${event.id}-${index}`} className="relative flex gap-3 py-2">
                  {/* Icon dot */}
                  <div className="relative z-10 flex-shrink-0 mt-0.5">
                    <div className="h-6 w-6 rounded-full bg-background border border-border/50 flex items-center justify-center shadow-sm">
                      <IconComp className={cn("h-3.5 w-3.5", config.color)} />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 border", moduleClass)}>
                        {event.modulo_origem}
                      </Badge>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                        {config.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>

                    <p className="text-xs text-foreground/80 mt-0.5">
                      {event.usuario_nome && (
                        <span className="font-medium flex items-center gap-1 inline-flex">
                          <UserCircle className="h-3 w-3" />
                          {event.usuario_nome}
                          {" · "}
                        </span>
                      )}
                      <span>{event.descricao || config.label}</span>
                    </p>

                    {/* Expandable metadata */}
                    {hasMetadata && (
                      <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(event.id)}>
                        <CollapsibleTrigger asChild>
                          <button className="text-[10px] text-muted-foreground hover:text-foreground mt-1 flex items-center gap-0.5 transition-colors">
                            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            Detalhes
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-1 space-y-0.5">
                            {Object.entries(metadata)
                              .filter(([, v]) => v !== null && v !== "" && v !== "{}")
                              .map(([key, val]) => (
                                <div key={key} className="text-[10px] bg-muted/50 rounded px-2 py-0.5">
                                  <span className="font-medium text-muted-foreground">{key}: </span>
                                  <span className="text-foreground/70">
                                    {typeof val === "object" ? JSON.stringify(val) : String(val)}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
