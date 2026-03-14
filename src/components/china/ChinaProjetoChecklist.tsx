import { useChinaProjetoChecklist } from "@/hooks/useChinaProjeto";
import { useChinaBrazilModuleStatus, ETAPA_LABELS, STATUS_LABELS } from "@/hooks/useChinaBrazilModuleStatus";
import { BilingualLabel } from "./BilingualLabel";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Loader2, ChevronDown, ChevronRight, Palette, Package, FlaskConical, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const SECAO_CN: Record<string, string> = {
  "Criação / Identidade": "创作/标识",
  "Desenvolvimento de Produtos": "产品开发",
  "Desenvolvimento de Embalagem": "包装开发",
  "Informações dos Produtos (Briefing)": "产品信息（简报）",
  "Assuntos Regulatórios": "监管事务",
  "Criação / Artes": "创作/艺术",
};

interface ChinaProjetoChecklistProps {
  submissaoId: string;
}

export function ChinaProjetoChecklist({ submissaoId }: ChinaProjetoChecklistProps) {
  const { data: checklist = [], isLoading } = useChinaProjetoChecklist(submissaoId);
  const { data: modules, isLoading: modulesLoading } = useChinaBrazilModuleStatus(submissaoId);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loading = isLoading || modulesLoading;

  if (loading) {
    return (
      <Card className="p-6">
        <BilingualLabel pt="Checklist Pré-Lançamento" cn="上市前检查清单" size="md" />
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  const hasChecklist = checklist.length > 0;
  const hasModules = modules && (modules.artes.length > 0 || modules.cofre.total > 0 || modules.composicao.total_ingredientes > 0);

  if (!hasChecklist && !hasModules) return null;

  const totalTarefas = checklist.reduce((s, c) => s + c.total, 0);
  const totalConcluidas = checklist.reduce((s, c) => s + c.concluidas, 0);
  const pctGeral = totalTarefas > 0 ? Math.round((totalConcluidas / totalTarefas) * 100) : 0;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <BilingualLabel pt="Checklist Pré-Lançamento" cn="上市前检查清单" size="md" />
        {hasChecklist && (
          <Badge variant={pctGeral === 100 ? "success" : "secondary"} className="text-xs">
            {totalConcluidas}/{totalTarefas} ({pctGeral}%)
          </Badge>
        )}
      </div>

      {hasChecklist && <Progress value={pctGeral} gradient className="h-2" />}

      {/* Existing project tasks checklist */}
      {hasChecklist && (
        <div className="space-y-1">
          {checklist.map((sec) => {
            const isExpanded = expanded === sec.secao_id;
            const isDone = sec.total > 0 && sec.concluidas === sec.total;

            return (
              <div key={sec.secao_id}>
                <button
                  onClick={() => setExpanded(isExpanded ? null : sec.secao_id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors",
                    "hover:bg-muted/50",
                    isDone && "opacity-80"
                  )}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className={cn("text-sm font-medium", isDone && "line-through text-muted-foreground")}>
                      {sec.secao_nome}
                    </span>
                    {SECAO_CN[sec.secao_nome] && (
                      <span className="text-[10px] text-muted-foreground ml-2">{SECAO_CN[sec.secao_nome]}</span>
                    )}
                  </div>
                  <Badge variant="ghost" className="text-[10px] shrink-0">
                    {sec.concluidas}/{sec.total}
                  </Badge>
                  {sec.tarefas.length > 0 && (
                    isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </button>

                {isExpanded && sec.tarefas.length > 0 && (
                  <div className="ml-6 pl-4 border-l border-border/50 space-y-1 py-1">
                    {sec.tarefas.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 py-1 text-xs">
                        {t.status === "concluida" ? (
                          <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                        ) : (
                          <Circle className="h-3 w-3 text-muted-foreground shrink-0" />
                        )}
                        <span className={cn(
                          "flex-1",
                          t.status === "concluida" && "line-through text-muted-foreground"
                        )}>
                          {t.titulo}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Brazil Modules Status */}
      {hasModules && (
        <>
          {hasChecklist && <div className="border-t border-border/50 pt-3" />}
          <BilingualLabel pt="Módulos Brasil" cn="巴西模块状态" size="sm" />

          <div className="space-y-2">
            {/* Fluxo de Artes */}
            {modules.artes.length > 0 && (
              <ModuleSection
                icon={<Palette className="h-4 w-4 text-primary" />}
                titlePt="Fluxo de Artes"
                titleCn="艺术流程"
                expanded={expanded}
                onToggle={setExpanded}
                sectionKey="mod_artes"
              >
                <div className="space-y-1.5">
                  {modules.artes.map((a) => {
                    const isDone = a.status_geral === "af_recebida" || a.status_geral === "aprovado";
                    const etapaLabel = ETAPA_LABELS[a.etapa_atual] || { pt: a.etapa_atual, cn: "" };
                    const statusLabel = STATUS_LABELS[a.status_geral] || { pt: a.status_geral, cn: "" };
                    return (
                      <div key={a.tipo} className="flex items-center gap-2 text-xs py-1">
                        {isDone ? (
                          <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                        ) : (
                          <Circle className="h-3 w-3 text-muted-foreground shrink-0" />
                        )}
                        <span className="flex-1">
                          {a.label}
                          <span className="text-muted-foreground ml-1 text-[10px]">{a.labelCn}</span>
                        </span>
                        <Badge
                          variant={isDone ? "success" : a.status_geral === "rejeitado" ? "destructive" : "secondary"}
                          className="text-[9px] px-1.5 py-0"
                        >
                          {etapaLabel.pt}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </ModuleSection>
            )}

            {/* Cofre do Produto */}
            {modules.cofre.total > 0 && (
              <ModuleSection
                icon={<Package className="h-4 w-4 text-warning" />}
                titlePt="Cofre do Produto"
                titleCn="产品保险箱"
                expanded={expanded}
                onToggle={setExpanded}
                sectionKey="mod_cofre"
                badge={
                  <Badge
                    variant={modules.cofre.preenchidos === modules.cofre.total ? "success" : "secondary"}
                    className="text-[10px]"
                  >
                    {modules.cofre.preenchidos}/{modules.cofre.total}
                  </Badge>
                }
              >
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total de itens 总项目</span>
                    <span className="font-medium">{modules.cofre.preenchidos}/{modules.cofre.total}</span>
                  </div>
                  <Progress
                    value={modules.cofre.total > 0 ? (modules.cofre.preenchidos / modules.cofre.total) * 100 : 0}
                    className="h-1.5"
                  />
                  {modules.cofre.obrigatorios_total > 0 && (
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Obrigatórios 必填</span>
                      <span className={cn(
                        "font-medium",
                        modules.cofre.obrigatorios_preenchidos === modules.cofre.obrigatorios_total ? "text-success" : "text-warning"
                      )}>
                        {modules.cofre.obrigatorios_preenchidos}/{modules.cofre.obrigatorios_total}
                      </span>
                    </div>
                  )}
                </div>
              </ModuleSection>
            )}

            {/* Composição INCI */}
            {modules.composicao.total_ingredientes > 0 && (
              <ModuleSection
                icon={<FlaskConical className="h-4 w-4 text-accent" />}
                titlePt="Composição INCI"
                titleCn="INCI成分"
                expanded={expanded}
                onToggle={setExpanded}
                sectionKey="mod_composicao"
                badge={
                  <ComposicaoVersionBadge status={modules.composicao.versao_status} versao={modules.composicao.versao_atual} />
                }
              >
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ingredientes 成分</span>
                    <span className="font-medium">{modules.composicao.total_ingredientes}</span>
                  </div>
                  <div className="flex gap-3">
                    <StatusDot color="text-success" label="Conforme" count={modules.composicao.aprovados} />
                    <StatusDot color="text-warning" label="Pendente" count={modules.composicao.pendentes} />
                    {modules.composicao.restritos > 0 && (
                      <StatusDot color="text-destructive" label="Restrito" count={modules.composicao.restritos} />
                    )}
                  </div>
                  <Progress
                    value={modules.composicao.total_ingredientes > 0
                      ? (modules.composicao.aprovados / modules.composicao.total_ingredientes) * 100
                      : 0}
                    className="h-1.5"
                  />
                </div>
              </ModuleSection>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

// ── Helper Components ──

function ModuleSection({
  icon,
  titlePt,
  titleCn,
  expanded,
  onToggle,
  sectionKey,
  badge,
  children,
}: {
  icon: React.ReactNode;
  titlePt: string;
  titleCn: string;
  expanded: string | null;
  onToggle: (key: string | null) => void;
  sectionKey: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isExpanded = expanded === sectionKey;

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <button
        onClick={() => onToggle(isExpanded ? null : sectionKey)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
      >
        {icon}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{titlePt}</span>
          <span className="text-[10px] text-muted-foreground ml-1.5">{titleCn}</span>
        </div>
        {badge}
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/30">
          {children}
        </div>
      )}
    </div>
  );
}

function StatusDot({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-1">
      <div className={cn("h-2 w-2 rounded-full", color.replace("text-", "bg-"))} />
      <span className="text-muted-foreground">{label}: <strong className="text-foreground">{count}</strong></span>
    </div>
  );
}

function ComposicaoVersionBadge({ status, versao }: { status: string; versao: number }) {
  if (versao === 0) return <Badge variant="secondary" className="text-[10px]">Sem dados</Badge>;

  const variantMap: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
    aprovado: "success",
    submetido: "warning",
    rascunho: "secondary",
    devolvido: "destructive",
  };

  return (
    <Badge variant={variantMap[status] || "secondary"} className="text-[10px]">
      v{versao} — {status === "aprovado" ? "Aprovado" : status === "submetido" ? "Em análise" : status === "devolvido" ? "Devolvido" : "Rascunho"}
    </Badge>
  );
}
