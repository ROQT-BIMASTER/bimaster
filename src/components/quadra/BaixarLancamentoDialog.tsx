import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/quadra/FormField";
import { FORMAS_PAGAMENTO } from "@/lib/quadra/categorias";
import { formatCurrency } from "@/lib/formatters";
import { todayBR } from "@/lib/utils/parseLocalDate";
import { useBaixarLancamento } from "@/hooks/quadra/useQuadraLancamentos";
import { useAtualizarReserva } from "@/hooks/quadra/useQuadraReservas";
import type { QuadraFormaPagamento, QuadraLancamento } from "@/types/quadra";

interface Props {
  lancamento: QuadraLancamento | null;
  onOpenChange: (open: boolean) => void;
}

const NENHUMA = "__none__";

/**
 * Registra o recebimento/pagamento de um lançamento pendente.
 * Lançamentos vinculados a uma reserva são baixados pela própria reserva,
 * que mantém o livro-caixa sincronizado.
 */
export function BaixarLancamentoDialog({ lancamento, onOpenChange }: Props) {
  const baixar = useBaixarLancamento();
  const atualizarReserva = useAtualizarReserva();
  const [dataPagamento, setDataPagamento] = useState(todayBR());
  const [forma, setForma] = useState<string>(NENHUMA);

  useEffect(() => {
    if (lancamento) {
      setDataPagamento(todayBR());
      setForma(lancamento.forma_pagamento ?? NENHUMA);
    }
  }, [lancamento]);

  if (!lancamento) return null;
  const receita = lancamento.tipo === "receita";
  const salvando = baixar.isPending || atualizarReserva.isPending;
  const formaPagamento = forma === NENHUMA ? null : (forma as QuadraFormaPagamento);

  const confirmar = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPagamento)) return;
    try {
      if (lancamento.reserva_id) {
        await atualizarReserva.mutateAsync({
          id: lancamento.reserva_id,
          status_pagamento: "pago",
          forma_pagamento: formaPagamento,
        });
      } else {
        await baixar.mutateAsync({ id: lancamento.id, data_pagamento: dataPagamento, forma_pagamento: formaPagamento });
      }
      onOpenChange(false);
    } catch {
      // Erro já exibido em toast pelo hook
    }
  };

  return (
    <Dialog open={!!lancamento} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{receita ? "Registrar recebimento" : "Registrar pagamento"}</DialogTitle>
          <DialogDescription>
            {lancamento.descricao} - {formatCurrency(lancamento.valor)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={receita ? "Data do recebimento" : "Data do pagamento"} htmlFor="baixa_data">
            <Input
              id="baixa_data"
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              disabled={!!lancamento.reserva_id}
            />
          </FormField>
          <FormField label="Forma de pagamento">
            <Select value={forma} onValueChange={setForma}>
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
        {lancamento.reserva_id && (
          <p className="text-xs text-muted-foreground">
            Esta receita vem de uma reserva. A baixa usa a data da reserva e atualiza a reserva como paga.
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={confirmar} disabled={salvando}>
            {salvando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
