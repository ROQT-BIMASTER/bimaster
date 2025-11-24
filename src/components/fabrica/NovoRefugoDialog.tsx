import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NovoRefugoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovoRefugoDialog({ open, onOpenChange }: NovoRefugoDialogProps) {
  const queryClient = useQueryClient();
  const [ordemProducaoId, setOrdemProducaoId] = useState("");
  const [causaId, setCausaId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Buscar OPs
  const { data: ops } = useQuery({
    queryKey: ["fabrica-ops-refugo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_ordens_producao")
        .select("id, numero, fabrica_produtos(nome)")
        .in("status", ["em_producao", "concluida"])
        .order("numero", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Buscar causas de refugo
  const { data: causas } = useQuery({
    queryKey: ["fabrica-causas-refugo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_causas_refugo")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      
      if (error) throw error;
      return data;
    },
  });

  const criarRefugo = useMutation({
    mutationFn: async (dados: {
      ordem_producao_id: string;
      causa_refugo_id: string;
      quantidade: number;
      observacoes?: string;
    }) => {
      const { data: session } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("fabrica_refugos")
        .insert({
          ...dados,
          created_by: session.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fabrica-refugos"] });
      toast.success("Refugo registrado com sucesso!");
      handleClose();
    },
    onError: () => {
      toast.error("Erro ao registrar refugo");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const qtd = parseFloat(quantidade);
    
    if (!ordemProducaoId || !causaId || !quantidade || isNaN(qtd) || qtd <= 0) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    criarRefugo.mutate({
      ordem_producao_id: ordemProducaoId,
      causa_refugo_id: causaId,
      quantidade: qtd,
      observacoes: observacoes || undefined,
    });
  };

  const handleClose = () => {
    setOrdemProducaoId("");
    setCausaId("");
    setQuantidade("");
    setObservacoes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Refugo</DialogTitle>
          <DialogDescription>
            Registre produtos refugados durante a produção
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="op">Ordem de Produção *</Label>
            <Select value={ordemProducaoId} onValueChange={setOrdemProducaoId}>
              <SelectTrigger id="op">
                <SelectValue placeholder="Selecione uma OP" />
              </SelectTrigger>
              <SelectContent>
                {ops?.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    OP {op.numero} - {op.fabrica_produtos?.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="causa">Causa do Refugo *</Label>
            <Select value={causaId} onValueChange={setCausaId}>
              <SelectTrigger id="causa">
                <SelectValue placeholder="Selecione a causa" />
              </SelectTrigger>
              <SelectContent>
                {causas?.map((causa) => (
                  <SelectItem key={causa.id} value={causa.id}>
                    {causa.descricao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantidade">Quantidade *</Label>
            <Input
              id="quantidade"
              type="number"
              step="0.001"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              placeholder="Ex: 10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="obs">Observações</Label>
            <Textarea
              id="obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Detalhes sobre o refugo..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={criarRefugo.isPending}>
              {criarRefugo.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
