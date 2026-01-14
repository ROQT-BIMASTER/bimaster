import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface NewTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const tipos = [
  { value: 'post_instagram', label: 'Post Instagram' },
  { value: 'post_tiktok', label: 'Post TikTok' },
  { value: 'catalogo', label: 'Catálogo' },
  { value: 'video', label: 'Vídeo' },
  { value: 'email', label: 'Email Marketing' },
  { value: 'banner', label: 'Banner' },
  { value: 'arte', label: 'Arte Gráfica' },
  { value: 'campanha', label: 'Campanha Completa' },
];

export function NewTemplateDialog({ open, onOpenChange }: NewTemplateDialogProps) {
  const queryClient = useQueryClient();
  const [checklistItem, setChecklistItem] = useState("");
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    tipo: 'post_instagram',
    sla_dias: '3',
    pontos_base: '10',
    checklist: [] as string[],
  });

  const createTemplate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('marketing_templates')
        .insert({
          nome: formData.nome,
          descricao: formData.descricao || null,
          tipo: formData.tipo,
          sla_dias: parseInt(formData.sla_dias) || 3,
          pontos_base: parseInt(formData.pontos_base) || 10,
          checklist_padrao: formData.checklist.map((item, i) => ({
            titulo: item,
            ordem: i + 1,
          })),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-templates'] });
      toast.success('Template criado com sucesso!');
      onOpenChange(false);
      setFormData({
        nome: '',
        descricao: '',
        tipo: 'post_instagram',
        sla_dias: '3',
        pontos_base: '10',
        checklist: [],
      });
    },
    onError: (error) => {
      toast.error('Erro ao criar template: ' + error.message);
    }
  });

  const handleAddChecklistItem = () => {
    if (!checklistItem.trim()) return;
    setFormData({
      ...formData,
      checklist: [...formData.checklist, checklistItem.trim()],
    });
    setChecklistItem("");
  };

  const handleRemoveChecklistItem = (index: number) => {
    setFormData({
      ...formData,
      checklist: formData.checklist.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    createTemplate.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Template</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Nome do template"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva o template..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => setFormData({ ...formData, tipo: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tipos.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sla_dias">SLA (dias)</Label>
              <Input
                id="sla_dias"
                type="number"
                value={formData.sla_dias}
                onChange={(e) => setFormData({ ...formData, sla_dias: e.target.value })}
                min={1}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pontos_base">Pontos</Label>
              <Input
                id="pontos_base"
                type="number"
                value={formData.pontos_base}
                onChange={(e) => setFormData({ ...formData, pontos_base: e.target.value })}
                min={0}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Checklist Padrão</Label>
            <div className="flex gap-2">
              <Input
                value={checklistItem}
                onChange={(e) => setChecklistItem(e.target.value)}
                placeholder="Adicionar item..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChecklistItem();
                  }
                }}
              />
              <Button type="button" size="icon" onClick={handleAddChecklistItem}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {formData.checklist.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.checklist.map((item, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {item}
                    <button
                      type="button"
                      onClick={() => handleRemoveChecklistItem(i)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createTemplate.isPending}>
              {createTemplate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
