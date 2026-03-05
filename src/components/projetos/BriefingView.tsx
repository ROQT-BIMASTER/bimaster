import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Briefing } from "@/hooks/useProjetoBriefing";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, ListTodo, FileSpreadsheet, ChevronDown, ChevronRight, Download, ShieldCheck, ShieldAlert, ShieldQuestion, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

const RESP_COLORS: Record<string, string> = {
  D: "bg-blue-500/20 text-blue-400",
  C: "bg-purple-500/20 text-purple-400",
  R: "bg-red-500/20 text-red-400",
  E: "bg-amber-500/20 text-amber-400",
  COMP: "bg-emerald-500/20 text-emerald-400",
};

const RESP_LABELS: Record<string, string> = {
  D: "Desenvolvimento",
  C: "Criação",
  R: "Regulatório",
  E: "Embalagem",
  COMP: "Compras",
};

const AUDIT_CONFIG: Record<string, { icon: any; color: string; label: string; pulse?: boolean }> = {
  alto: { icon: ShieldCheck, color: "text-emerald-400", label: "Briefing compatível" },
  medio: { icon: ShieldQuestion, color: "text-amber-400", label: "Verificar compatibilidade" },
  baixo: { icon: ShieldAlert, color: "text-red-400", label: "Possível incompatibilidade", pulse: true },
};

interface AuditResult {
  match: "alto" | "medio" | "baixo";
  confianca: number;
  motivo: string;
  alertas: string[];
}

interface BriefingViewProps {
  briefing: Briefing;
  onDelete: () => void;
  onCreateTasks: () => void;
  darkBg?: boolean;
  defaultCollapsed?: boolean;
  produtoInfo?: { nome: string; codigo: string; foto_url?: string };
  tarefaContext?: { titulo: string; descricao?: string; estagio?: string; codigo?: string };
  linkedProduto?: { codigo: string; nome: string; marca?: string; linha?: string; tipo?: string } | null;
}

