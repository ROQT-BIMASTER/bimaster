import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/quadra/FormField";
import { lancamentoSchema, type LancamentoInput, type LancamentoOutput } from "@/lib/validations/quadra";
import { categoriasPorTipo, FORMAS_PAGAMENTO } from "@/lib/quadra/categorias";
import { todayBR } from "@/lib/utils/parseLocalDate";
import { useAtualizarLancamento, useCriarLancamento } from "@/hooks/quadra/useQuadraLancamentos";
import type { QuadraLancamento, QuadraTipoLancamento } from "@/types/quadra";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando informado, o dialog edita o lançamento. */
  lancamento?: QuadraLancamento | null;
  tipoInicial?: QuadraTipoLancamento;
}

const NENHUMA = "__none__";

function valoresIniciais(lancamento: QuadraLancamento | null | undefined, tipoInicial: QuadraTipoLancamento): LancamentoInput {
  const hoje = todayBR();
  if (!lancamento) {
    return {
      tipo: tipoInicial,
      categoria: "",
      descricao: "",
      valor: 0,
      data_competencia: hoje,
      data_vencimento: hoje,
      data_pagamento: "",
      status: "pendente",
      forma_pagamento: "",
      observacoes: "",
    };
  }
  return {
    tipo: lancamento.tipo,
    categoria: lancamento.categoria,
    descricao: lancamento.descricao,
    valor: lancamento.valor,
    data_competencia: lancamento.data_competencia,
    data_vencimento: lancamento.data_vencimento,
    data_pagamento: lancamento.data_pagamento ?? "",
    status: lancamento.status,
    forma_pagamento: lancamento.forma_pagamento ?? "",
    observacoes: lancamento.observacoes ?? "",
  };
}

export function LancamentoFormDialog({ open, onOpenChange, lancamento, tipoInicial = "receita" }: Props) {
  const criar = useCriarLancamento();
  const atualizar = useAtualizarLancamento();
  const editando = !!lancamento;

  const form = useForm<LancamentoInput, unknown, LancamentoOutput>({
    resolver: zodResolver(lancamentoSchema),
    defaultValues: valoresIniciais(lancamento, tipoInicial),
  });

  useEffect(() => {
    if (open) form.reset(valoresIniciais(lancamento, tipoInicial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lancamento?.id, tipoInicial]);

  const tipo = form.watch("tipo");
  const status = form.watch("status");
  const categorias = categoriasPorTipo(tipo);
  const salvando = criar.isPending || atualizar.isPending;
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editando && lancamento) await atualizar.mutateAsync({ id: lancamento.id, ...values });
      else await criar.mutateAsync(values);
      onOpenChange(false);
    } catch {
      // Erro já exibido em toast pelo hook
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          <DialogDescription>
            {editando ? "Altere os dados do lançamento do livro-caixa." : "Registre uma receita ou despesa da quadra."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tipo" error={errors.tipo?.message}>
              <Select
                value={tipo}
                onValueChange={(v) => {
                  form.setValue("tipo", v as QuadraTipoLancamento, { shouldDirty: true });
                  form.setValue("categoria", "");
                }}
                disabled={editando}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Categoria" error={errors.categoria?.message}>
              <Select value={form.watch("categoria") || undefined} onValueChange={(v) => form.setValue("categoria", v, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.codigo} value={c.codigo}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField label="Descrição" htmlFor="descricao" error={errors.descricao?.message}>
            <Input id="descricao" {...form.register("descricao")} placeholder="Ex.: Conta de energia de outubro" />
          </FormField>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Valor (R$)" htmlFor="valor" error={errors.valor?.message}>
              <Input id="valor" type="number" step="0.01" min="0" inputMode="decimal" {...form.register("valor", { valueAsNumber: true })} />
            </FormField>
            <FormField label="Competência" htmlFor="data_competencia" error={errors.data_competencia?.message}>
              <Input id="data_competencia" type="date" {...form.register("data_competencia")} />
            </FormField>
            <FormField label="Vencimento" htmlFor="data_vencimento" error={errors.data_vencimento?.message}>
              <Input id="data_vencimento" type="date" {...form.register("data_vencimento")} />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Situação" error={errors.status?.message}>
              <Select
                value={status}
                onValueChange={(v) => {
                  form.setValue("status", v as LancamentoInput["status"], { shouldDirty: true });
                  if (v === "pago" && !form.getValues("data_pagamento")) form.setValue("data_pagamento", todayBR());
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">{tipo === "receita" ? "Recebido" : "Pago"}</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Data do pagamento" htmlFor="data_pagamento" error={errors.data_pagamento?.message}>
              <Input id="data_pagamento" type="date" disabled={status !== "pago"} {...form.register("data_pagamento")} />
            </FormField>
            <FormField label="Forma de pagamento" error={errors.forma_pagamento?.message}>
              <Select
                value={form.watch("forma_pagamento") || NENHUMA}
                onValueChange={(v) => form.setValue("forma_pagamento", v === NENHUMA ? "" : (v as LancamentoInput["forma_pagamento"]))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NENHUMA}>Não informada</SelectItem>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <SelectItem key={f.codigo} value={f.codigo}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField label="Observações" htmlFor="observacoes" error={errors.observacoes?.message}>
            <Textarea id="observacoes" rows={2} {...form.register("observacoes")} />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={salvando}>
              {salvando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {editando ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
