import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import ProductThumbnail from "./ProductThumbnail";
import CountdownBadge from "./CountdownBadge";
import MilestoneProgress from "./MilestoneProgress";
import QuickActions from "./QuickActions";
import { User, Building2 } from "lucide-react";

interface LaunchCardProps {
  id: string;
  nome: string;
  produto?: { nome: string; codigo: string; foto_url?: string | null } | null;
  responsavel?: { nome: string } | null;
  data_prevista: string;
  status: string;
  tipo: string;
  prioridade: string;
  distribuidoresCount?: number;
  tarefasTotal?: number;
  tarefasConcluidas?: number;
  onClick?: () => void;
  onEdit?: () => void;
  onStatusChange?: () => void;
  variant?: "default" | "compact" | "calendar";
  showMilestones?: boolean;
  showQuickActions?: boolean;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; gradient: string }> = {
  planejado: { 
    label: "Planejado", 
    color: "text-blue-700 dark:text-blue-300", 
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    gradient: "from-blue-500/10 to-blue-600/5"
  },
  em_preparacao: { 
    label: "Em Preparação", 
    color: "text-amber-700 dark:text-amber-300", 
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    gradient: "from-amber-500/10 to-yellow-600/5"
  },
  aprovado: { 
    label: "Aprovado", 
    color: "text-green-700 dark:text-green-300", 
    bgColor: "bg-green-100 dark:bg-green-900/30",
    gradient: "from-green-500/10 to-emerald-600/5"
  },
  lancado: { 
    label: "Lançado", 
    color: "text-purple-700 dark:text-purple-300", 
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    gradient: "from-purple-500/10 to-violet-600/5"
  },
  cancelado: { 
    label: "Cancelado", 
    color: "text-red-700 dark:text-red-300", 
    bgColor: "bg-red-100 dark:bg-red-900/30",
    gradient: "from-red-500/10 to-red-600/5"
  },
};

const tipoConfig: Record<string, { label: string; emoji: string }> = {
  novo_produto: { label: "Novo Produto", emoji: "✨" },
  reformulacao: { label: "Reformulação", emoji: "🔄" },
  nova_versao: { label: "Nova Versão", emoji: "📦" },
  promocional: { label: "Promocional", emoji: "🎁" },
};

const prioridadeConfig: Record<string, { label: string; color: string; ring: string }> = {
  alta: { label: "Alta", color: "bg-red-500", ring: "ring-2 ring-red-500/30" },
  media: { label: "Média", color: "bg-amber-500", ring: "ring-2 ring-amber-500/30" },
  baixa: { label: "Baixa", color: "bg-green-500", ring: "ring-2 ring-green-500/30" },
};

export default function LaunchCard({
  id,
  nome,
  produto,
  responsavel,
  data_prevista,
  status,
  tipo,
  prioridade,
  distribuidoresCount = 0,
  tarefasTotal = 0,
  tarefasConcluidas = 0,
  onClick,
  onEdit,
  onStatusChange,
  variant = "default",
  showMilestones = false,
  showQuickActions = false,
}: LaunchCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const progressPercent = tarefasTotal > 0 ? Math.round((tarefasConcluidas / tarefasTotal) * 100) : 0;
  const isLaunched = status === "lancado";

  if (variant === "calendar") {
    return (
      <div
        onClick={onClick}
        className={cn(
          "flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all group",
          "hover:scale-[1.02] hover:shadow-md",
          `bg-gradient-to-r ${statusConfig[status]?.gradient}`,
          statusConfig[status]?.bgColor
        )}
      >
        <ProductThumbnail src={produto?.foto_url} size="sm" />
        <div className="flex-1 min-w-0">
          <p className={cn("text-xs font-medium truncate", statusConfig[status]?.color)}>
            {nome}
          </p>
        </div>
        <div className={cn("h-2 w-2 rounded-full flex-shrink-0", prioridadeConfig[prioridade]?.color)} />
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <Card
        onClick={onClick}
        className={cn(
          "cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 overflow-hidden",
          prioridadeConfig[prioridade]?.ring
        )}
      >
        <div className={cn("h-1 w-full", `bg-gradient-to-r ${statusConfig[status]?.gradient}`, statusConfig[status]?.bgColor)} />
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <ProductThumbnail src={produto?.foto_url} size="md" />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm truncate">{nome}</h4>
              <p className="text-xs text-muted-foreground truncate">
                {produto?.nome || "Sem produto"}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <CountdownBadge date={data_prevista} isLaunched={isLaunched} />
              </div>
            </div>
          </div>
          
          {tarefasTotal > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Marketing</span>
                <span>{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-1.5" />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Default variant
  return (
    <Card
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 overflow-hidden group relative",
        prioridadeConfig[prioridade]?.ring
      )}
    >
      <div className={cn(
        "h-1.5 w-full bg-gradient-to-r",
        statusConfig[status]?.gradient,
        statusConfig[status]?.bgColor
      )} />
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <ProductThumbnail src={produto?.foto_url} size="lg" className="flex-shrink-0" />
          
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold text-base group-hover:text-primary transition-colors">
                  {nome}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {produto?.nome || "Sem produto vinculado"}
                  {produto?.codigo && <span className="ml-1 opacity-60">({produto.codigo})</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {showQuickActions && isHovered && (
                  <QuickActions
                    lancamentoId={id}
                    currentStatus={status}
                    onView={() => onClick?.()}
                    onEdit={onEdit}
                    onStatusChange={onStatusChange}
                    variant="dropdown"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                )}
                <Badge className={cn("flex-shrink-0", statusConfig[status]?.bgColor, statusConfig[status]?.color)}>
                  {statusConfig[status]?.label}
                </Badge>
              </div>
            </div>
            
            {showMilestones && (
              <MilestoneProgress currentStatus={status} variant="compact" className="py-1" />
            )}
            
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <CountdownBadge date={data_prevista} isLaunched={isLaunched} />
              
              <div className="flex items-center gap-1 text-muted-foreground">
                <span>{tipoConfig[tipo]?.emoji}</span>
                <span>{tipoConfig[tipo]?.label}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {responsavel?.nome && (
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    <span>{responsavel.nome}</span>
                  </div>
                )}
                {distribuidoresCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{distribuidoresCount} dist.</span>
                  </div>
                )}
              </div>

              {tarefasTotal > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {tarefasConcluidas}/{tarefasTotal}
                  </span>
                  <div className="w-16">
                    <Progress value={progressPercent} className="h-1.5" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
