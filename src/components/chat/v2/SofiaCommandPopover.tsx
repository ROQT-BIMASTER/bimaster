/**
 * SofiaCommandPopover — lista comandos / da Sofia inline.
 *
 * Aparece quando o usuário digita `/` no início de uma mensagem. Cada
 * comando tem um exemplo de uso e um ícone. Selecionar:
 *   - /sofia → preenche `/sofia ` no input pra usuário continuar digitando
 *   - /resumir → executa imediatamente (não precisa de argumento)
 */
import { useMemo } from "react";
import { Sparkles, FileText, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SofiaCommand {
  key: "sofia" | "resumir";
  label: string;
  hint: string;
  /** Se true, executa imediatamente ao selecionar (não precisa de prompt). */
  immediate?: boolean;
  icon: React.ReactNode;
}

const COMMANDS: SofiaCommand[] = [
  {
    key: "sofia",
    label: "/sofia",
    hint: "Pergunta para a Sofia (ex: /sofia o que faltou da reunião?)",
    icon: <Sparkles className="h-4 w-4 text-violet-500" />,
  },
  {
    key: "resumir",
    label: "/resumir",
    hint: "Resume últimas 50 mensagens desta conversa",
    immediate: true,
    icon: <FileText className="h-4 w-4 text-violet-500" />,
  },
];

interface Props {
  query: string;
  onPick: (cmd: SofiaCommand) => void;
  className?: string;
}

export function SofiaCommandPopover({ query, onPick, className }: Props) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) => c.label.toLowerCase().includes(q) || c.key.includes(q));
  }, [query]);

  if (filtered.length === 0) {
    return (
      <div className={cn("w-72 p-3 text-xs text-muted-foreground text-center", className)}>
        Nenhum comando reconhecido
      </div>
    );
  }

  return (
    <div className={cn("w-72", className)}>
      <div className="px-3 py-1.5 border-b text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Bot className="h-3 w-3" /> Comandos da Sofia
      </div>
      <ul className="py-1">
        {filtered.map((c) => (
          <li key={c.key}>
            <button
              type="button"
              onClick={() => onPick(c)}
              className="w-full px-3 py-2 flex items-start gap-2 hover:bg-muted text-left"
            >
              <span className="mt-0.5 shrink-0">{c.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{c.label}</p>
                <p className="text-[11px] text-muted-foreground line-clamp-2">{c.hint}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
