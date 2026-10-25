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
import { reservaSchema, type ReservaInput, type ReservaOutput } from "@/lib/validations/quadra";
import { FORMAS_PAGAMENTO, formatHora } from "@/lib/quadra/categorias";
import { todayBR } from "@/lib/utils/parseLocalDate";
import { useAtualizarReserva, useCriarReserva } from "@/hooks/quadra/useQuadraReservas";
import { useQuadraMensalistas } from "@/hooks/quadra/useQuadraMensalistas";
import type { QuadraReserva } from "@/types/quadra";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reserva?: QuadraReserva | null;
  /** Data (YYYY-MM-DD) sugerida para uma nova reserva. */
  dataInicial?: string;
}

const NENHUM = "__none__";

function valoresIniciais(reserva: QuadraReserva | null | undefined, dataInicial?: string): ReservaInput {
  if (!reserva) {
    return {
      data: dataInicial ?? todayBR(),
      horario_inicio: "19:00",
      horario_fim: "20:00",
      cliente_nome: "",
      cliente_telefone: "",
      mensalista_id: "",
      valor: 0,
      status: "confirmada",
      status_pagamento: "pendente",
      forma_pagamento: "",
      observacoes: "",
    };
  }
  return {
    data: reserva.data,
    horario_inicio: formatHora(reserva.horario_inicio),
    horario_fim: formatHora(reserva.horario_fim),
    cliente_nome: reserva.cliente_nome,
    cliente_telefone: reserva.cliente_telefone ?? "",
    mensalista_id: reserva.mensalista_id ?? "",
    valor: reserva.valor,
    status: reserva.status,
    status_pagamento: reserva.status_pagamento,
    forma_pagamento: reserva.forma_pagamento ?? "",
    observacoes: reserva.observacoes ?? "",
  };
}

export function ReservaFormDialog({ open, onOpenChange, reserva, dataInicial }: Props) {
  const criar = useCriarReserva();
  const atualizar = useAtualizarReserva();
  const { data: mensalistas = [] } = useQuadraMensalistas({ somenteAtivos: true });
  const editando = !!reserva;

  const form = useForm<ReservaInput, unknown, ReservaOutput>({
    resolver: zodResolver(reservaSchema),
    defaultValues: valoresIniciais(reserva, dataInicial),
  });

  useEffect(() => {
    if (open) form.reset(valoresIniciais(reserva, dataInicial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reserva?.id, dataInicial]);

  const errors = form.formState.errors;
  const salvando = criar.isPending || atualizar.isPending;

  const aoEscolherMensalista = (id: string) => {
    if (id === NENHUM) {
      form.setValue("mensalista_id", "");
      return;
    }
    const m = mensalistas.find((x) => x.id === id);
    form.setValue("mensalista_id", id);
    if (m) {
      if (!form.getValues("cliente_nome")) form.setValue("cliente_nome", m.nome, { shouldValidate: true });
      if (!form.getValues("cliente_telefone") && m.telefone) form.setValue("cliente_telefone", m.telefone);
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editando && reserva) await atualizar.mutateAsync({ id: reserva.id, ...values });
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
          <DialogTitle>{editando ? "Editar reserva" : "Nova reserva"}</DialogTitle>
          <DialogDescription>
            A reserva gera automaticamente uma receita de aluguel de horário no livro-caixa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Data" htmlFor="data" error={errors.data?.message}>
              <Input id="data" type="date" {...form.register("data")} />
            </FormField>
            <FormField label="Início" htmlFor="horario_inicio" error={errors.horario_inicio?.message}>
              <Input id="horario_inicio" type="time" {...form.register("horario_inicio")} />
            </FormField>
            <FormField label="Fim" htmlFor="horario_fim" error={errors.horario_fim?.message}>
              <Input id="horario_fim" type="time" {...form.register("horario_fim")} />
            </FormField>
          </div>

          <FormField label="Mensalista (opcional)">
            <Select value={form.watch("mensalista_id") || NENHUM} onValueChange={aoEscolherMensalista}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUM}>Cliente avulso</SelectItem>
                {mensalistas.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Cliente" htmlFor="cliente_nome" error={errors.cliente_nome?.message}>
              <Input id="cliente_nome" {...form.register("cliente_nome")} placeholder="Nome do responsável" />
            </FormField>
            <FormField label="Telefone" htmlFor="cliente_telefone" error={errors.cliente_telefone?.message}>
              <Input id="cliente_telefone" {...form.register("cliente_telefone")} placeholder="(11) 99999-9999" />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FormField label="Valor (R$)" htmlFor="valor" error={errors.valor?.message}>
              <Input id="valor" type="number" step="0.01" min="0" inputMode="decimal" {...form.register("valor", { valueAsNumber: true })} />
            </FormField>
            <FormField label="Situação" error={errors.status?.message}>
              <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v as ReservaInput["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmada">Confirmada</SelectItem>
                  <SelectItem value="realizada">Realizada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Pagamento" error={errors.status_pagamento?.message}>
              <Select value={form.watch("status_pagamento")} onValueChange={(v) => form.setValue("status_pagamento", v as ReservaInput["status_pagamento"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Forma" error={errors.forma_pagamento?.message}>
              <Select
                value={form.watch("forma_pagamento") || NENHUM}
                onValueChange={(v) => form.setValue("forma_pagamento", v === NENHUM ? "" : (v as ReservaInput["forma_pagamento"]))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NENHUM}>Não informada</SelectItem>
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
