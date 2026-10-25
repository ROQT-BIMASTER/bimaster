import { Badge } from "@/components/ui/badge";
import { STATUS_LANCAMENTO_LABEL, STATUS_RESERVA_LABEL } from "@/lib/quadra/categorias";
import type { QuadraLancamento, QuadraReserva } from "@/types/quadra";

export function StatusLancamentoBadge({ lancamento, atrasado }: { lancamento: QuadraLancamento; atrasado: boolean }) {
  if (lancamento.status === "pago") {
    return <Badge variant="success">{lancamento.tipo === "receita" ? "Recebido" : "Pago"}</Badge>;
  }
  if (lancamento.status === "cancelado") return <Badge variant="ghost">Cancelado</Badge>;
  if (atrasado) return <Badge variant="destructive">Atrasado</Badge>;
  return <Badge variant="warning">{STATUS_LANCAMENTO_LABEL.pendente}</Badge>;
}

export function TipoLancamentoBadge({ tipo }: { tipo: QuadraLancamento["tipo"] }) {
  return tipo === "receita" ? (
    <Badge variant="outline" className="border-success/40 text-success">Receita</Badge>
  ) : (
    <Badge variant="outline" className="border-destructive/40 text-destructive">Despesa</Badge>
  );
}

export function StatusReservaBadge({ reserva }: { reserva: QuadraReserva }) {
  if (reserva.status === "cancelada") return <Badge variant="ghost">{STATUS_RESERVA_LABEL.cancelada}</Badge>;
  if (reserva.status === "realizada") return <Badge variant="secondary">{STATUS_RESERVA_LABEL.realizada}</Badge>;
  return <Badge variant="default">{STATUS_RESERVA_LABEL.confirmada}</Badge>;
}

export function PagamentoReservaBadge({ reserva }: { reserva: QuadraReserva }) {
  if (reserva.status === "cancelada") return <span className="text-xs text-muted-foreground">-</span>;
  return reserva.status_pagamento === "pago" ? (
    <Badge variant="success">Pago</Badge>
  ) : (
    <Badge variant="warning">Pendente</Badge>
  );
}
