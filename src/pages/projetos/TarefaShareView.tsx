import ProjetoDetalhe from "@/pages/ProjetoDetalhe";

/**
 * Share de tarefa: reaproveita o ProjetoDetalhe em modo shared.
 * O deep-link `?tarefa=ID` abre o Focus Mode da tarefa automaticamente
 * (ver ProjetoListView.initialTarefaId).
 */
export default function TarefaShareView() {
  return <ProjetoDetalhe shared />;
}
