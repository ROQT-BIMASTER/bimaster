import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Briefing } from "@/hooks/useProjetoBriefing";
import { Trash2, ListTodo, FileSpreadsheet, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface BriefingViewProps {
  briefing: Briefing;
  onDelete: () => void;
  onCreateTasks: () => void;
  darkBg?: boolean;
  defaultCollapsed?: boolean;
}

export function BriefingView({ briefing, onDelete, onCreateTasks, darkBg = false, defaultCollapsed = false }: BriefingViewProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const campos = briefing.campos || [];

  const grouped = campos.reduce<Record<string, typeof campos>>((acc, c) => {
    if (!acc[c.categoria]) acc[c.categoria] = [];
    acc[c.categoria].push(c);
    return acc;
  }, {});

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
        </div>
        <div className="flex items-center gap-1">
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
