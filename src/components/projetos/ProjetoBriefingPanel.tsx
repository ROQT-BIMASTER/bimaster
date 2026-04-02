import { useState } from "react";
import { useProjetoBriefings, BriefingWithContext } from "@/hooks/useProjetoBriefings";
import { BriefingCampo } from "@/hooks/useProjetoBriefing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileSpreadsheet, ChevronDown, ChevronRight, CheckCircle2, XCircle,
  Clock, Eye, Filter, Loader2, Package, AlertCircle,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pendente: { label: "Pendente", color: "bg-warning/20 text-warning", icon: Clock },
  em_analise: { label: "Em Análise", color: "bg-primary/20 text-primary", icon: Eye },
  aprovado: { label: "Aprovado", color: "bg-success/20 text-success", icon: CheckCircle2 },
  rejeitado: { label: "Rejeitado", color: "bg-destructive/20 text-destructive", icon: XCircle },
};

const RESP_COLORS: Record<string, string> = {
  D: "bg-primary/20 text-primary",
  C: "bg-accent/20 text-accent-foreground",
  R: "bg-destructive/20 text-destructive",
  E: "bg-warning/20 text-warning",
  COMP: "bg-success/20 text-success",
};

interface ProjetoBriefingPanelProps {
  projetoId: string;
  darkBg?: boolean;
}

