import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface NovaInspecaoDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function NovaInspecaoDialog({ open, onClose }: NovaInspecaoDialogProps) {
  const queryClient = useQueryClient();
  const [loteId, setLoteId] = useState("");
  const [planoId, setPlanoId] = useState("");
  const [resultado, setResultado] = useState("");
  const [qtdInspecionada, setQtdInspecionada] = useState("");
  const [qtdAprovada, setQtdAprovada] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Buscar lotes ativos
  const { data: lotes } = useQuery({
    queryKey: ["fabrica-lotes-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_lotes")
        .select(`
          *,
          fabrica_materias_primas(nome, codigo)
        `)
        .eq("status", "ativo")
        .order("data_fabricacao", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Buscar planos de inspeção
  const { data: planos } = useQuery({
    queryKey: ["fabrica-planos-inspecao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_planos_inspecao")
        .select("*")
        .eq("ativo", true);

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const criarInspecao = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getUser();

      const qtdInsp = parseFloat(qtdInspecionada);
      const qtdApr = parseFloat(qtdAprovada);
      const qtdRep = qtdInsp - qtdApr;
      const indiceConf = (qtdApr / qtdInsp) * 100;

      const { error } = await supabase.from("fabrica_inspecoes_qualidade").insert({
        lote_id: loteId,
        plano_inspecao_id: planoId || null,
        inspetor_id: session.user!.id,
        resultado,
        resultados_checklist: [],
        quantidade_inspecionada: qtdInsp,
        quantidade_aprovada: qtdApr,
        quantidade_reprovada: qtdRep,
        indice_conformidade: indiceConf,
        observacoes: observacoes || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspecoes-qualidade"] });
      queryClient.invalidateQueries({ queryKey: ["fabrica-lotes-ativos"] });
      toast.success("Inspeção registrada com sucesso!");
      handleClose();
    },
    onError: () => {
      toast.error("Erro ao registrar inspeção");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!loteId || !resultado || !qtdInspecionada || !qtdAprovada) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const qtdInsp = parseFloat(qtdInspecionada);
    const qtdApr = parseFloat(qtdAprovada);

    if (isNaN(qtdInsp) || qtdInsp <= 0 || isNaN(qtdApr) || qtdApr < 0 || qtdApr > qtdInsp) {
      toast.error("Quantidades inválidas");
      return;
    }

    criarInspecao.mutate();
  };

  const handleClose = () => {
    setLoteId("");
    setPlanoId("");
    setResultado("");
    setQtdInspecionada("");
    setQtdAprovada("");
    setObservacoes("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Inspeção de Qualidade</DialogTitle>
          <DialogDescription>Registre uma inspeção de qualidade</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lote">Lote *</Label>
            <Select value={loteId} onValueChange={setLoteId}>
              <SelectTrigger id="lote">
                <SelectValue placeholder="Selecione o lote" />
              </SelectTrigger>
              <SelectContent>
                {lotes?.map((lote) => (
                  <SelectItem key={lote.id} value={lote.id}>
                    {lote.codigo_lote} - {lote.fabrica_materias_primas?.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plano">Plano de Inspeção (opcional)</Label>
            <Select value={planoId} onValueChange={setPlanoId}>
              <SelectTrigger id="plano">
                <SelectValue placeholder="Selecione o plano" />
              </SelectTrigger>
              <SelectContent>
                {planos?.map((plano) => (
                  <SelectItem key={plano.id} value={plano.id}>
                    {plano.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="qtd-insp">Quantidade Inspecionada *</Label>
              <Input
                id="qtd-insp"
                type="number"
                step="0.001"
                value={qtdInspecionada}
                onChange={(e) => setQtdInspecionada(e.target.value)}
                placeholder="Ex: 100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="qtd-apr">Quantidade Aprovada *</Label>
              <Input
                id="qtd-apr"
                type="number"
                step="0.001"
                value={qtdAprovada}
                onChange={(e) => setQtdAprovada(e.target.value)}
                placeholder="Ex: 98"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resultado">Resultado *</Label>
            <Select value={resultado} onValueChange={setResultado}>
              <SelectTrigger id="resultado">
                <SelectValue placeholder="Selecione o resultado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="reprovado">Reprovado</SelectItem>
                <SelectItem value="condicional">Condicional</SelectItem>
                <SelectItem value="quarentena">Quarentena</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="obs">Observações</Label>
            <Textarea
              id="obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações sobre a inspeção..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={criarInspecao.isPending}>
              {criarInspecao.isPending ? "Salvando..." : "Registrar Inspeção"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
