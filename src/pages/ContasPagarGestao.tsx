import { Navigate } from "react-router-dom";

/**
 * Tela ContasPagarGestao foi unificada à tela principal de Contas a Pagar.
 * Mantemos este arquivo apenas como redirect para preservar bookmarks.
 */
export default function ContasPagarGestao() {
  return <Navigate to="/dashboard/financeiro/contas-a-pagar" replace />;
}
