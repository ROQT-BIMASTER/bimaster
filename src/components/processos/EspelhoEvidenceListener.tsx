import { useEffect, useState } from "react";
import { ConcluirComEvidenciaDialog } from "@/components/processos/ConcluirComEvidenciaDialog";
import type { TarefaEspelho } from "@/hooks/useProcessoTarefaEspelho";

/**
 * Listener global do app: captura o evento "espelho-precisa-evidencia"
 * disparado por `toggleTarefaCompleta` quando o usuário tenta concluir
 * uma tarefa do módulo Projetos vinculada a uma etapa do processo.
 *
 * Abre o diálogo obrigatório de seleção do documento oficial (evidência),
 * sem acoplar componentes do módulo Projetos ao módulo Processos.
 */
export function EspelhoEvidenceListener() {
  const [espelho, setEspelho] = useState<TarefaEspelho | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<TarefaEspelho>;
      if (ce.detail) setEspelho(ce.detail);
    };
    window.addEventListener("espelho-precisa-evidencia", handler);
    return () => window.removeEventListener("espelho-precisa-evidencia", handler);
  }, []);

  return (
    <ConcluirComEvidenciaDialog
      open={!!espelho}
      onOpenChange={(o) => !o && setEspelho(null)}
      espelho={espelho}
    />
  );
}
