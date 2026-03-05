import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Sparkles, Loader2, FileSpreadsheet, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import ExcelJS from "exceljs";

interface BriefingTask {
  titulo: string;
  descricao: string;
  prioridade: string;
  area: string;
  secao_id: string;
  selected: boolean;
}

interface BriefingImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secoes: { id: string; nome: string }[];
  secaoId: string;
  onCreateTasks: (tasks: { titulo: string; descricao: string; prioridade: string; secao_id: string }[]) => void;
}

const AREA_COLORS: Record<string, string> = {
  "Desenvolvimento": "bg-blue-500/20 text-blue-400",
  "Criação": "bg-purple-500/20 text-purple-400",
  "Regulatório": "bg-red-500/20 text-red-400",
  "Embalagem": "bg-amber-500/20 text-amber-400",
  "Compras": "bg-emerald-500/20 text-emerald-400",
};

const PRIORIDADE_COLORS: Record<string, string> = {
  alta: "bg-destructive/20 text-destructive",
  media: "bg-amber-500/20 text-amber-400",
  baixa: "bg-muted text-muted-foreground",
};

export function BriefingImportDialog({ open, onOpenChange, secoes, secaoId, onCreateTasks }: BriefingImportDialogProps) {
  const [step, setStep] = useState<"upload" | "review" | "done">("upload");
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<BriefingTask[]>([]);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setTasks([]);
    setFileName("");
    setLoading(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const extractExcelText = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const lines: string[] = [];
    workbook.eachSheet((sheet) => {
      lines.push(`=== ${sheet.name} ===`);
      sheet.eachRow((row) => {
        const cells = (row.values as any[])
          .slice(1)
          .map((v) => (v != null ? String(v).trim() : ""))
          .filter(Boolean);
        if (cells.length > 0) lines.push(cells.join(" | "));
      });
    });

    return lines.join("\n");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);

    try {
      console.log("[BriefingImport] Extracting text from:", file.name, "size:", file.size);
      const textoExtraido = await extractExcelText(file);
      console.log("[BriefingImport] Extracted text length:", textoExtraido.length);
      console.log("[BriefingImport] First 200 chars:", textoExtraido.substring(0, 200));
      
      if (textoExtraido.length < 20) {
        toast.error("Planilha parece vazia ou não foi possível extrair dados.");
        setLoading(false);
        return;
      }

      console.log("[BriefingImport] Calling edge function with", secoes.length, "secoes");
      const { data, error } = await supabase.functions.invoke("importar-briefing-ia", {
        body: { textoExtraido, secoes },
      });

      console.log("[BriefingImport] Response data:", JSON.stringify(data)?.substring(0, 500));
      console.log("[BriefingImport] Response error:", error);

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const tarefas = (data.tarefas || []).map((t: any) => ({
        ...t,
        secao_id: t.secao_id || secaoId,
        selected: true,
      }));

      console.log("[BriefingImport] Parsed tarefas count:", tarefas.length);

      if (tarefas.length === 0) {
        toast.error("IA não conseguiu extrair tarefas do briefing.");
        setLoading(false);
        return;
      }

      setTasks(tarefas);
      setStep("review");
    } catch (err: any) {
      toast.error("Erro ao processar briefing: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = (index: number) => {
    setTasks(prev => prev.map((t, i) => i === index ? { ...t, selected: !t.selected } : t));
  };

  const updateTaskSecao = (index: number, newSecaoId: string) => {
    setTasks(prev => prev.map((t, i) => i === index ? { ...t, secao_id: newSecaoId } : t));
  };

  const handleConfirm = () => {
    const selected = tasks.filter(t => t.selected);
    if (selected.length === 0) {
      toast.error("Selecione pelo menos uma tarefa.");
      return;
    }

    onCreateTasks(selected.map(t => ({
      titulo: t.titulo,
      descricao: t.descricao,
      prioridade: t.prioridade,
      secao_id: t.secao_id,
    })));

    toast.success(`${selected.length} tarefas criadas a partir do briefing!`);
    handleClose(false);
  };

  const selectedCount = tasks.filter(t => t.selected).length;

  // Group tasks by area
  const groupedTasks = tasks.reduce<Record<string, { task: BriefingTask; index: number }[]>>((acc, task, idx) => {
    const area = task.area || "Outros";
    if (!acc[area]) acc[area] = [];
    acc[area].push({ task, index: idx });
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Importar Briefing com IA
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            {loading ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analisando planilha com IA...</p>
                {fileName && <p className="text-xs text-muted-foreground/60">{fileName}</p>}
              </>
            ) : (
              <>
                <div
                  className="border-2 border-dashed border-border/50 rounded-xl p-10 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors flex flex-col items-center gap-3"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm font-medium">Clique para enviar a planilha de Briefing</p>
                  <p className="text-xs text-muted-foreground">Formatos aceitos: .xlsx, .xls</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </>
            )}
          </div>
        )}

        {step === "review" && (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">
                {selectedCount} de {tasks.length} tarefas selecionadas
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setTasks(prev => prev.map(t => ({ ...t, selected: true })))}>
                  Selecionar todas
                </Button>
                <Button variant="outline" size="sm" onClick={() => setTasks(prev => prev.map(t => ({ ...t, selected: false })))}>
                  Limpar seleção
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1 max-h-[50vh]">
              <div className="space-y-4 pr-3">
                {Object.entries(groupedTasks).map(([area, items]) => (
                  <div key={area}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={cn("text-[10px] border-0", AREA_COLORS[area] || "bg-muted text-muted-foreground")}>
                        {area}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{items.length} tarefas</span>
                    </div>
                    <div className="space-y-1">
                      {items.map(({ task, index }) => (
                        <div
                          key={index}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                            task.selected ? "border-primary/30 bg-primary/5" : "border-border/30 bg-muted/20 opacity-50"
                          )}
                        >
                          <Checkbox
                            checked={task.selected}
                            onCheckedChange={() => toggleTask(index)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{task.titulo}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.descricao}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className={cn("text-[9px] border-0", PRIORIDADE_COLORS[task.prioridade])}>
                                {task.prioridade}
                              </Badge>
                              <Select value={task.secao_id} onValueChange={(v) => updateTaskSecao(index, v)}>
                                <SelectTrigger className="h-6 text-[10px] w-auto min-w-[100px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {secoes.map(s => (
                                    <SelectItem key={s.id} value={s.id} className="text-xs">{s.nome}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => { reset(); }}>Cancelar</Button>
              <Button onClick={handleConfirm} disabled={selectedCount === 0} className="gap-1.5">
                <Check className="h-4 w-4" />
                Criar {selectedCount} tarefas
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
