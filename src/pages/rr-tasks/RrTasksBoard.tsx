import { RrTasksBoardView } from "@/components/rr-tasks/RrTasksBoardView";

/**
 * Rota `/dashboard/rr-tasks` — wrapper fino que delega para `RrTasksBoardView`.
 * O mesmo componente é embutido em `ProjetoDetalhe` quando o projeto é o
 * âncora `tipo='rr_tasks'`.
 */
export default function RrTasksBoard() {
  return <RrTasksBoardView />;
}
