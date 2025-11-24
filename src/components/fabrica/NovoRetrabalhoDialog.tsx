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

interface NovoRetrabalhoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovoRetrabalhoDialog({ open, onOpenChange }: NovoRetrabalhoDialogProps) {
  const queryClient = useQueryClient();
  const [ordemProducaoId, setOrdemProducaoId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [quantidadeRecuperada, setQuantidadeRecuperada] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [resultado, setResultado] = useState<string | undefined>();

  // Buscar OPs
  const { data: ops } = useQuery({
    queryKey: ["fabrica-ops-retrabalho"],
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

  // Não precisamos de query para motivos, o usuário digita livremente

  const criarRetrabalho = useMutation({
    mutationFn: async (dados: {
      ordem_producao_original_id: string;
      motivo: string;
      quantidade: number;
      resultado?: string;
      observacoes?: string;
    }) => {
      const { data: session } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("fabrica_retrabalhos")
        .insert({
          ...dados,
          created_by: session.user?.id,
          data_inicio: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fabrica-retrabalhos"] });
      toast.success("Retrabalho registrado com sucesso!");
      handleClose();
    },
    onError: () => {
      toast.error("Erro ao registrar retrabalho");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const qtd = parseFloat(quantidade);
    
    if (!ordemProducaoId || !motivo || !quantidade || isNaN(qtd) || qtd <= 0) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    criarRetrabalho.mutate({
      ordem_producao_original_id: ordemProducaoId,
      motivo,
      quantidade: qtd,
      resultado: resultado || undefined,
      observacoes: observacoes || undefined,
    });
  };

  const handleClose = () => {
    setOrdemProducaoId("");
    setMotivo("");
    setQuantidade("");
    setQuantidadeRecuperada("");
    setObservacoes("");
    setResultado(undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Retrabalho</DialogTitle>
          <DialogDescription>
            Registre produtos que precisam ser retrabalhados
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
            <Label htmlFor="motivo">Motivo *</Label>
            <Input
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Defeito de fabricação"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="resultado">Resultado</Label>
            <Select value={resultado} onValueChange={(value) => setResultado(value === "null" ? undefined : value)}>
              <SelectTrigger id="resultado">
                <SelectValue placeholder="Selecione o resultado (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Sem resultado ainda</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="reprovado">Reprovado</SelectItem>
                <SelectItem value="parcial">Parcialmente aprovado</SelectItem>
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
            <Label htmlFor="recuperada">Quantidade Recuperada</Label>
            <Input
              id="recuperada"
              type="number"
              step="0.001"
              value={quantidadeRecuperada}
              onChange={(e) => setQuantidadeRecuperada(e.target.value)}
              placeholder="Ex: 8"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="obs">Observações</Label>
            <Textarea
              id="obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Detalhes sobre o retrabalho..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={criarRetrabalho.isPending}>
              {criarRetrabalho.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
