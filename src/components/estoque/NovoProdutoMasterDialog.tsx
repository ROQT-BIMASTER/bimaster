import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { produtoMasterSchema, ProdutoMasterInput, UNIDADES_MEDIDA } from "@/lib/validations/estoque";
import { useEffect } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem?: any;
}

export function NovoProdutoMasterDialog({ open, onOpenChange, editingItem }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ProdutoMasterInput>({
    resolver: zodResolver(produtoMasterSchema),
    defaultValues: { nome: "", sku_master: "", unidade_medida: "UN", categoria: "", ativo: true }
  });

  useEffect(() => {
    if (editingItem) form.reset({ ...editingItem });
    else form.reset({ nome: "", sku_master: "", unidade_medida: "UN", categoria: "", ativo: true });
  }, [editingItem, open]);

  const mutation = useMutation({
    mutationFn: async (data: ProdutoMasterInput) => {
      if (editingItem) {
        const { error } = await supabase.from('estoque_produtos_master').update(data).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { data: user } = await supabase.auth.getUser();
        const { error } = await supabase.from('estoque_produtos_master').insert({ ...data, created_by: user.user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-produtos-master'] });
      toast({ title: editingItem ? "Produto atualizado" : "Produto criado" });
      onOpenChange(false);
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" })
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editingItem ? "Editar Produto Master" : "Novo Produto Master"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="sku_master" render={({ field }) => (
              <FormItem><FormLabel>SKU Master *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="nome" render={({ field }) => (
              <FormItem><FormLabel>Nome *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="unidade_medida" render={({ field }) => (
                <FormItem><FormLabel>Unidade</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{UNIDADES_MEDIDA.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="categoria" render={({ field }) => (
                <FormItem><FormLabel>Categoria</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="ativo" render={({ field }) => (
              <FormItem className="flex items-center gap-2"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Ativo</FormLabel></FormItem>
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
