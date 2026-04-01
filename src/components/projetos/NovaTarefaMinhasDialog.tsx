import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface NovaTarefaMinhasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovaTarefaMinhasDialog({ open, onOpenChange }: NovaTarefaMinhasDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [projetoId, setProjetoId] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [dataPrazo, setDataPrazo] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);

  const { data: projetos = [] } = useQuery({
    queryKey: ["meus-projetos-select", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("projeto_membros")
        .select("projeto_id, projetos:projeto_id(id, nome, cor)")
        .eq("user_id", user.id);
      return (data || []).map((m: any) => ({
        id: m.projetos?.id,
        nome: m.projetos?.nome,
        cor: m.projetos?.cor || "#6366f1",
      })).filter((p: any) => p.id);
    },
    enabled: !!user?.id && open,
  });

  const handleSubmit = async () => {
    if (!titulo.trim() || !projetoId || !user?.id) return;
    setSaving(true);

    // Get first section of the project for required secao_id
    const { data: secoes } = await supabase
      .from("projeto_secoes")
      .select("id")
      .eq("projeto_id", projetoId)
      .order("ordem", { ascending: true })
      .limit(1);

    const secaoId = secoes?.[0]?.id;
    if (!secaoId) {
      toast.error("Projeto sem seções. Crie uma seção primeiro.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("projeto_tarefas").insert({
      titulo: titulo.trim(),
      projeto_id: projetoId,
      secao_id: secaoId,
      responsavel_id: user.id,
      criador_id: user.id,
      prioridade,
      data_prazo: dataPrazo ? format(dataPrazo, "yyyy-MM-dd") : null,
      status: "pendente",
    });

    setSaving(false);
    if (error) {
      toast.error(`Erro ao criar tarefa: ${error.message}`);
      return;
    }

    toast.success("Tarefa criada!");
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    setTitulo("");
    setProjetoId("");
    setPrioridade("media");
    setDataPrazo(undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nova Tarefa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs">Título</Label>
            <Input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Nome da tarefa..."
              autoFocus
              onKeyDown={e => e.key === "Enter" && !saving && handleSubmit()}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Projeto</Label>
            <Select value={projetoId} onValueChange={setProjetoId}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Selecione o projeto" />
              </SelectTrigger>
              <SelectContent>
                {projetos.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.cor }} />
                      {p.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Prazo</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm h-10", !dataPrazo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataPrazo ? format(dataPrazo, "d MMM yyyy", { locale: ptBR }) : "Sem prazo"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataPrazo}
                    onSelect={setDataPrazo}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgente">🔴 Urgente</SelectItem>
                  <SelectItem value="alta">🟠 Alta</SelectItem>
                  <SelectItem value="media">🟡 Média</SelectItem>
                  <SelectItem value="baixa">🟢 Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!titulo.trim() || !projetoId || saving}>
            {saving ? "Criando..." : "Criar tarefa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
