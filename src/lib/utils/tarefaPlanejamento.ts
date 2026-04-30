/**
 * Regra única de "tarefa sem datas planejadas".
 *
 * Considera-se sem planejamento completo quando a tarefa pendente NÃO tem
 * `data_inicio_planejada` OU NÃO tem `data_prazo`. Isso preserva o alerta
 * histórico (a tarefa pode ter prazo mas faltar início, e vice-versa) e é
 * usado de forma consistente nos KPIs, na aba Hoje, no agrupamento da Central
 * e no filtro "Sem prazo / Sem datas".
 *
 * Para classificação temporal (Atrasadas/Hoje/Semana/Mais tarde), continue
 * usando apenas `data_prazo` — o alerta de planejamento incompleto convive com
 * o grupo temporal e é exibido como badge na linha da tarefa.
 */
export interface TarefaPlanejamentoLike {
  status: string;
  data_inicio_planejada: string | null;
  data_prazo: string | null;
}

export function isSemDatasPlanejadas(t: TarefaPlanejamentoLike): boolean {
  if (t.status === "concluida") return false;
  return !t.data_inicio_planejada || !t.data_prazo;
}
