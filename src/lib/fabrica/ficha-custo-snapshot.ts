// Helpers para leitura defensiva de snapshot_totais de fabrica_ficha_custo_revisoes.
//
// Contexto: alguns caminhos de gravação histórica persistiram custoTotal sem o
// IPI Saída embutido (calcularTotaisSimples / handleSubmeterFilho de filhos de
// Kit), enquanto o caminho principal (useFichaCustoProduto.totais.custoTotal)
// sempre incluiu. A tela de Produtos Acabados e a tela de Revisão de Fichas
// liam o mesmo campo bruto, mas o que cada snapshot continha era diferente —
// resultando em valores divergentes para o mesmo produto.
//
// Estas funções devem ser a única forma de ler "custo total" a partir de um
// snapshot_totais salvo no banco. Snapshots novos passam a marcar
// ipi_incluido: true, o que faz o helper devolver o valor sem heurística.

export interface FichaSnapshotTotais {
  totalNF?: number;
  totalServico?: number;
  totalCondicao?: number;
  markupNF?: number;
  markupServico?: number;
  markupCondicao?: number;
  totalIPI?: number;
  ipi_percentual_saida?: number;
  custoTotal?: number;
  custoFinalTotal?: number;
  ipi_incluido?: boolean;
}

const EPSILON = 0.01;

export function custoTotalDoSnapshot(snap: FichaSnapshotTotais | null | undefined): number {
  if (!snap) return 0;
  const ct = Number(snap.custoTotal ?? snap.custoFinalTotal ?? 0) || 0;
  const ipi = Number(snap.totalIPI ?? 0) || 0;
  if (ipi <= 0) return ct;
  if (snap.ipi_incluido === true) return ct;

  // Snapshots antigos não marcam ipi_incluido. Verificamos se o custoTotal
  // armazenado já compreende o IPI usando as partes que estão no próprio
  // snapshot — se compreende, retornamos como está; caso contrário, somamos.
  const totalNF = Number(snap.totalNF) || 0;
  const totalServico = Number(snap.totalServico) || 0;
  const totalCondicao = Number(snap.totalCondicao) || 0;
  const markupNF = Number(snap.markupNF) || 0;
  const markupServico = Number(snap.markupServico) || 0;
  const markupCondicao = Number(snap.markupCondicao) || 0;
  const semIpi = totalNF + totalServico + totalCondicao + markupNF + markupServico + markupCondicao;

  if (ct + EPSILON >= semIpi + ipi) return ct;
  return ct + ipi;
}
