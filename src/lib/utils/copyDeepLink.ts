import { toast } from "sonner";

async function copyText(text: string, successMsg: string) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    toast.success(successMsg, { description: text });
  } catch {
    toast.error("Não foi possível copiar o link", {
      description: "Copie manualmente: " + text,
    });
  }
}

export function copyTarefaLink(projetoId: string, tarefaId: string) {
  const url = `${window.location.origin}/dashboard/share/projeto/${projetoId}/tarefa/${tarefaId}`;
  void copyText(url, "Link da tarefa copiado");
}

export function copyProjetoLink(projetoId: string) {
  const url = `${window.location.origin}/dashboard/share/projeto/${projetoId}`;
  void copyText(url, "Link do projeto copiado");
}
