import type { QueryClient } from "@tanstack/react-query";

/**
 * Invalida em conjunto TODAS as queries que renderizam o checklist de uma
 * submissão China — caixa de entrada, painéis abertos, drawer foco,
 * Submissão na perspectiva Brasil e documentos vinculados a tarefas.
 *
 * Use após qualquer mutação que afete documentos, itens custom, categorias
 * custom, anexos de parecer ou status — assim o usuário não precisa apertar
 * F5 para ver a atualização.
 */
export function invalidateChinaChecklist(
  qc: QueryClient,
  submissaoId?: string | null,
) {
  // Caches dependentes da submissão específica
  if (submissaoId) {
    qc.invalidateQueries({
      queryKey: ["china-checklist-sheet-docs", submissaoId],
      refetchType: "active",
    });
    qc.invalidateQueries({
      queryKey: ["checklist-custom-cats", submissaoId],
      refetchType: "active",
    });
    qc.invalidateQueries({
      queryKey: ["checklist-custom-items", submissaoId],
      refetchType: "active",
    });
    qc.invalidateQueries({
      queryKey: ["checklist-hidden-items", submissaoId],
      refetchType: "active",
    });
    qc.invalidateQueries({
      queryKey: ["china-checklist-c2b", submissaoId],
      refetchType: "active",
    });
    qc.invalidateQueries({
      queryKey: ["china-checklist-b2c", submissaoId],
      refetchType: "active",
    });
    qc.invalidateQueries({
      queryKey: ["china-checklist", submissaoId],
      refetchType: "active",
    });
    qc.invalidateQueries({
      queryKey: ["china-ficha-docs", submissaoId],
      refetchType: "active",
    });
    qc.invalidateQueries({
      queryKey: ["china-revisoes", submissaoId],
      refetchType: "active",
    });
  }

  // Caches globais
  qc.invalidateQueries({ queryKey: ["china-mailbox-dataset"], refetchType: "active" });
  qc.invalidateQueries({ queryKey: ["china-inbox"], refetchType: "active" });
  qc.invalidateQueries({ queryKey: ["china-docs-da-tarefa"], refetchType: "active" });
  qc.invalidateQueries({ queryKey: ["vincular-china"], refetchType: "active" });
}