export function BriefingView({
  briefing, onDelete, onCreateTasks, darkBg = false, defaultCollapsed = false,
  produtoInfo, tarefaContext, linkedProduto,
}: BriefingViewProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [exporting, setExporting] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [auditing, setAuditing] = useState(false);
  const campos = briefing.campos || [];

  const grouped = campos.reduce<Record<string, typeof campos>>((acc, c) => {
    if (!acc[c.categoria]) acc[c.categoria] = [];
    acc[c.categoria].push(c);
    return acc;
  }, {});

  // ── AI Audit ──
  useEffect(() => {
    if (!tarefaContext || !linkedProduto || campos.length === 0 || auditResult) return;
    const run = async () => {
      setAuditing(true);
      try {
        const { data, error } = await supabase.functions.invoke("audit-briefing-tarefa", {
          body: {
            tarefa: tarefaContext,
            produto: linkedProduto,
            briefingCampos: campos.map(c => ({ categoria: c.categoria, campo: c.campo, valor: c.valor })),
          },
        });
        if (error) throw error;
        if (data && data.match) setAuditResult(data as AuditResult);
      } catch (e) {
        console.error("Briefing audit error:", e);
      } finally {
        setAuditing(false);
      }
    };
    run();
  }, [tarefaContext, linkedProduto, campos.length]);

  // ── Excel Export ──
  const handleExport = async () => {
    setExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "BiMaster";
      workbook.created = new Date();
      const ws = workbook.addWorksheet("Briefing");

      let startRow = 1;

      // Try to embed product image
      const imageUrl = produtoInfo?.foto_url;
      if (imageUrl) {
        try {
          const resp = await fetch(imageUrl);
          if (resp.ok) {
            const buffer = await resp.arrayBuffer();
            const ext = imageUrl.toLowerCase().includes(".png") ? "png" : "jpeg";
            const imgId = workbook.addImage({ buffer, extension: ext });
            ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 120, height: 120 } });
            startRow = 8; // leave space for image
          }
        } catch { /* skip image */ }
      }

      // Product header
      if (produtoInfo) {
        const headerRow = ws.getRow(startRow);
        headerRow.getCell(1).value = `Produto: ${produtoInfo.codigo} — ${produtoInfo.nome}`;
        headerRow.getCell(1).font = { bold: true, size: 14 };
        ws.mergeCells(startRow, 1, startRow, 4);
        startRow += 2;
      }

      // Column headers
      ws.columns = [
        { key: "categoria", width: 20 },
        { key: "campo", width: 30 },
        { key: "valor", width: 50 },
        { key: "resp", width: 15 },
      ];

      const hdrRow = ws.getRow(startRow);
      ["Categoria", "Campo", "Valor", "Responsabilidade"].forEach((h, i) => {
        hdrRow.getCell(i + 1).value = h;
        hdrRow.getCell(i + 1).font = { bold: true, color: { argb: "FFFFFFFF" } };
        hdrRow.getCell(i + 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
        hdrRow.getCell(i + 1).alignment = { horizontal: "center" };
      });
      startRow++;

      // Data rows
      campos.forEach((c) => {
        const row = ws.getRow(startRow);
        row.getCell(1).value = c.categoria;
        row.getCell(2).value = c.campo;
        row.getCell(3).value = c.valor || "";
        row.getCell(4).value = c.responsabilidade ? (RESP_LABELS[c.responsabilidade] || c.responsabilidade) : "";
        row.eachCell(cell => {
          cell.border = {
            top: { style: "thin" }, left: { style: "thin" },
            bottom: { style: "thin" }, right: { style: "thin" },
          };
        });
        startRow++;
      });

      const filename = `Briefing_${produtoInfo?.codigo || "export"}_${new Date().toISOString().split("T")[0]}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, filename);
      toast.success("Briefing exportado com sucesso!");
    } catch (e) {
      console.error("Export error:", e);
      toast.error("Erro ao exportar briefing");
    } finally {
      setExporting(false);
    }
  };

  const auditCfg = auditResult ? AUDIT_CONFIG[auditResult.match] : null;
  const AuditIcon = auditCfg?.icon;

  return (
    <div className={cn("mx-3 mb-3 rounded-lg border p-3", darkBg ? "border-white/10 bg-white/5" : "border-border/40 bg-muted/20")}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setCollapsed(c => !c)} className="flex-shrink-0 hover:text-primary transition-colors">
            {collapsed
              ? <ChevronRight className={cn("h-4 w-4", darkBg ? "text-white/50" : "text-muted-foreground")} />
              : <ChevronDown className={cn("h-4 w-4", darkBg ? "text-white/50" : "text-muted-foreground")} />
            }
          </button>
          <FileSpreadsheet className={cn("h-4 w-4", darkBg ? "text-primary/80" : "text-primary")} />
          <span className={cn("text-xs font-medium", darkBg ? "text-white/80" : "text-foreground")}>
            {briefing.nome_arquivo}
          </span>
          <span className={cn("text-[10px]", darkBg ? "text-white/40" : "text-muted-foreground")}>
            {format(new Date(briefing.created_at), "dd MMM yyyy", { locale: ptBR })}
          </span>

          {/* AI Audit badge */}
          {auditing && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {auditCfg && AuditIcon && auditResult && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn("flex items-center gap-1 cursor-help", auditCfg.pulse && "animate-pulse")}>
                    <AuditIcon className={cn("h-4 w-4", auditCfg.color)} />
                    <span className={cn("text-[10px] font-medium", auditCfg.color)}>
                      {auditResult.confianca}%
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium text-xs mb-1">{auditCfg.label}</p>
                  <p className="text-[11px] text-muted-foreground">{auditResult.motivo}</p>
                  {auditResult.alertas.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {auditResult.alertas.map((a, i) => (
                        <li key={i} className="text-[10px] text-amber-400">⚠ {a}</li>
                      ))}
                    </ul>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
            onClick={handleExport}
            disabled={exporting}
            title="Exportar Excel"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-primary hover:text-primary"
            onClick={onCreateTasks}
          >
            <ListTodo className="h-3.5 w-3.5" />
            Criar Tarefas
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!collapsed && <div className="space-y-3">
        {Object.entries(grouped).map(([categoria, fields]) => (
          <div key={categoria}>
            <h4 className={cn("text-[10px] font-semibold uppercase tracking-wider mb-1.5", darkBg ? "text-white/50" : "text-muted-foreground")}>
              {categoria}
            </h4>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className={darkBg ? "border-white/10" : ""}>
                    <TableHead className="h-8 text-[10px] w-[180px]">Campo</TableHead>
                    <TableHead className="h-8 text-[10px]">Valor</TableHead>
                    <TableHead className="h-8 text-[10px] w-[70px] text-center">Resp.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((f) => (
                    <TableRow key={f.id} className={darkBg ? "border-white/5" : ""}>
                      <TableCell className={cn("py-1.5 text-[11px] font-medium", darkBg ? "text-white/70" : "")}>
                        {f.campo}
                      </TableCell>
                      <TableCell className={cn("py-1.5 text-[11px]", darkBg ? "text-white/60" : "text-muted-foreground")}>
                        {f.valor || "—"}
                      </TableCell>
                      <TableCell className="py-1.5 text-center">
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
        ))}
      </div>}
    </div>
  );
}