export function ProjetoBriefingPanel({ projetoId, darkBg = false }: ProjetoBriefingPanelProps) {
  const { briefings, isLoading, updateBriefingStatus, loadCampos } = useProjetoBriefings(projetoId);
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedCampos, setExpandedCampos] = useState<Record<string, BriefingCampo[]>>({});
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; briefingId: string | null }>({ open: false, briefingId: null });
  const [rejectObs, setRejectObs] = useState("");

  const textColor = darkBg ? "text-white" : "text-foreground";
  const textMuted = darkBg ? "text-white/60" : "text-muted-foreground";
  const cardBg = darkBg ? "bg-white/5 border-white/10" : "bg-card border-border/50";

  const filtered = statusFilter === "todos"
    ? briefings
    : briefings.filter(b => b.status === statusFilter);

  const total = briefings.length;
  const aprovados = briefings.filter(b => b.status === "aprovado").length;
  const pendentes = briefings.filter(b => b.status === "pendente").length;
  const rejeitados = briefings.filter(b => b.status === "rejeitado").length;
  const cumprimento = total > 0 ? Math.round((aprovados / total) * 100) : 0;

  const handleExpand = async (briefingId: string) => {
    if (expandedId === briefingId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(briefingId);
    if (!expandedCampos[briefingId]) {
      try {
        const campos = await loadCampos(briefingId);
        setExpandedCampos(prev => ({ ...prev, [briefingId]: campos }));
      } catch { /* ignore */ }
    }
  };

  const handleApprove = (briefingId: string) => {
    updateBriefingStatus.mutate({ briefingId, status: "aprovado" });
  };

  const handleReject = () => {
    if (!rejectDialog.briefingId) return;
    updateBriefingStatus.mutate({
      briefingId: rejectDialog.briefingId,
      status: "rejeitado",
      observacao: rejectObs,
    });
    setRejectDialog({ open: false, briefingId: null });
    setRejectObs("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className={cn("h-6 w-6 animate-spin", textMuted)} />
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-20 gap-3", textMuted)}>
        <FileSpreadsheet className="h-10 w-10 opacity-40" />
        <p className="text-sm">Nenhum briefing importado neste projeto</p>
        <p className="text-xs opacity-60">Importe briefings a partir do detalhe de cada tarefa</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: total, icon: FileSpreadsheet, color: "text-primary" },
          { label: "Aprovados", value: aprovados, icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Pendentes", value: pendentes, icon: Clock, color: "text-amber-400" },
          { label: "Rejeitados", value: rejeitados, icon: XCircle, color: "text-red-400" },
          { label: "Cumprimento", value: `${cumprimento}%`, icon: AlertCircle, color: "text-primary" },
        ].map(kpi => (
          <div key={kpi.label} className={cn("rounded-lg border p-3", cardBg)}>
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={cn("h-4 w-4", kpi.color)} />
              <span className={cn("text-xs", textMuted)}>{kpi.label}</span>
            </div>
            <span className={cn("text-xl font-bold", textColor)}>{kpi.value}</span>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className={cn("h-4 w-4", textMuted)} />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="em_analise">Em Análise</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="rejeitado">Rejeitado</SelectItem>
          </SelectContent>
        </Select>
        <span className={cn("text-xs", textMuted)}>{filtered.length} briefings</span>
      </div>

      {/* Briefing list */}
      <div className="space-y-2">
        {filtered.map(b => {
          const statusInfo = STATUS_CONFIG[b.status] || STATUS_CONFIG.pendente;
          const isExpanded = expandedId === b.id;
          const campos = expandedCampos[b.id] || [];
          const grouped = campos.reduce<Record<string, BriefingCampo[]>>((acc, c) => {
            if (!acc[c.categoria]) acc[c.categoria] = [];
            acc[c.categoria].push(c);
            return acc;
          }, {});

          return (
            <Collapsible key={b.id} open={isExpanded} onOpenChange={() => handleExpand(b.id)}>
              <div className={cn("rounded-lg border overflow-hidden", cardBg)}>
                <CollapsibleTrigger asChild>
                  <button className={cn("w-full flex items-center gap-3 px-4 py-3 text-left transition-colors", darkBg ? "hover:bg-white/5" : "hover:bg-muted/30")}>
                    {isExpanded ? <ChevronDown className={cn("h-4 w-4 flex-shrink-0", textMuted)} /> : <ChevronRight className={cn("h-4 w-4 flex-shrink-0", textMuted)} />}

                    {/* Produto thumbnail */}
                    {b.produto_foto_url ? (
                      <img src={b.produto_foto_url} alt="" className="h-8 w-8 rounded object-contain bg-muted/50 flex-shrink-0" />
                    ) : (
                      <div className={cn("h-8 w-8 rounded flex items-center justify-center flex-shrink-0", darkBg ? "bg-white/10" : "bg-muted/50")}>
                        <Package className={cn("h-4 w-4", textMuted)} />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-sm font-medium truncate", textColor)}>
                          {b.tarefa_titulo || b.nome_arquivo}
                        </span>
                        {b.tarefa_codigo && (
                          <span className={cn("text-[10px] font-mono flex-shrink-0", textMuted)}>{b.tarefa_codigo}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {b.produto_nome && (
                          <span className={cn("text-xs truncate", textMuted)}>
                            {b.produto_codigo && `${b.produto_codigo} — `}{b.produto_nome}
                          </span>
                        )}
                        <span className={cn("text-[10px]", textMuted)}>
                          {format(new Date(b.created_at), "dd MMM yyyy", { locale: ptBR })}
                        </span>
                        <span className={cn("text-[10px]", textMuted)}>
                          {b.campos_count} campos
                        </span>
                      </div>
                    </div>

                    <Badge className={cn("text-[10px] border-0 gap-1 flex-shrink-0", statusInfo.color)}>
                      <statusInfo.icon className="h-3 w-3" />
                      {statusInfo.label}
                    </Badge>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      {b.status !== "aprovado" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                          onClick={() => handleApprove(b.id)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Aprovar
                        </Button>
                      )}
                      {b.status !== "rejeitado" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => setRejectDialog({ open: true, briefingId: b.id })}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Rejeitar
                        </Button>
                      )}
                    </div>
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  {b.observacao_aprovacao && (
                    <div className={cn("mx-4 mb-3 p-2 rounded text-xs", darkBg ? "bg-red-500/10 text-red-300" : "bg-red-50 text-red-600")}>
                      <strong>Observação:</strong> {b.observacao_aprovacao}
                    </div>
                  )}
                  <div className="px-4 pb-4 space-y-3">
                    {Object.keys(grouped).length === 0 ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className={cn("h-4 w-4 animate-spin", textMuted)} />
                      </div>
                    ) : (
                      Object.entries(grouped).map(([categoria, fields]) => (
                        <div key={categoria}>
                          <h4 className={cn("text-[10px] font-semibold uppercase tracking-wider mb-1.5", textMuted)}>
                            {categoria}
                          </h4>
                          <div className="rounded-md border overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className={darkBg ? "border-white/10" : ""}>
                                  <TableHead className="h-7 text-[10px] w-[180px]">Campo</TableHead>
                                  <TableHead className="h-7 text-[10px]">Valor</TableHead>
                                  <TableHead className="h-7 text-[10px] w-[70px] text-center">Resp.</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {fields.map(f => (
                                  <TableRow key={f.id} className={darkBg ? "border-white/5" : ""}>
                                    <TableCell className={cn("py-1 text-[11px] font-medium", darkBg ? "text-white/70" : "")}>
                                      {f.campo}
                                    </TableCell>
                                    <TableCell className={cn("py-1 text-[11px]", textMuted)}>
                                      {f.valor || "—"}
                                    </TableCell>
                                    <TableCell className="py-1 text-center">
                                      {f.responsabilidade && (
                                        <Badge className={cn("text-[8px] border-0 px-1.5", RESP_COLORS[f.responsabilidade] || "bg-muted text-muted-foreground")}>
                                          {f.responsabilidade}
                                        </Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>

      {/* Reject dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={open => { if (!open) setRejectDialog({ open: false, briefingId: null }); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar Briefing</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Motivo da rejeição (opcional)..."
            value={rejectObs}
            onChange={e => setRejectObs(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, briefingId: null })}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject}>Rejeitar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
