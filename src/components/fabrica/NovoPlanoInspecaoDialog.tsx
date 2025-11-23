import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface NovoPlanoInspecaoDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function NovoPlanoInspecaoDialog({ open, onClose }: NovoPlanoInspecaoDialogProps) {
  const queryClient = useQueryClient();
  const [produtoId, setProdutoId] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipoInspecao, setTipoInspecao] = useState("");
  const [frequencia, setFrequencia] = useState("");
  const [tamanhoAmostra, setTamanhoAmostra] = useState("");

  // Buscar produtos
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
    enabled: open,
  });

  const criarPlano = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getUser();

      const { error } = await supabase.from("fabrica_planos_inspecao").insert({
        produto_id: produtoId,
        nome,
        descricao: descricao || null,
        tipo_inspecao: tipoInspecao,
        frequencia: frequencia || null,
        tamanho_amostra: tamanhoAmostra ? parseInt(tamanhoAmostra) : null,
        checklist: [],
        created_by: session.user!.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planos-inspecao"] });
      toast.success("Plano criado com sucesso!");
      handleClose();
    },
    onError: () => {
      toast.error("Erro ao criar plano");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!produtoId || !nome || !tipoInspecao) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    criarPlano.mutate();
  };

  const handleClose = () => {
    setProdutoId("");
    setNome("");
    setDescricao("");
    setTipoInspecao("");
    setFrequencia("");
    setTamanhoAmostra("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo Plano de Inspeção</DialogTitle>
          <DialogDescription>
            Crie um plano de inspeção para um produto
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="produto">Produto *</Label>
            <Select value={produtoId} onValueChange={setProdutoId}>
              <SelectTrigger id="produto">
                <SelectValue placeholder="Selecione o produto" />
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

          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Plano *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Inspeção Final - Produto X"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o plano de inspeção..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Inspeção *</Label>
              <Select value={tipoInspecao} onValueChange={setTipoInspecao}>
                <SelectTrigger id="tipo">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada (MP)</SelectItem>
                  <SelectItem value="processo">Durante Processo</SelectItem>
                  <SelectItem value="final">Inspeção Final</SelectItem>
                  <SelectItem value="periodica">Periódica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequencia">Frequência</Label>
              <Select value={frequencia} onValueChange={setFrequencia}>
                <SelectTrigger id="frequencia">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cada_lote">Cada Lote</SelectItem>
                  <SelectItem value="diaria">Diária</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="amostragem">Amostragem</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amostra">Tamanho da Amostra (unidades)</Label>
            <Input
              id="amostra"
              type="number"
              value={tamanhoAmostra}
              onChange={(e) => setTamanhoAmostra(e.target.value)}
              placeholder="Ex: 10"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={criarPlano.isPending}>
              {criarPlano.isPending ? "Criando..." : "Criar Plano"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
