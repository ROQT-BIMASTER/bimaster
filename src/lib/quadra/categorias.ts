import type {
  QuadraFormaPagamento,
  QuadraStatusLancamento,
  QuadraStatusReserva,
  QuadraTipoLancamento,
} from "@/types/quadra";

export interface QuadraCategoria {
  codigo: string;
  label: string;
}

export const CATEGORIAS_RECEITA: QuadraCategoria[] = [
  { codigo: "aluguel_horario", label: "Aluguel de horário" },
  { codigo: "mensalidade", label: "Mensalidade" },
  { codigo: "escolinha", label: "Escolinha" },
  { codigo: "bar_cantina", label: "Bar / cantina" },
  { codigo: "evento", label: "Evento / campeonato" },
  { codigo: "patrocinio", label: "Patrocínio" },
  { codigo: "outros_receita", label: "Outras receitas" },
];

export const CATEGORIAS_DESPESA: QuadraCategoria[] = [
  { codigo: "agua", label: "Água" },
  { codigo: "energia", label: "Energia elétrica" },
  { codigo: "manutencao", label: "Manutenção da quadra" },
  { codigo: "material_esportivo", label: "Material esportivo" },
  { codigo: "funcionarios", label: "Funcionários" },
  { codigo: "aluguel_imovel", label: "Aluguel do imóvel" },
  { codigo: "impostos", label: "Impostos e taxas" },
  { codigo: "limpeza", label: "Limpeza" },
  { codigo: "marketing", label: "Divulgação" },
  { codigo: "outros_despesa", label: "Outras despesas" },
];

export function categoriasPorTipo(tipo: QuadraTipoLancamento): QuadraCategoria[] {
  return tipo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
}

export function labelCategoria(codigo: string): string {
  const found = [...CATEGORIAS_RECEITA, ...CATEGORIAS_DESPESA].find((c) => c.codigo === codigo);
  return found?.label ?? codigo;
}

export const FORMAS_PAGAMENTO: { codigo: QuadraFormaPagamento; label: string }[] = [
  { codigo: "pix", label: "Pix" },
  { codigo: "dinheiro", label: "Dinheiro" },
  { codigo: "cartao_credito", label: "Cartão de crédito" },
  { codigo: "cartao_debito", label: "Cartão de débito" },
  { codigo: "transferencia", label: "Transferência" },
  { codigo: "boleto", label: "Boleto" },
  { codigo: "outro", label: "Outro" },
];

export function labelFormaPagamento(codigo: QuadraFormaPagamento | null | undefined): string {
  if (!codigo) return "-";
  return FORMAS_PAGAMENTO.find((f) => f.codigo === codigo)?.label ?? codigo;
}

export const STATUS_LANCAMENTO_LABEL: Record<QuadraStatusLancamento, string> = {
  pendente: "Pendente",
  pago: "Pago",
  cancelado: "Cancelado",
};

export const STATUS_RESERVA_LABEL: Record<QuadraStatusReserva, string> = {
  confirmada: "Confirmada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

export const DIAS_SEMANA: { valor: number; label: string; curto: string }[] = [
  { valor: 0, label: "Domingo", curto: "Dom" },
  { valor: 1, label: "Segunda-feira", curto: "Seg" },
  { valor: 2, label: "Terça-feira", curto: "Ter" },
  { valor: 3, label: "Quarta-feira", curto: "Qua" },
  { valor: 4, label: "Quinta-feira", curto: "Qui" },
  { valor: 5, label: "Sexta-feira", curto: "Sex" },
  { valor: 6, label: "Sábado", curto: "Sáb" },
];

export function labelDiaSemana(valor: number, curto = false): string {
  const d = DIAS_SEMANA.find((x) => x.valor === valor);
  if (!d) return String(valor);
  return curto ? d.curto : d.label;
}

/** "18:00:00" -> "18:00" */
export function formatHora(hora: string | null | undefined): string {
  if (!hora) return "";
  return hora.slice(0, 5);
}
