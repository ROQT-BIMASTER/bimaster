/**
 * Barra de pastas (workspaces) da lista de Projetos.
 * Filtra a lista sem alterar permissões: pastas são apenas organização.
 */
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Folder, FolderOpen, LayoutGrid, Settings2, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjetoPasta } from "@/hooks/useProjetoPastas";

export const PASTA_TODAS = "__todas__";
export const PASTA_SEM_PASTA = "__sem_pasta__";

interface Props {
  pastas: ProjetoPasta[];
  contagens: Map<string, number>;
  totalProjetos: number;
  semPastaCount: number;
  value: string;
  onChange: (value: string) => void;
  onGerenciar: () => void;
  onOrganizar?: () => void;
}

export function ProjetoPastasBar({
  pastas,
  contagens,
  totalProjetos,
  semPastaCount,
  value,
  onChange,
  onGerenciar,
  onOrganizar,
}: Props) {

  const compartilhadas = pastas.filter((p) => p.escopo === "compartilhada");
  const pessoais = pastas.filter((p) => p.escopo === "pessoal");

  const chip = (
    key: string,
    label: string,
    count: number,
    cor?: string,
    icon?: React.ReactNode,
  ) => (
    <button
      key={key}
      type="button"
      onClick={() => onChange(key)}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        value === key
          ? "border-primary/60 bg-primary/10 text-foreground"
          : "border-border/60 bg-card/70 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {cor ? (
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: cor }} />
      ) : (
        icon
      )}
      <span className="max-w-[160px] truncate">{label}</span>
      <Badge variant="outline" className="h-4 px-1.5 text-[10px] tabular-nums border-border/60">
        {count}
      </Badge>
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chip(PASTA_TODAS, "Todos os projetos", totalProjetos, undefined, (
        <LayoutGrid className="h-3.5 w-3.5" />
      ))}

      {compartilhadas.length > 0 && (
        <span className="mx-1 h-4 w-px bg-border/70" aria-hidden />
      )}
      {compartilhadas.map((p) =>
        chip(p.id, p.nome, contagens.get(p.id) ?? 0, p.cor),
      )}

      {pessoais.length > 0 && <span className="mx-1 h-4 w-px bg-border/70" aria-hidden />}
      {pessoais.map((p) => chip(p.id, p.nome, contagens.get(p.id) ?? 0, p.cor))}

      {(compartilhadas.length > 0 || pessoais.length > 0) &&
        chip(PASTA_SEM_PASTA, "Sem pasta", semPastaCount, undefined, (
          <Inbox className="h-3.5 w-3.5" />
        ))}

      {onOrganizar && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onOrganizar}
          className="h-8 gap-1.5 text-xs text-muted-foreground"
        >
          <FolderInput className="h-3.5 w-3.5" /> Organizar projetos
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={onGerenciar}
        className="h-8 gap-1.5 text-xs text-muted-foreground"
      >
        {pastas.length === 0 ? (
          <>
            <Folder className="h-3.5 w-3.5" /> Criar pastas
          </>
        ) : (
          <>
            <Settings2 className="h-3.5 w-3.5" /> Gerenciar pastas
          </>
        )}
      </Button>
    </div>
  );
}


export { FolderOpen };
