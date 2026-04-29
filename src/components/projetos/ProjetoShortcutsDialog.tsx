import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

const SHORTCUTS: { keys: string[]; description: string }[] = [
  { keys: ["?"], description: "Abrir esta lista de atalhos" },
  { keys: ["Ctrl", "K"], description: "Abrir busca global de navegação" },
  { keys: ["C"], description: "Criar nova tarefa rápida (Kanban)" },
  { keys: ["N"], description: "Nova tarefa (na tela de detalhe do projeto)" },
  { keys: ["E"], description: "Editar tarefa selecionada" },
  { keys: ["Enter"], description: "Salvar tarefa em edição inline" },
  { keys: ["Shift", "Enter"], description: "Salvar e criar mais uma seguida" },
  { keys: ["Esc"], description: "Fechar diálogos / cancelar edição" },
  { keys: ["G", "H"], description: "Ir para a Home pessoal de Projetos" },
  { keys: ["G", "P"], description: "Ir para a lista de Projetos" },
  { keys: ["G", "I"], description: "Ir para Notificações" },
];

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function ProjetoShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-primary" />
            Atalhos de teclado
          </DialogTitle>
          <DialogDescription>
            Pressione <kbd className="px-1.5 py-0.5 text-[10px] rounded border bg-muted">?</kbd> a qualquer momento para reabrir esta lista.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 mt-2">
          {SHORTCUTS.map((s) => (
            <li key={s.description} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{s.description}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k, i) => (
                  <kbd
                    key={i}
                    className="px-1.5 py-0.5 text-[11px] font-mono rounded border bg-muted text-foreground"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
