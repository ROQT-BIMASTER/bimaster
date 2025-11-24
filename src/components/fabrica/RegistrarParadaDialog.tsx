import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RegistrarParadaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordemProducaoId?: string;
}

export function RegistrarParadaDialog({ open, onOpenChange, ordemProducaoId }: RegistrarParadaDialogProps) {
  const queryClient = useQueryClient();
  const [selectedOP, setSelectedOP] = useState(ordemProducaoId || "");
  const [motivoId, setMotivoId] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Buscar OPs em produção
  const { data: ops } = useQuery({
    queryKey: ["fabrica-ops-em-producao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_ordens_producao")
        .select("id, numero, fabrica_produtos(nome)")
        .eq("status", "em_producao")
        .order("numero", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !ordemProducaoId,
  });

  // Buscar motivos de parada
  const { data: motivos } = useQuery({
    queryKey: ["fabrica-motivos-parada"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_motivos_parada")
        .select("*")
        .eq("ativo", true)
        .order("descricao");
      
      if (error) throw error;
      return data;
    },
  });

  const registrarParada = useMutation({
    mutationFn: async (dados: {
      ordem_producao_id: string;
      motivo_parada_id: string;
      descricao_adicional?: string;
    }) => {
      const { data, error } = await supabase
        .from("fabrica_paradas")
        .insert({
          ordem_producao_id: dados.ordem_producao_id,
          motivo_parada_id: dados.motivo_parada_id,
          timestamp_inicio: new Date().toISOString(),
          descricao_adicional: dados.descricao_adicional,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fabrica-paradas"] });
      queryClient.invalidateQueries({ queryKey: ["fabrica-paradas-ativas"] });
      toast.success("Parada registrada com sucesso!");
      handleClose();
    },
    onError: () => {
      toast.error("Erro ao registrar parada");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const opId = ordemProducaoId || selectedOP;
    
    if (!opId || !motivoId) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    registrarParada.mutate({
      ordem_producao_id: opId,
      motivo_parada_id: motivoId,
      descricao_adicional: observacoes || undefined,
    });
  };

  const handleClose = () => {
    setSelectedOP(ordemProducaoId || "");
    setMotivoId("");
    setObservacoes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Parada</DialogTitle>
          <DialogDescription>
            Registre uma parada de produção
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!ordemProducaoId && (
            <div className="space-y-2">
              <Label htmlFor="op">Ordem de Produção *</Label>
              <Select value={selectedOP} onValueChange={setSelectedOP}>
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
          )}

          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo da Parada *</Label>
            <Select value={motivoId} onValueChange={setMotivoId}>
              <SelectTrigger id="motivo">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {motivos?.map((motivo) => (
                  <SelectItem key={motivo.id} value={motivo.id}>
                    {motivo.descricao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="obs">Observações</Label>
            <Textarea
              id="obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Detalhes sobre a parada..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={registrarParada.isPending}>
              {registrarParada.isPending ? "Salvando..." : "Registrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
