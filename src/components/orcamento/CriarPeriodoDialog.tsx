import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { criarPeriodoSchema, type CriarPeriodoInput } from "@/lib/validations/orcamento";
import { useCreateBudgetPeriod } from "@/hooks/orcamento/useOrcamentoCorporativo";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export function CriarPeriodoDialog({ open, onOpenChange, onCreated }: Props) {
  const createMut = useCreateBudgetPeriod();
  const form = useForm<CriarPeriodoInput>({
    resolver: zodResolver(criarPeriodoSchema),
    defaultValues: { nome: "", tipo: "anual", data_inicio: "", data_fim: "", valor_total_empresa: 0 },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const id = await createMut.mutateAsync(values);
      onOpenChange(false);
      form.reset();
      onCreated?.(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar período");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo período orçamentário</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" {...form.register("nome")} placeholder="Ex.: 2026 — Anual" />
            {form.formState.errors.nome && (
              <p className="text-xs text-destructive">{form.formState.errors.nome.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select
              value={form.watch("tipo")}
              onValueChange={(v) => form.setValue("tipo", v as CriarPeriodoInput["tipo"])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="trimestral">Trimestral</SelectItem>
                <SelectItem value="semestral">Semestral</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="data_inicio">Início</Label>
              <Input id="data_inicio" type="date" {...form.register("data_inicio")} />
              {form.formState.errors.data_inicio && (
                <p className="text-xs text-destructive">{form.formState.errors.data_inicio.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="data_fim">Fim</Label>
              <Input id="data_fim" type="date" {...form.register("data_fim")} />
              {form.formState.errors.data_fim && (
                <p className="text-xs text-destructive">{form.formState.errors.data_fim.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="valor_total_empresa">Valor total da empresa (R$)</Label>
            <Input
              id="valor_total_empresa"
              type="number"
              step="0.01"
              min="0"
              {...form.register("valor_total_empresa", { valueAsNumber: true })}
            />
            {form.formState.errors.valor_total_empresa && (
              <p className="text-xs text-destructive">{form.formState.errors.valor_total_empresa.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
