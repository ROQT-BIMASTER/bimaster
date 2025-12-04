import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import ProductThumbnail from "./ProductThumbnail";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Rocket, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Produto {
  id: string;
  codigo: string;
  nome: string;
  foto_url: string | null;
}

interface TarefaTemplate {
  tipo: string;
  titulo: string;
  descricao: string;
}

interface Template {
  id: string;
  nome: string;
  descricao: string | null;
  tarefas: TarefaTemplate[];
}

interface QuickLaunchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto: Produto | null;
  preselectedDate?: Date;
  onSuccess?: () => void;
}

export default function QuickLaunchDialog({
  open,
  onOpenChange,
  produto,
  preselectedDate,
  onSuccess,
}: QuickLaunchDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    data_prevista: preselectedDate || new Date(),
    tipo: "novo_produto",
    prioridade: "media",
    templateId: "",
  });
  const [selectedTarefas, setSelectedTarefas] = useState<string[]>([]);

  // Fetch templates
  const { data: templates } = useQuery({
    queryKey: ["launch-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_templates_lancamento")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return (data || []).map(t => ({
        ...t,
        tarefas: (t.tarefas as unknown as TarefaTemplate[]) || []
      })) as Template[];
    },
    enabled: open,
  });

  // Fetch responsaveis
  const { data: responsaveis } = useQuery({
    queryKey: ["responsaveis-lancamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .order("nome");

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Reset form when produto changes
  useEffect(() => {
    if (produto && open) {
      setFormData({
        nome: `${produto.nome} - Lançamento`,
        data_prevista: preselectedDate || new Date(),
        tipo: "novo_produto",
        prioridade: "media",
        templateId: "",
      });
      setSelectedTarefas([]);
    }
  }, [produto, open, preselectedDate]);

  // Update selected tarefas when template changes
  useEffect(() => {
    if (formData.templateId && templates) {
      const template = templates.find(t => t.id === formData.templateId);
      if (template) {
        setSelectedTarefas(template.tarefas.map(t => t.tipo));
      }
    }
  }, [formData.templateId, templates]);

  const selectedTemplate = templates?.find(t => t.id === formData.templateId);

  const handleSubmit = async () => {
    if (!produto) return;
    
    setLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Create lancamento
      const { data: lancamento, error: lancamentoError } = await supabase
        .from("lancamentos_produtos")
        .insert({
          nome_lancamento: formData.nome,
          produto_id: produto.id,
          data_prevista: formData.data_prevista.toISOString(),
          tipo: formData.tipo,
          prioridade: formData.prioridade,
          status: "planejado",
          responsavel_id: user.id,
          created_by: user.id,
        })
        .select()
        .single();

      if (lancamentoError) throw lancamentoError;

      // Create marketing tasks from template
      if (selectedTemplate && selectedTarefas.length > 0) {
        const tarefasToCreate = selectedTemplate.tarefas
          .filter(t => selectedTarefas.includes(t.tipo))
          .map(t => ({
            lancamento_id: lancamento.id,
            tipo: t.tipo,
            titulo: t.titulo,
            descricao: t.descricao,
            status: "pendente",
            created_by: user.id,
          }));

        if (tarefasToCreate.length > 0) {
          const { error: tarefasError } = await supabase
            .from("lancamentos_tarefas_marketing")
            .insert(tarefasToCreate);

          if (tarefasError) throw tarefasError;
        }
      }

      // Update product status
      await supabase
        .from("fabrica_produtos")
        .update({ status_lancamento: "agendado" })
        .eq("id", produto.id);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      queryClient.invalidateQueries({ queryKey: ["produtos-pendentes-lancamento"] });
      queryClient.invalidateQueries({ queryKey: ["fabrica-produtos"] });

      toast.success("Lançamento criado com sucesso!");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error creating launch:", error);
      toast.error("Erro ao criar lançamento");
    } finally {
      setLoading(false);
    }
  };

  const toggleTarefa = (tipo: string) => {
    setSelectedTarefas(prev =>
      prev.includes(tipo)
        ? prev.filter(t => t !== tipo)
        : [...prev, tipo]
    );
  };

  if (!produto) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Criar Lançamento Rápido
          </DialogTitle>
          <DialogDescription>
            Configure o lançamento para o produto selecionado
          </DialogDescription>
        </DialogHeader>

        {/* Product Preview */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border">
          <ProductThumbnail src={produto.foto_url} size="lg" />
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold truncate">{produto.nome}</h4>
            <p className="text-sm text-muted-foreground font-mono">{produto.codigo}</p>
          </div>
          <Badge variant="secondary" className="bg-amber-100 text-amber-700">
            Pendente
          </Badge>
        </div>

        <div className="space-y-4">
          {/* Nome */}
          <div className="space-y-2">
            <Label>Nome do Lançamento</Label>
            <Input
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Lançamento Primavera 2024"
            />
          </div>

          {/* Data */}
          <div className="space-y-2">
            <Label>Data Prevista *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.data_prevista && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.data_prevista
                    ? format(formData.data_prevista, "PPP", { locale: ptBR })
                    : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.data_prevista}
                  onSelect={(date) => date && setFormData({ ...formData, data_prevista: date })}
                  locale={ptBR}
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Tipo e Prioridade */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={formData.tipo}
                onValueChange={(v) => setFormData({ ...formData, tipo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="novo_produto">✨ Novo Produto</SelectItem>
                  <SelectItem value="reformulacao">🔄 Reformulação</SelectItem>
                  <SelectItem value="nova_versao">📦 Nova Versão</SelectItem>
                  <SelectItem value="promocional">🎁 Promocional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select
                value={formData.prioridade}
                onValueChange={(v) => setFormData({ ...formData, prioridade: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">🔴 Alta</SelectItem>
                  <SelectItem value="media">🟡 Média</SelectItem>
                  <SelectItem value="baixa">🟢 Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Template de Tarefas
            </Label>
            <Select
              value={formData.templateId}
              onValueChange={(v) => setFormData({ ...formData, templateId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um template (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <p className="text-xs text-muted-foreground">{selectedTemplate.descricao}</p>
            )}
          </div>

          {/* Tarefas from Template */}
          {selectedTemplate && selectedTemplate.tarefas.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Tarefas de Marketing</Label>
              <div className="space-y-2 p-3 rounded-lg bg-muted/30 border">
                {selectedTemplate.tarefas.map((tarefa) => (
                  <div
                    key={tarefa.tipo}
                    className="flex items-center gap-3"
                  >
                    <Checkbox
                      id={tarefa.tipo}
                      checked={selectedTarefas.includes(tarefa.tipo)}
                      onCheckedChange={() => toggleTarefa(tarefa.tipo)}
                    />
                    <label
                      htmlFor={tarefa.tipo}
                      className="flex-1 text-sm cursor-pointer"
                    >
                      {tarefa.titulo}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedTarefas.length} tarefa{selectedTarefas.length !== 1 ? "s" : ""} selecionada{selectedTarefas.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !formData.nome || !formData.data_prevista}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Criar Lançamento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
