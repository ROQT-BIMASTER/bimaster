import { useMemo, useCallback } from "react";
import { useProjetoTarefas, ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { isPast, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, Clock, Target, RotateCcw, Download, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Workbook } from "exceljs";
import { saveAs } from "file-saver";

interface ProjetoEquipeDashboardProps {
  projetoId: string;
  darkBg?: boolean;
}

interface MemberStats {
  id: string;
  nome: string;
  avatar_url: string | null;
  total: number;
  concluidas: number;
  atrasadas: number;
  em_andamento: number;
  retrabalhos: number;
  percentual: number;
  tarefasAtrasadas: ProjetoTarefa[];
}

export function ProjetoEquipeDashboard({ projetoId, darkBg = false }: ProjetoEquipeDashboardProps) {
  const { tarefas, teamMembers, secoes } = useProjetoTarefas(projetoId);

  const parentTarefas = useMemo(() => tarefas.filter(t => !t.parent_tarefa_id), [tarefas]);

  const memberStats = useMemo(() => {
    const statsMap: Record<string, MemberStats> = {};

    for (const t of parentTarefas) {
      const rid = t.responsavel_id;
      if (!rid) continue;

      if (!statsMap[rid]) {
        const profile = teamMembers.find(m => m.id === rid);
        statsMap[rid] = {
          id: rid,
          nome: profile?.nome || t.responsavel?.nome || "Sem nome",
          avatar_url: profile?.avatar_url || t.responsavel?.avatar_url || null,
          total: 0, concluidas: 0, atrasadas: 0, em_andamento: 0, retrabalhos: 0,
          percentual: 0, tarefasAtrasadas: [],
        };
      }

      const s = statsMap[rid];
      s.total++;
      if (t.status === "concluida") s.concluidas++;
      if (t.status === "em_andamento") s.em_andamento++;
      if ((t as any).tipo_tarefa === "retrabalho") s.retrabalhos++;

      const isOverdue = t.data_prazo && isPast(new Date(t.data_prazo)) && t.status !== "concluida";
      if (isOverdue) {
        s.atrasadas++;
        s.tarefasAtrasadas.push(t);
      }
    }

    return Object.values(statsMap)
      .map(s => ({ ...s, percentual: s.total > 0 ? Math.round((s.concluidas / s.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [parentTarefas, teamMembers]);

  const chartData = memberStats.map(m => ({
    nome: m.nome.split(" ")[0],
    total: m.total,
    concluidas: m.concluidas,
    atrasadas: m.atrasadas,
  }));

  const unassignedTarefas = useMemo(() => parentTarefas.filter(t => !t.responsavel_id), [parentTarefas]);

  const handleExport = useCallback(async () => {
    const wb = new Workbook();
    const ws = wb.addWorksheet("Relatório de Tarefas");

    ws.columns = [
      { header: "Código", key: "codigo", width: 12 },
      { header: "Tarefa", key: "titulo", width: 40 },
      { header: "Status", key: "status", width: 15 },
      { header: "Prioridade", key: "prioridade", width: 12 },
      { header: "Estágio", key: "estagio", width: 15 },
      { header: "Responsável", key: "responsavel", width: 20 },
      { header: "Prazo", key: "data_prazo", width: 14 },
      { header: "Conclusão", key: "data_conclusao", width: 14 },
      { header: "Tipo", key: "tipo", width: 12 },
      { header: "Seção", key: "secao", width: 20 },
    ];

    const secaoMap = Object.fromEntries(secoes.map(s => [s.id, s.nome]));

    for (const t of parentTarefas) {
      ws.addRow({
        codigo: t.codigo || "",
        titulo: t.titulo,
        status: t.status,
        prioridade: t.prioridade,
        estagio: t.estagio || "",
        responsavel: t.responsavel?.nome || "Sem responsável",
        data_prazo: t.data_prazo ? format(new Date(t.data_prazo), "dd/MM/yyyy") : "",
        data_conclusao: t.data_conclusao ? format(new Date(t.data_conclusao), "dd/MM/yyyy") : "",
        tipo: (t as any).tipo_tarefa === "retrabalho" ? "Retrabalho" : "Padrão",
        secao: secaoMap[t.secao_id] || "",
      });
    }

    // Style header
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `relatorio-projeto-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  }, [parentTarefas, secoes]);

  const textColor = darkBg ? "text-white" : "";
  const textMuted = darkBg ? "text-white/60" : "text-muted-foreground";
  const cardBg = darkBg ? "bg-white/5 border-white/10" : "";

  return (
    <div className="space-y-6">
      {/* Summary cards + export */}
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
          <SummaryCard
            icon={<Target className="h-4 w-4 text-blue-400" />}
            label="Total de Tarefas"
            value={parentTarefas.length}
            darkBg={darkBg}
          />
          <SummaryCard
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
            label="Concluídas"
            value={parentTarefas.filter(t => t.status === "concluida").length}
            darkBg={darkBg}
          />
          <SummaryCard
            icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
            label="Atrasadas"
            value={parentTarefas.filter(t => t.data_prazo && isPast(new Date(t.data_prazo)) && t.status !== "concluida").length}
            darkBg={darkBg}
          />
          <SummaryCard
            icon={<RotateCcw className="h-4 w-4 text-amber-400" />}
            label="Retrabalhos"
            value={parentTarefas.filter(t => (t as any).tipo_tarefa === "retrabalho").length}
            darkBg={darkBg}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className={cn("ml-4 gap-1.5 text-xs flex-shrink-0", darkBg && "border-white/20 text-white hover:bg-white/10")}
          onClick={handleExport}
        >
          <Download className="h-3.5 w-3.5" /> Exportar Excel
        </Button>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className={cardBg}>
          <CardHeader className="pb-2">
            <CardTitle className={cn("text-sm", textColor)}>Tarefas por Membro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="nome" tick={{ fontSize: 11, fill: darkBg ? "rgba(255,255,255,0.6)" : undefined }} />
                  <YAxis tick={{ fontSize: 11, fill: darkBg ? "rgba(255,255,255,0.6)" : undefined }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: darkBg ? "rgba(0,0,0,0.8)" : undefined,
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="total" name="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="concluidas" name="Concluídas" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="atrasadas" name="Atrasadas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Member cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {memberStats.map(m => (
          <Card key={m.id} className={cardBg}>
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={m.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-primary/20 text-primary">
                    {m.nome.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium truncate", textColor)}>{m.nome}</p>
                  <p className={cn("text-xs", textMuted)}>{m.total} tarefa{m.total !== 1 ? "s" : ""}</p>
                </div>
                <Badge variant="outline" className={cn("text-xs", darkBg && "border-white/30 text-white")}>{m.percentual}%</Badge>
              </div>

              <Progress value={m.percentual} className="h-2" />

              <div className="flex gap-3 text-xs flex-wrap">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> {m.concluidas}
                </span>
                <span className="flex items-center gap-1 text-blue-400">
                  <Clock className="h-3 w-3" /> {m.em_andamento}
                </span>
                {m.atrasadas > 0 && (
                  <span className="flex items-center gap-1 text-red-400">
                    <AlertTriangle className="h-3 w-3" /> {m.atrasadas}
                  </span>
                )}
                {m.retrabalhos > 0 && (
                  <span className="flex items-center gap-1 text-amber-400">
                    <RotateCcw className="h-3 w-3" /> {m.retrabalhos}
                  </span>
                )}
              </div>

              {/* Overdue tasks */}
              {m.tarefasAtrasadas.length > 0 && (
                <div className="space-y-1 pt-1">
                  <p className={cn("text-[10px] font-medium", textMuted)}>Tarefas atrasadas:</p>
                  {m.tarefasAtrasadas.slice(0, 3).map(t => (
                    <div key={t.id} className={cn("text-[11px] flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10", darkBg ? "text-red-300" : "text-red-500")}>
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{t.titulo}</span>
                    </div>
                  ))}
                  {m.tarefasAtrasadas.length > 3 && (
                    <p className={cn("text-[10px]", textMuted)}>+{m.tarefasAtrasadas.length - 3} mais</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Unassigned tasks card */}
      {unassignedTarefas.length > 0 && (
        <Card className={cardBg}>
          <CardHeader className="pb-2">
            <CardTitle className={cn("text-sm flex items-center gap-2", textColor)}>
              <UserX className="h-4 w-4 text-amber-400" />
              Tarefas sem responsável ({unassignedTarefas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {unassignedTarefas.slice(0, 10).map(t => {
                const isOverdue = t.data_prazo && isPast(new Date(t.data_prazo)) && t.status !== "concluida";
                return (
                  <div key={t.id} className={cn("flex items-center gap-2 text-xs px-2 py-1.5 rounded", darkBg ? "bg-white/5" : "bg-muted/30")}>
                    {t.codigo && <span className={cn("font-mono text-[10px]", textMuted)}>{t.codigo}</span>}
                    <span className={cn("flex-1 truncate", textColor)}>{t.titulo}</span>
                    {isOverdue && <Badge variant="destructive" className="text-[9px] h-4 px-1">Atrasada</Badge>}
                    <Badge variant="outline" className={cn("text-[9px] h-4 px-1", darkBg && "border-white/30 text-white")}>{t.status}</Badge>
                  </div>
                );
              })}
              {unassignedTarefas.length > 10 && (
                <p className={cn("text-[10px] px-2", textMuted)}>+{unassignedTarefas.length - 10} mais tarefas sem responsável</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, darkBg }: { icon: React.ReactNode; label: string; value: number; darkBg: boolean }) {
  return (
    <Card className={darkBg ? "bg-white/5 border-white/10" : ""}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className={cn("text-xs", darkBg ? "text-white/60" : "text-muted-foreground")}>{label}</span>
        </div>
        <p className={cn("text-2xl font-bold", darkBg ? "text-white" : "")}>{value}</p>
      </CardContent>
    </Card>
  );
}
