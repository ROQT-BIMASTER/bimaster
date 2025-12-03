import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { movimentacaoSchema, MovimentacaoInput, TIPOS_MOVIMENTO } from "@/lib/validations/estoque";
import { useEffect } from "react";

interface Props { open: boolean; onOpenChange: (open: boolean) => void; selectedEstoque?: any; }

export function NovaMovimentacaoDialog({ open, onOpenChange, selectedEstoque }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: estoques } = useQuery({
    queryKey: ['estoque-saldos-select'],
    queryFn: async () => {
      const { data } = await supabase.from('estoque_saldos').select(`id, quantidade_disponivel, lote, estoque_distribuidoras(nome), estoque_produtos_distribuidora(codigo_produto_distribuidora, estoque_produtos_master(nome))`);
      return data || [];
    },
    enabled: !selectedEstoque
  });

  const form = useForm<MovimentacaoInput>({
    resolver: zodResolver(movimentacaoSchema),
    defaultValues: { estoque_id: "", tipo_movimento: "entrada", quantidade: 0, origem: "", destino: "", observacao: "" }
  });

  useEffect(() => {
    if (selectedEstoque) form.setValue('estoque_id', selectedEstoque.id);
    else form.reset({ estoque_id: "", tipo_movimento: "entrada", quantidade: 0, origem: "", destino: "", observacao: "" });
  }, [selectedEstoque, open]);

  const mutation = useMutation({
    mutationFn: async (data: MovimentacaoInput) => {
      const { data: saldo } = await supabase.from('estoque_saldos').select('quantidade_disponivel').eq('id', data.estoque_id).single();
      const qtdAnterior = Number(saldo?.quantidade_disponivel || 0);
      let qtdNova = qtdAnterior;
      if (data.tipo_movimento === 'entrada') qtdNova = qtdAnterior + data.quantidade;
      else if (data.tipo_movimento === 'saida') qtdNova = qtdAnterior - data.quantidade;
      else if (data.tipo_movimento === 'inventario') qtdNova = data.quantidade;
      else if (data.tipo_movimento === 'ajuste') qtdNova = qtdAnterior + data.quantidade;

      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from('estoque_movimentacoes').insert({
        ...data, quantidade_anterior: qtdAnterior, quantidade_nova: qtdNova, usuario_id: user.user?.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-saldos'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes-recentes'] });
      toast({ title: "Movimentação registrada" });
      onOpenChange(false);
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" })
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nova Movimentação</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            {!selectedEstoque && (
              <FormField control={form.control} name="estoque_id" render={({ field }) => (
                <FormItem><FormLabel>Estoque *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl><SelectContent>{estoques?.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.estoque_produtos_distribuidora?.estoque_produtos_master?.nome} - {e.estoque_distribuidoras?.nome}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
              )} />
            )}
            {selectedEstoque && (
              <div className="p-3 bg-muted rounded-md text-sm">
                <strong>{selectedEstoque.estoque_produtos_distribuidora?.estoque_produtos_master?.nome}</strong>
                <br />Saldo atual: {Number(selectedEstoque.quantidade_disponivel).toLocaleString('pt-BR')}
              </div>
            )}
            <FormField control={form.control} name="tipo_movimento" render={({ field }) => (
              <FormItem><FormLabel>Tipo *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{TIPOS_MOVIMENTO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="quantidade" render={({ field }) => (
              <FormItem><FormLabel>Quantidade *</FormLabel><FormControl><Input type="number" step="0.0001" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="documento_referencia" render={({ field }) => (
              <FormItem><FormLabel>Documento Referência</FormLabel><FormControl><Input {...field} placeholder="NF, Pedido, etc." /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="observacao" render={({ field }) => (
              <FormItem><FormLabel>Observação</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Salvando..." : "Registrar"}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
