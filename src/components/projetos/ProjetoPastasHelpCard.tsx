import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, FolderPlus, MousePointerClick, Users, Lock } from "lucide-react";

const STORAGE_KEY = "projetos:pastas:help:v1";

interface Props {
  /** Abre o diálogo de gestão de pastas. */
  onGerenciar?: () => void;
}

/**
 * Explicação dispensável de como usar as pastas (workspaces) de projetos.
 * O estado de dispensa fica no navegador do usuário.
 */
export function ProjetoPastasHelpCard({ onGerenciar }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* noop */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="relative rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dispensar explicação"
        className="absolute top-2 right-2 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <p className="text-sm font-medium text-foreground pr-6">
        Como organizar seus projetos em pastas
      </p>

      <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
        <li className="flex items-start gap-2">
          <FolderPlus className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <span>
            <strong className="text-foreground">Crie pastas</strong> em "Gerenciar pastas"
            (ex.: por departamento, cliente ou trimestre) e escolha uma cor para identificá-las.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <MousePointerClick className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <span>
            <strong className="text-foreground">Mova um projeto</strong> pelo menu de três pontos
            do card, em "Mover para pasta". Cada projeto pertence a uma pasta por vez.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Users className="h-3.5 w-3.5 text-info shrink-0 mt-0.5" />
          <span>
            <strong className="text-foreground">Compartilhadas x pessoais</strong> — as
            compartilhadas são vistas por toda a equipe; as pessoais só por você.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <span>
            Pastas são apenas organização visual: <strong className="text-foreground">não
            alteram permissões</strong> nem quem enxerga cada projeto.
          </span>
        </li>
      </ul>

      <div className="mt-3 flex justify-end gap-2">
        {onGerenciar && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onGerenciar}>
            Gerenciar pastas
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={dismiss}>
          Entendi
        </Button>
      </div>
    </div>
  );
}
