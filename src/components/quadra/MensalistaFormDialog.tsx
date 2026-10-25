import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/quadra/FormField";
import { mensalistaSchema, type MensalistaInput, type MensalistaOutput } from "@/lib/validations/quadra";
import { DIAS_SEMANA, formatHora } from "@/lib/quadra/categorias";
import { useAtualizarMensalista, useCriarMensalista } from "@/hooks/quadra/useQuadraMensalistas";
import type { QuadraMensalista } from "@/types/quadra";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mensalista?: QuadraMensalista | null;
}

function valoresIniciais(m: QuadraMensalista | null | undefined): MensalistaInput {
  if (!m) {
    return {
      nome: "",
      telefone: "",
      email: "",
      dia_semana: 1,
      horario_inicio: "19:00",
      horario_fim: "20:00",
      valor_mensal: 0,
      dia_vencimento: 10,
      ativo: true,
      observacoes: "",
    };
  }
  return {
    nome: m.nome,
    telefone: m.telefone ?? "",
    email: m.email ?? "",
    dia_semana: m.dia_semana,
    horario_inicio: formatHora(m.horario_inicio),
    horario_fim: formatHora(m.horario_fim),
    valor_mensal: m.valor_mensal,
    dia_vencimento: m.dia_vencimento,
    ativo: m.ativo,
    observacoes: m.observacoes ?? "",
  };
}

export function MensalistaFormDialog({ open, onOpenChange, mensalista }: Props) {
  const criar = useCriarMensalista();
  const atualizar = useAtualizarMensalista();
  const editando = !!mensalista;

  const form = useForm<MensalistaInput, unknown, MensalistaOutput>({
    resolver: zodResolver(mensalistaSchema),
    defaultValues: valoresIniciais(mensalista),
  });

  useEffect(() => {
    if (open) form.reset(valoresIniciais(mensalista));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mensalista?.id]);

  const errors = form.formState.errors;
  const salvando = criar.isPending || atualizar.isPending;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editando && mensalista) await atualizar.mutateAsync({ id: mensalista.id, ...values });
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
          <DialogTitle>{editando ? "Editar mensalista" : "Novo mensalista"}</DialogTitle>
          <DialogDescription>
            Cliente com horário fixo semanal. A mensalidade é gerada no livro-caixa a cada mês.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <FormField label="Nome" htmlFor="nome" error={errors.nome?.message}>
            <Input id="nome" {...form.register("nome")} placeholder="Nome do time ou responsável" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Telefone" htmlFor="telefone" error={errors.telefone?.message}>
              <Input id="telefone" {...form.register("telefone")} placeholder="(11) 99999-9999" />
            </FormField>
            <FormField label="E-mail" htmlFor="email" error={errors.email?.message}>
              <Input id="email" type="email" {...form.register("email")} />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Dia da semana" error={errors.dia_semana?.message}>
              <Select value={String(form.watch("dia_semana"))} onValueChange={(v) => form.setValue("dia_semana", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIAS_SEMANA.map((d) => (
                    <SelectItem key={d.valor} value={String(d.valor)}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Início" htmlFor="m_horario_inicio" error={errors.horario_inicio?.message}>
              <Input id="m_horario_inicio" type="time" {...form.register("horario_inicio")} />
            </FormField>
            <FormField label="Fim" htmlFor="m_horario_fim" error={errors.horario_fim?.message}>
              <Input id="m_horario_fim" type="time" {...form.register("horario_fim")} />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Valor mensal (R$)" htmlFor="valor_mensal" error={errors.valor_mensal?.message}>
              <Input id="valor_mensal" type="number" step="0.01" min="0" inputMode="decimal" {...form.register("valor_mensal", { valueAsNumber: true })} />
            </FormField>
            <FormField label="Dia do vencimento (1 a 28)" htmlFor="dia_vencimento" error={errors.dia_vencimento?.message}>
              <Input id="dia_vencimento" type="number" min="1" max="28" step="1" {...form.register("dia_vencimento", { valueAsNumber: true })} />
            </FormField>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label htmlFor="ativo">Mensalista ativo</Label>
              <p className="text-xs text-muted-foreground">Inativos não entram na geração de mensalidades.</p>
            </div>
            <Switch id="ativo" checked={form.watch("ativo")} onCheckedChange={(v) => form.setValue("ativo", v)} />
          </div>

          <FormField label="Observações" htmlFor="m_observacoes" error={errors.observacoes?.message}>
            <Textarea id="m_observacoes" rows={2} {...form.register("observacoes")} />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={salvando}>
              {salvando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {editando ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
