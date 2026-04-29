import { Eye, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  visibleCount: number;
  totalCount: number;
  totalSecoes: number;
  visibleSecoes: number;
  restrictToOwn: boolean;
  darkBg?: boolean;
}

/**
 * Banner discreto que avisa o usuário quando ele está vendo apenas
 * parte das tarefas/seções do projeto (por escopo de seções designadas
 * ou por restrição "apenas tarefas em que estou envolvido").
 */
export function ProjetoVisaoParcialBanner({
  visibleCount,
  totalCount,
  totalSecoes,
  visibleSecoes,
  restrictToOwn,
  darkBg = false,
}: Props) {
  const hiddenTarefas = Math.max(0, totalCount - visibleCount);
  const hiddenSecoes = Math.max(0, totalSecoes - visibleSecoes);

  if (hiddenTarefas === 0 && hiddenSecoes === 0 && !restrictToOwn) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
          darkBg
            ? "border-white/20 bg-white/5 text-white/80"
            : "border-amber-300/60 bg-amber-50/60 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200"
        )}
        role="status"
      >
        <Eye className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">
          Você está vendo uma <strong>visão parcial</strong> deste projeto
          {visibleCount > 0 && totalCount > 0 && (
            <>
              {" — "}
              <strong>{visibleCount}</strong> de <strong>{totalCount}</strong> tarefas
            </>
          )}
          {hiddenSecoes > 0 && (
            <>
              {" e "}
              <strong>{visibleSecoes}</strong> de <strong>{totalSecoes}</strong> seções
            </>
          )}
          .
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                "rounded p-0.5 transition-colors",
                darkBg ? "hover:bg-white/10" : "hover:bg-amber-100 dark:hover:bg-amber-900/40"
              )}
              aria-label="Saiba mais sobre visão parcial"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs space-y-1.5">
            <p>
              {restrictToOwn
                ? "Você está vendo apenas as tarefas em que é responsável ou foi adicionado como colaborador. Liberação de seção dá acesso à seção, mas não traz automaticamente as tarefas dela. Peça ao coordenador para te atribuir como responsável ou colaborador onde precisar."
                : "O coordenador limitou seu acesso a um subconjunto de seções. Solicite acesso adicional para ver mais conteúdo."}
            </p>
            <a
              href="/dashboard/ajuda/projetos-visibilidade"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-[11px] underline underline-offset-2 text-primary hover:text-primary/80"
            >
              Saiba mais sobre visibilidade
            </a>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
