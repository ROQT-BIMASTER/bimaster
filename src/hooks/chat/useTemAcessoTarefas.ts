/**
 * useTemAcessoTarefas — controla se a aba "Tarefas" aparece no hub de Chat.
 * Mesma heurística de `useTemAcessoProjetos`: visível para qualquer membro
 * de projeto, admin ou gerente. A própria RPC já filtra o conteúdo por
 * usuário, então isso é apenas um esconde-mostra de UI.
 */
import { useTemAcessoProjetos } from "./useTemAcessoProjetos";

export function useTemAcessoTarefas() {
  return useTemAcessoProjetos();
}
