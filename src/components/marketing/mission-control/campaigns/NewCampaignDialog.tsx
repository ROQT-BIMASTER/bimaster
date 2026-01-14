import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Loader2 } from "lucide-react";

interface NewCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const tipos = [
  { value: 'lancamento', label: 'Lançamento' },
  { value: 'promocao', label: 'Promoção' },
  { value: 'branding', label: 'Branding' },
  { value: 'sazonal', label: 'Sazonal' },
  { value: 'institucional', label: 'Institucional' },
];

export function NewCampaignDialog({ open, onOpenChange }: NewCampaignDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    tipo: 'lancamento',
    data_inicio: '',
    data_fim: '',
    orcamento: '',
    objetivo: '',
    responsavel_id: '',
  });

  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .order('nome');
      if (error) throw error;
      return data;
    }
  });

  const createCampaign = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('marketing_campanhas')
        .insert({
          nome: formData.nome,
          descricao: formData.descricao || null,
          tipo: formData.tipo,
          data_inicio: formData.data_inicio || null,
          data_fim: formData.data_fim || null,
          orcamento: formData.orcamento ? parseFloat(formData.orcamento) : null,
          objetivo: formData.objetivo || null,
          responsavel_id: formData.responsavel_id || user.id,
          status: 'rascunho',
          progresso: 0,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] });
      toast.success('Campanha criada com sucesso!');
      onOpenChange(false);
      setFormData({
        nome: '',
        descricao: '',
        tipo: 'lancamento',
        data_inicio: '',
        data_fim: '',
        orcamento: '',
        objetivo: '',
        responsavel_id: '',
      });
    },
    onError: (error) => {
      toast.error('Erro ao criar campanha: ' + error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    createCampaign.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Campanha</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Nome da campanha"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva a campanha..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
              <Label>Responsável</Label>
              <Select
                value={formData.responsavel_id}
                onValueChange={(value) => setFormData({ ...formData, responsavel_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_inicio">Data Início</Label>
              <Input
                id="data_inicio"
                type="date"
                value={formData.data_inicio}
                onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_fim">Data Fim</Label>
              <Input
                id="data_fim"
                type="date"
                value={formData.data_fim}
                onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="orcamento">Orçamento (R$)</Label>
              <Input
                id="orcamento"
                type="number"
                value={formData.orcamento}
                onChange={(e) => setFormData({ ...formData, orcamento: e.target.value })}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="objetivo">Objetivo</Label>
              <Input
                id="objetivo"
                value={formData.objetivo}
                onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })}
                placeholder="Ex: 10k seguidores"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createCampaign.isPending}>
              {createCampaign.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Campanha
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
