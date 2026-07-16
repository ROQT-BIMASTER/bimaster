import { useEffect, useState } from "react";
import { X, UserCheck, Users, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";


const STORAGE_KEY = "central:papel-banner-dismissed";

/**
 * Banner one-time que esclarece os três papéis em que uma tarefa pode aparecer
 * para o usuário na Central de Trabalho:
 *  - Responsável: dono, precisa entregar
  *  - Colaborador/seguidor: foi adicionado para acompanhar/contribuir
  *  - Criador: criou a tarefa, mesmo sem ser responsável direto
 *
 * Fica oculto após dispensa via flag em localStorage.
 */
export function PapelExplicativoBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      // localStorage indisponível (modo privado) — mostra o banner mesmo assim
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm relative animate-in fade-in slide-in-from-top-1">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dispensar explicação"
        className="absolute top-2 right-2 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <p className="font-medium text-foreground mb-2 pr-6">
        Como entender suas tarefas
      </p>
      <ul className="space-y-1.5 text-xs text-muted-foreground">
        <li className="flex items-start gap-2">
          <UserCheck className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <span>
            <strong className="text-foreground">Sou responsável</strong> — você
            é o dono da tarefa e precisa entregá-la.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Users className="h-3.5 w-3.5 text-info shrink-0 mt-0.5" />
          <span>
            <strong className="text-foreground">Sou colaborador</strong> — foi
            adicionado para acompanhar ou contribuir; outra pessoa é a
            responsável.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <span>
            <strong className="text-foreground">Estou seguindo</strong> — você
            acompanha a tarefa para receber contexto e atualizações.
          </span>
        </li>
        <li className="flex items-start gap-2 text-[11px] text-muted-foreground/80 pl-5">
          Tarefas que você <strong className="text-foreground">criou e delegou</strong> a
          outra pessoa aparecem na aba <strong className="text-foreground">Delegadas por mim</strong>,
          não aqui — padrão Asana/Jira: "Minhas Tarefas" reflete apenas trabalho
          que exige sua ação direta.
        </li>

      </ul>
      <div className="mt-3 flex justify-end">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={dismiss}>
          Entendi
        </Button>
      </div>
    </div>
  );
}
