import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, Calendar, Flag, Upload, FileText, X, Image, FileSpreadsheet, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

interface AITask {
  titulo: string;
  descricao?: string;
  secao_id?: string;
  secao_nome?: string;
  prioridade: string;
  estagio?: string;
  data_prazo?: string;
  produto_mencionado?: string;
  selected?: boolean;
}

interface AISecao {
  nome: string;
  selected?: boolean;
}

type CreateType = "secoes" | "tarefas" | "ambos";

interface CriarTarefasIADialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secoes: { id: string; nome: string }[];
  projetoId: string;
  onCreateItems: (data: { secoes: AISecao[]; tasks: AITask[]; documentFiles: File[] }) => void;
  createTasksWithAI: (prompt: string, projetoId: string, secoes: { id: string; nome: string }[], createType: string) => Promise<{ secoes: AISecao[]; tasks: AITask[] }>;
  createFromFile: (fileContent: string, fileType: string, projetoId: string, secoes: { id: string; nome: string }[], createType: string, prompt?: string) => Promise<{ secoes: AISecao[]; tasks: AITask[] }>;
  loading: boolean;
}

const PRIORIDADE_COLORS: Record<string, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-amber-500/20 text-amber-400",
  alta: "bg-destructive/20 text-destructive",
};

const ACCEPTED_PARSE_TYPES = ".xlsx,.csv,.png,.jpg,.jpeg,.webp";

