import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { vinculacaoSchema, VinculacaoInput } from "@/lib/validations/estoque";
import { useEffect } from "react";

interface Props { open: boolean; onOpenChange: (open: boolean) => void; editingItem?: any; }

export function VincularProdutoDialog({ open, onOpenChange, editingItem }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: distribuidoras } = useQuery({
    queryKey: ['estoque-distribuidoras-select'],
    queryFn: async () => { const { data } = await supabase.from('estoque_distribuidoras').select('id, nome').eq('ativo', true).order('nome'); return data || []; }
  });

  const { data: produtos } = useQuery({
    queryKey: ['estoque-produtos-master-select'],
    queryFn: async () => { const { data } = await supabase.from('estoque_produtos_master').select('id, nome, sku_master').eq('ativo', true).order('nome'); return data || []; }
  });

  const form = useForm<VinculacaoInput>({
    resolver: zodResolver(vinculacaoSchema),
    defaultValues: { produto_master_id: "", distribuidora_id: "", codigo_produto_distribuidora: "", nome_exibicao: "", fator_conversao: 1, ativo: true }
  });

  useEffect(() => {
    if (editingItem) form.reset({ ...editingItem });
    else form.reset({ produto_master_id: "", distribuidora_id: "", codigo_produto_distribuidora: "", nome_exibicao: "", fator_conversao: 1, ativo: true });
  }, [editingItem, open]);

  const mutation = useMutation({
    mutationFn: async (data: VinculacaoInput) => {
      const payload = { produto_master_id: data.produto_master_id, distribuidora_id: data.distribuidora_id, codigo_produto_distribuidora: data.codigo_produto_distribuidora, nome_exibicao: data.nome_exibicao || null, fator_conversao: data.fator_conversao || 1, ativo: data.ativo };
      if (editingItem) {
        const { error } = await supabase.from('estoque_produtos_distribuidora').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('estoque_produtos_distribuidora').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['estoque-vinculacoes'] }); toast({ title: "Vinculação salva" }); onOpenChange(false); },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" })
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editingItem ? "Editar Vinculação" : "Nova Vinculação"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="produto_master_id" render={({ field }) => (
              <FormItem><FormLabel>Produto Master *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl><SelectContent>{produtos?.map(p => <SelectItem key={p.id} value={p.id}>{p.nome} ({p.sku_master})</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="distribuidora_id" render={({ field }) => (
              <FormItem><FormLabel>Distribuidora *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl><SelectContent>{distribuidoras?.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="codigo_produto_distribuidora" render={({ field }) => (
              <FormItem><FormLabel>Código na Distribuidora *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="nome_exibicao" render={({ field }) => (
              <FormItem><FormLabel>Nome de Exibição</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="fator_conversao" render={({ field }) => (
              <FormItem><FormLabel>Fator de Conversão</FormLabel><FormControl><Input type="number" step="0.0001" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Salvando..." : "Salvar"}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
