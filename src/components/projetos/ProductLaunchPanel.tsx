import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import ProductThumbnail from "@/components/fabrica/ProductThumbnail";
import { ProdutoAcabado } from "@/hooks/useProjetoTarefaDetalhe";
import { cn } from "@/lib/utils";
import {
  Package, CheckCircle2, Circle, FileText, Palette, Tag,
  ClipboardList, FlaskConical, Award, UserCheck
} from "lucide-react";

interface ChecklistItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  done: boolean;
}

interface ProductLaunchPanelProps {
  linkedProduto: ProdutoAcabado | null;
  cofreDocs: any[];
  metas: any[];
}

const CHECKLIST_CONFIG = [
  { key: "briefing", label: "Briefing", icon: <FileText className="h-3.5 w-3.5" /> },
  { key: "arte_final", label: "Arte Final", icon: <Palette className="h-3.5 w-3.5" /> },
  { key: "rotulo", label: "Rótulo", icon: <Tag className="h-3.5 w-3.5" /> },
  { key: "ficha_tecnica", label: "Ficha Técnica", icon: <ClipboardList className="h-3.5 w-3.5" /> },
  { key: "laudo", label: "Laudo", icon: <FlaskConical className="h-3.5 w-3.5" /> },
  { key: "certificado", label: "Certificado", icon: <Award className="h-3.5 w-3.5" /> },
  { key: "aprovacao_cliente", label: "Aprovação Cliente", icon: <UserCheck className="h-3.5 w-3.5" /> },
];

export function ProductLaunchPanel({ linkedProduto, cofreDocs, metas }: ProductLaunchPanelProps) {
  const checklist = useMemo<ChecklistItem[]>(() => {
    const cofreCategorias = new Set(cofreDocs.map((d: any) => d.categoria));
    const hasAprovacao = metas.some(
      m => m.concluida && m.descricao?.toLowerCase().includes("aprovação")
    );

    return CHECKLIST_CONFIG.map(item => ({
      ...item,
      done: item.key === "aprovacao_cliente"
        ? hasAprovacao
        : cofreCategorias.has(item.key),
    }));
  }, [cofreDocs, metas]);

  const completedCount = checklist.filter(c => c.done).length;
  const progressPercent = Math.round((completedCount / checklist.length) * 100);

  const progressColor = progressPercent >= 70
    ? "bg-emerald-500"
    : progressPercent >= 30
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className="w-[280px] flex-shrink-0 border-r border-border/50 overflow-y-auto p-4 space-y-4">
      {/* Product Card */}
      <Card className="shadow-none border-border/50">
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Produto Vinculado
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {linkedProduto ? (
            <div className="flex flex-col items-center text-center gap-3">
              <ProductThumbnail
                src={linkedProduto.foto_url}
                alt={linkedProduto.nome}
                size="xl"
              />
              <div className="space-y-1">
                <Badge variant="outline" className="text-[10px] font-mono px-2">
                  {linkedProduto.codigo}
                </Badge>
                <p className="text-sm font-medium leading-tight">{linkedProduto.nome}</p>
                {(linkedProduto.marca || linkedProduto.linha) && (
                  <p className="text-[11px] text-muted-foreground">
                    {[linkedProduto.marca, linkedProduto.linha].filter(Boolean).join(" · ")}
                  </p>
                )}
                {linkedProduto.tipo && (
                  <Badge className="text-[9px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-0">
                    {linkedProduto.tipo}
                  </Badge>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <Package className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">Nenhum produto vinculado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pre-Launch Checklist */}
      <Card className="shadow-none border-border/50">
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Checklist Pré-Lançamento
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="space-y-2">
            {checklist.map(item => (
              <div key={item.key} className="flex items-center gap-2">
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                )}
                <span className={cn(
                  "text-xs flex items-center gap-1.5",
                  item.done ? "text-foreground" : "text-muted-foreground"
                )}>
                  {item.icon}
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          <Separator />

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground font-medium">Progresso</span>
              <span className={cn(
                "text-xs font-bold",
                progressPercent >= 70 ? "text-emerald-500" : progressPercent >= 30 ? "text-amber-500" : "text-red-500"
              )}>
                {progressPercent}%
              </span>
            </div>
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={cn("h-full transition-all duration-500 ease-out rounded-full", progressColor)}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              {completedCount} de {checklist.length} etapas concluídas
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