export function CriarTarefasIADialog({
  open,
  onOpenChange,
  secoes,
  projetoId,
  onCreateItems,
  createTasksWithAI,
  createFromFile,
  loading,
}: CriarTarefasIADialogProps) {
  const [prompt, setPrompt] = useState("");
  const [tasks, setTasks] = useState<AITask[]>([]);
  const [newSecoes, setNewSecoes] = useState<AISecao[]>([]);
  const [step, setStep] = useState<"input" | "review">("input");
  const [createType, setCreateType] = useState<CreateType>("ambos");
  const [parseFile, setParseFile] = useState<File | null>(null);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const parseFileRef = useRef<HTMLInputElement>(null);
  const docFileRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() && !parseFile) return;
    try {
      let result: { secoes: AISecao[]; tasks: AITask[] };

      if (parseFile) {
        const content = await fileToContent(parseFile);
        result = await createFromFile(
          content, parseFile.type, projetoId, secoes, createType, prompt || undefined
        );
      } else {
        result = await createTasksWithAI(prompt, projetoId, secoes, createType);
      }

      setNewSecoes((result.secoes || []).map(s => ({ ...s, selected: true })));
      setTasks((result.tasks || []).map(t => ({ ...t, selected: true })));
      setStep("review");
    } catch {
      // error handled in hook
    }
  };

  const handleConfirm = () => {
    const selectedSecoes = newSecoes.filter(s => s.selected);
    const selectedTasks = tasks.filter(t => t.selected);
    if (selectedSecoes.length === 0 && selectedTasks.length === 0) return;
    onCreateItems({ secoes: selectedSecoes, tasks: selectedTasks, documentFiles });
    handleClose();
  };

  const handleClose = () => {
    setPrompt("");
    setTasks([]);
    setNewSecoes([]);
    setStep("input");
    setParseFile(null);
    setDocumentFiles([]);
    onOpenChange(false);
  };

  const toggleTask = (index: number) => {
    setTasks(prev => prev.map((t, i) => i === index ? { ...t, selected: !t.selected } : t));
  };

  const toggleSecao = (index: number) => {
    setNewSecoes(prev => prev.map((s, i) => i === index ? { ...s, selected: !s.selected } : s));
  };

  const getSecaoNome = (id?: string, nome?: string) => {
    if (nome) return nome;
    if (id) return secoes.find(s => s.id === id)?.nome || "—";
    return "—";
  };

  const handleParseFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setParseFile(file);
  };

  const handleDocFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setDocumentFiles(prev => [...prev, ...files]);
  };

  const removeDocFile = (index: number) => {
    setDocumentFiles(prev => prev.filter((_, i) => i !== index));
  };

  const canGenerate = (prompt.trim().length > 0 || !!parseFile) && !loading;
  const selectedCount = tasks.filter(t => t.selected).length + newSecoes.filter(s => s.selected).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Criar com IA
          </DialogTitle>
        </DialogHeader>

        {step === "input" ? (
          <div className="space-y-4 flex-1 overflow-y-auto">
            {/* Create type selector */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">O que criar?</Label>
              <div className="flex gap-3">
                {([
                  { value: "tarefas", label: "Tarefas" },
                  { value: "secoes", label: "Seções" },
                  { value: "ambos", label: "Seções + Tarefas" },
                ] as { value: CreateType; label: string }[]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setCreateType(opt.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm font-medium transition-colors border",
                      createType === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Descreva o que precisa {parseFile ? "(opcional)" : ""}
              </Label>
              <Textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder='Ex: "Precisamos criar rótulo, ficha técnica e arte final do Shampoo Revitalizante até dia 20."'
                className="min-h-[90px] resize-none"
                autoFocus
              />
            </div>

            {/* Parse file upload */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Planilha ou imagem para interpretar
              </Label>
              {parseFile ? (
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border/50">
                  {parseFile.type.startsWith("image/") ? (
                    <Image className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-sm truncate flex-1">{parseFile.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setParseFile(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => parseFileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-md border border-dashed border-border/50 text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  Enviar .xlsx, .csv ou imagem
                </button>
              )}
              <input
                ref={parseFileRef}
                type="file"
                accept={ACCEPTED_PARSE_TYPES}
                className="hidden"
                onChange={handleParseFileChange}
              />
            </div>

            {/* Document files to attach */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Documentos para vincular às tarefas
              </Label>
              <button
                onClick={() => docFileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-md border border-dashed border-border/50 text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
              >
                <Paperclip className="h-4 w-4" />
                Anexar documentos
              </button>
              <input
                ref={docFileRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleDocFilesChange}
              />
              {documentFiles.length > 0 && (
                <div className="space-y-1 mt-1">
                  {documentFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1 rounded bg-muted/30 text-sm">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{file.name}</span>
                      <span className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(0)}KB</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeDocFile(i)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick examples */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">Exemplos:</span>
              {[
                "Criar briefing e arte para novo produto",
                "Revisar documentação regulatória do lote 2025",
                "Preparar lançamento da linha premium",
              ].map(ex => (
                <button
                  key={ex}
                  onClick={() => setPrompt(ex)}
                  className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            <p className="text-sm text-muted-foreground">
              {newSecoes.length > 0 && `${newSecoes.length} seção(ões)`}
              {newSecoes.length > 0 && tasks.length > 0 && " e "}
              {tasks.length > 0 && `${tasks.length} tarefa(s)`}
              {" "}geradas. Revise e selecione:
            </p>

            {/* New sections */}
            {newSecoes.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seções</h4>
                {newSecoes.map((secao, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg border transition-colors",
                      secao.selected ? "border-primary/30 bg-primary/5" : "border-border/50 opacity-60"
                    )}
                  >
                    <Checkbox checked={secao.selected} onCheckedChange={() => toggleSecao(i)} />
                    <span className="font-medium text-sm">📁 {secao.nome}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tasks */}
            {tasks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tarefas</h4>
                {tasks.map((task, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                      task.selected ? "border-primary/30 bg-primary/5" : "border-border/50 opacity-60"
                    )}
                  >
                    <Checkbox checked={task.selected} onCheckedChange={() => toggleTask(i)} className="mt-0.5" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{task.titulo}</span>
                        <Badge variant="outline" className={cn("text-[10px]", PRIORIDADE_COLORS[task.prioridade])}>
                          <Flag className="h-3 w-3 mr-0.5" />
                          {task.prioridade}
                        </Badge>
                        {task.estagio && (
                          <Badge variant="outline" className="text-[10px]">{task.estagio}</Badge>
                        )}
                      </div>
                      {task.descricao && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{task.descricao}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>📁 {getSecaoNome(task.secao_id, task.secao_nome)}</span>
                        {task.data_prazo && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {task.data_prazo}
                          </span>
                        )}
                        {task.produto_mencionado && (
                          <span>📦 {task.produto_mencionado}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Document files preview */}
            {documentFiles.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Documentos a vincular ({documentFiles.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {documentFiles.map((file, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] gap-1">
                      <FileText className="h-3 w-3" />
                      {file.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "input" ? (
            <Button onClick={handleGenerate} disabled={!canGenerate} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Gerar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("input")}>Voltar</Button>
              <Button onClick={handleConfirm} disabled={selectedCount === 0} className="gap-2">
                Criar {selectedCount} item(ns)
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helpers
async function fileToContent(file: File): Promise<string> {
  if (file.type.startsWith("image/")) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]); // base64 without prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // For CSV/text-based files
  if (file.name.endsWith(".csv") || file.type === "text/csv") {
    return file.text();
  }

  // For XLSX - read as base64 and let AI interpret
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
