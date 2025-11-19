import { useState } from "react";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface NovaOrdemProducaoDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NovaOrdemProducaoDialog({
  open,
  onClose,
}: NovaOrdemProducaoDialogProps) {
  const queryClient = useQueryClient();
  const [produtoId, setProdutoId] = useState("");
  const [formulaId, setFormulaId] = useState("");
  const [quantidade, setQuantidade] = useState(100);
  const [dataPrevista, setDataPrevista] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [lote, setLote] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const { data: produtos } = useQuery({
    queryKey: ["fabrica-produtos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_produtos")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return data;
    },
  });

  const { data: formulas } = useQuery({
    queryKey: ["fabrica-formulas-produto", produtoId],
    queryFn: async () => {
      if (!produtoId) return [];

      const { data, error } = await supabase
        .from("fabrica_formulas")
        .select("*")
        .eq("produto_id", produtoId)
        .eq("ativa", true);

      if (error) throw error;
      return data;
    },
    enabled: !!produtoId,
  });

  const criarMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      if (!userId) throw new Error("Usuário não autenticado");
      if (!produtoId) throw new Error("Selecione um produto");
      if (!formulaId) throw new Error("Selecione uma fórmula");
      if (quantidade <= 0) throw new Error("Quantidade deve ser maior que zero");

      // Gerar número sequencial
      const numero = `OP-${Date.now()}`;

      const { data, error } = await supabase
        .from("fabrica_ordens_producao")
        .insert({
          numero,
          produto_id: produtoId,
          formula_id: formulaId,
          quantidade_planejada: quantidade,
          data_prevista: dataPrevista,
          lote: lote || `LOTE-${Date.now()}`,
          observacoes,
          status: "pendente",
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Ordem de produção criada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["fabrica-ordens-producao"] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar ordem de produção");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova Ordem de Produção</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Produto *</Label>
              <Select value={produtoId} onValueChange={setProdutoId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {produtos?.map((produto) => (
                    <SelectItem key={produto.id} value={produto.id}>
                      {produto.codigo} - {produto.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Fórmula *</Label>
              <Select
                value={formulaId}
                onValueChange={setFormulaId}
                disabled={!produtoId}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecione o produto primeiro" />
                </SelectTrigger>
                <SelectContent>
                  {formulas?.map((formula) => (
                    <SelectItem key={formula.id} value={formula.id}>
                      Versão {formula.versao || 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Quantidade *</Label>
              <Input
                type="number"
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
                min="1"
                className="mt-2"
              />
            </div>

            <div>
              <Label>Data Prevista *</Label>
              <Input
                type="date"
                value={dataPrevista}
                onChange={(e) => setDataPrevista(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <Label>Lote</Label>
            <Input
              value={lote}
              onChange={(e) => setLote(e.target.value)}
              placeholder="Deixe vazio para gerar automaticamente"
              className="mt-2"
            />
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Instruções especiais..."
              rows={3}
              className="mt-2"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => criarMutation.mutate()}
            disabled={criarMutation.isPending}
          >
            {criarMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Criar Ordem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
