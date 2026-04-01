import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, ExternalLink, CheckCircle2, Clock, AlertTriangle, Flag, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

interface Props {
  tarefa: MinaTarefa | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusOptions = [
  { value: "pendente", label: "Pendente", icon: Clock, color: "text-muted-foreground" },
  { value: "em_progresso", label: "Em progresso", icon: Clock, color: "text-primary" },
  { value: "concluida", label: "Concluída", icon: CheckCircle2, color: "text-success" },
];

const prioridadeOptions = [
  { value: "baixa", label: "Baixa", color: "bg-muted text-muted-foreground" },
  { value: "media", label: "Média", color: "bg-primary/10 text-primary" },
  { value: "alta", label: "Alta", color: "bg-warning/10 text-warning" },
  { value: "urgente", label: "Urgente", color: "bg-destructive/10 text-destructive" },
];

export function MinhasTarefaDetail({ tarefa, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState("pendente");
  const [prioridade, setPrioridade] = useState("media");
  const [dataPrazo, setDataPrazo] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);

  // Sync state when tarefa changes
  const resetFields = (t: MinaTarefa) => {
    setTitulo(t.titulo);
    setDescricao("");
    setStatus(t.status);
    setPrioridade(t.prioridade || "media");
    setDataPrazo(t.data_prazo ? new Date(t.data_prazo) : undefined);
  };

  // Use effect equivalent via key
  const handleOpenChange = (o: boolean) => {
    if (o && tarefa) resetFields(tarefa);
    onOpenChange(o);
  };

  if (!tarefa) return null;

  // On first open
  if (open && titulo === "" && tarefa.titulo) {
    resetFields(tarefa);
  }

  const isOverdue = tarefa.status !== "concluida" && tarefa.data_prazo && new Date(tarefa.data_prazo) < new Date();

  const handleSave = async () => {
    setSaving(true);
    const update: Record<string, any> = {
      titulo,
      status,
      prioridade,
      data_prazo: dataPrazo ? format(dataPrazo, "yyyy-MM-dd") : null,
    };
    if (status === "concluida" && tarefa.status !== "concluida") {
      update.data_conclusao = new Date().toISOString();
    } else if (status !== "concluida") {
      update.data_conclusao = null;
    }

    const { error } = await supabase.from("projeto_tarefas").update(update).eq("id", tarefa.id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    toast.success("Tarefa atualizada!");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: tarefa.projeto_cor }} />
            <span className="text-xs text-muted-foreground">{tarefa.projeto_nome}</span>
            {isOverdue && (
              <Badge variant="destructive" className="text-[10px] h-4 ml-auto">
                <AlertTriangle className="h-3 w-3 mr-1" /> Atrasada
              </Badge>
            )}
          </div>
          <SheetTitle className="sr-only">Detalhe da tarefa</SheetTitle>
        </SheetHeader>

        <div className="space-y-5">
          {/* Title */}
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="text-lg font-semibold border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
            placeholder="Título da tarefa"
          />

          {/* Status & Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      <div className="flex items-center gap-2">
                        <o.icon className={cn("h-3.5 w-3.5", o.color)} />
                        {o.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {prioridadeOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      <div className="flex items-center gap-2">
                        <Flag className={cn("h-3.5 w-3.5", o.color.includes("destructive") ? "text-destructive" : o.color.includes("warning") ? "text-warning" : o.color.includes("primary") ? "text-primary" : "text-muted-foreground")} />
                        {o.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Prazo</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9 text-xs", !dataPrazo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {dataPrazo ? format(dataPrazo, "PPP", { locale: ptBR }) : "Sem prazo definido"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataPrazo}
                  onSelect={setDataPrazo}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Observações</label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Adicione observações sobre esta tarefa..."
              className="min-h-[100px] text-sm resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving || !titulo.trim()} className="flex-1 gap-1.5">
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                onOpenChange(false);
                navigate(`/dashboard/projetos/${tarefa.projeto_id}`);
              }}
              title="Abrir no projeto"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
