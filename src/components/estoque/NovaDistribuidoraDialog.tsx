import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { distribuidoraSchema, DistribuidoraInput, cleanCNPJ } from "@/lib/validations/estoque";
import { useEffect } from "react";
import { CnpjSearchButton, CnpjData } from "@/components/shared/CnpjSearchButton";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem?: any;
}

export function NovaDistribuidoraDialog({ open, onOpenChange, editingItem }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<DistribuidoraInput>({
    resolver: zodResolver(distribuidoraSchema),
    defaultValues: { nome: "", cnpj: "", endereco: "", cidade: "", uf: "", telefone: "", email: "", ativo: true }
  });

  useEffect(() => {
    if (editingItem) {
      form.reset({ ...editingItem });
    } else {
      form.reset({ nome: "", cnpj: "", endereco: "", cidade: "", uf: "", telefone: "", email: "", ativo: true });
    }
  }, [editingItem, open]);

  const mutation = useMutation({
    mutationFn: async (data: DistribuidoraInput) => {
      const payload = { nome: data.nome, cnpj: cleanCNPJ(data.cnpj), endereco: data.endereco || null, cidade: data.cidade || null, uf: data.uf || null, telefone: data.telefone || null, email: data.email || null, ativo: data.ativo };
      if (editingItem) {
        const { error } = await supabase.from('estoque_distribuidoras').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('estoque_distribuidoras').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-distribuidoras'] });
      toast({ title: editingItem ? "Distribuidora atualizada" : "Distribuidora criada" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingItem ? "Editar Distribuidora" : "Nova Distribuidora"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="nome" render={({ field }) => (
              <FormItem><FormLabel>Nome *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="cnpj" render={({ field }) => (
              <FormItem>
                <FormLabel>CNPJ *</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input {...field} placeholder="00.000.000/0000-00" className="flex-1" />
                  </FormControl>
                  <CnpjSearchButton
                    cnpj={field.value}
                    onDataFound={(data: CnpjData) => {
                      form.setValue("nome", data.razaoSocial || data.nomeFantasia || form.getValues("nome"));
                      form.setValue("endereco", data.endereco || form.getValues("endereco"));
                      form.setValue("cidade", data.cidade || form.getValues("cidade"));
                      form.setValue("uf", data.uf || form.getValues("uf"));
                      form.setValue("telefone", data.telefone || form.getValues("telefone"));
                      form.setValue("email", data.email || form.getValues("email"));
                    }}
                  />
                </div>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="cidade" render={({ field }) => (
                <FormItem><FormLabel>Cidade</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="uf" render={({ field }) => (
                <FormItem><FormLabel>UF</FormLabel><FormControl><Input {...field} maxLength={2} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="endereco" render={({ field }) => (
              <FormItem><FormLabel>Endereço</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="telefone" render={({ field }) => (
                <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="ativo" render={({ field }) => (
              <FormItem className="flex items-center gap-2"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Ativa</FormLabel></FormItem>
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
