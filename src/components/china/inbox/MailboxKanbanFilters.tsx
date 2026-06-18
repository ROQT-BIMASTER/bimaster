import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Filter, FilterX, Paperclip, Circle as CircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { AnexoFilter, BucketFilter, ChinaKanbanFilters } from "@/hooks/useChinaKanbanFilters";
import type { MailboxGroup } from "@/lib/china/groupMailboxItems";

const BUCKET_LABEL: Record<BucketFilter, string> = {
  pendente: "Pendentes",
  enviado: "Enviados",
  em_analise: "Em análise",
  aprovado: "Aprovados",
  rejeitado: "Devolvidos",
};

const BUCKET_TONE: Record<BucketFilter, string> = {
  pendente: "data-[on=true]:bg-muted data-[on=true]:text-foreground",
  enviado: "data-[on=true]:bg-primary/15 data-[on=true]:text-primary",
  em_analise: "data-[on=true]:bg-amber-500/15 data-[on=true]:text-amber-700 dark:data-[on=true]:text-amber-400",
  aprovado: "data-[on=true]:bg-emerald-500/15 data-[on=true]:text-emerald-700 dark:data-[on=true]:text-emerald-400",
  rejeitado: "data-[on=true]:bg-rose-500/15 data-[on=true]:text-rose-700 dark:data-[on=true]:text-rose-400",
};

interface Props {
  filters: ChinaKanbanFilters;
  isActive: boolean;
  groups: MailboxGroup[];
  totalSubs: number;
  totalUnread: number;
  onlyUnread: boolean;
  onToggleUnread: () => void;
  onSetAnexo: (a: AnexoFilter) => void;
  onToggleBucket: (b: BucketFilter) => void;
  onToggleSubmissao: (id: string) => void;
  onClearSubmissoes: () => void;
  onClearAll: () => void;
  /** Quando true, abre o popover automaticamente (atalho "f"). */
  openSubmissaoSignal?: number;
}

export function MailboxKanbanFilters({
  filters, isActive, groups, totalSubs, totalUnread, onlyUnread,
  onToggleUnread, onSetAnexo, onToggleBucket, onToggleSubmissao,
  onClearSubmissoes, onClearAll, openSubmissaoSignal,
}: Props) {
  const [open, setOpen] = useState(false);

  // Sinal externo para abrir o popover (atalho de teclado)
  useMemoOpenSignal(openSubmissaoSignal, () => setOpen(true));

  const selectedCount = filters.submissaoIds.length;
  const sortedGroups = useMemo(
    () =>
      [...groups].sort((a, b) =>
        (a.produto_codigo || "").localeCompare(b.produto_codigo || "", "pt-BR"),
      ),
    [groups],
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-card/30 px-3 py-1.5">
      {/* Combobox de submissões */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={open}
            className="h-7 gap-1.5 px-2 text-[11px]"
            title="Filtrar por submissão (atalho: f)"
          >
            <Filter className="h-3.5 w-3.5" />
            {selectedCount === 0
              ? "Submissão"
              : selectedCount === 1
                ? abreviarSubmissao(groups.find((g) => g.submissao_id === filters.submissaoIds[0]))
                : `${selectedCount} submissões`}
            <ChevronsUpDown className="h-3 w-3 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar submissão (código ou nome)…" className="h-8 text-[12px]" />
            <CommandList>
              <CommandEmpty>Nenhuma submissão encontrada.</CommandEmpty>
              <CommandGroup>
                {sortedGroups.map((g) => {
                  const selected = filters.submissaoIds.includes(g.submissao_id);
                  return (
                    <CommandItem
                      key={g.submissao_id}
                      value={`${g.produto_codigo} ${g.produto_nome} ${g.numero_ordem ?? ""}`}
                      onSelect={() => onToggleSubmissao(g.submissao_id)}
                      className="gap-2 text-[12px]"
                    >
                      <Check className={cn("h-3.5 w-3.5", selected ? "opacity-100" : "opacity-0")} />
                      <span className="font-mono tabular-nums text-[11px] text-muted-foreground">
                        {g.produto_codigo}
                      </span>
                      <span className="truncate">{g.produto_nome}</span>
                      {g.numero_ordem && (
                        <Badge variant="secondary" className="ml-auto h-4 px-1 text-[9.5px]">
                          OC {g.numero_ordem}
                        </Badge>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {selectedCount > 0 && (
                <div className="border-t border-border p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-full justify-start text-[11px]"
                    onClick={onClearSubmissoes}
                  >
                    <FilterX className="mr-1.5 h-3.5 w-3.5" /> Limpar seleção
                  </Button>
                </div>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Estado do anexo (segmented) */}
      <ToggleGroup
        type="single"
        size="sm"
        value={filters.anexo}
        onValueChange={(v) => v && onSetAnexo(v as AnexoFilter)}
        className="h-7 rounded-md border border-border"
      >
        <ToggleGroupItem value="all" className="h-7 px-2 text-[11px]">Todos</ToggleGroupItem>
        <ToggleGroupItem value="with" className="h-7 px-2 text-[11px] gap-1" title="Com documento anexado">
          <Paperclip className="h-3 w-3" /> Com anexo
        </ToggleGroupItem>
        <ToggleGroupItem value="without" className="h-7 px-2 text-[11px] gap-1" title="Sem documento">
          <CircleIcon className="h-3 w-3" /> Sem anexo
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Chips multi-seleção de etapa */}
      <div className="flex h-7 items-center gap-1 rounded-md border border-border px-1">
        {(Object.keys(BUCKET_LABEL) as BucketFilter[]).map((b) => {
          const on = filters.buckets.includes(b);
          return (
            <button
              key={b}
              type="button"
              data-on={on}
              aria-pressed={on}
              onClick={() => onToggleBucket(b)}
              className={cn(
                "h-5 rounded px-1.5 text-[10.5px] transition-colors",
                "text-muted-foreground hover:text-foreground",
                BUCKET_TONE[b],
                !on && "opacity-50",
              )}
            >
              {BUCKET_LABEL[b]}
            </button>
          );
        })}
      </div>

      {/* Apenas não lidas */}
      <Button
        type="button"
        variant={onlyUnread ? "default" : "outline"}
        size="sm"
        className="h-7 px-2 text-[11px]"
        onClick={onToggleUnread}
      >
        {onlyUnread ? "Mostrar todas" : "Apenas não lidas"}
      </Button>

      {/* Limpar */}
      {isActive && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] text-muted-foreground"
          onClick={onClearAll}
        >
          <FilterX className="mr-1 h-3 w-3" /> Limpar filtros
        </Button>
      )}

      {/* Resumo à direita */}
      <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="tabular-nums">
          <strong className="text-foreground">{totalSubs}</strong> submiss{totalSubs === 1 ? "ão" : "ões"}
        </span>
        {totalUnread > 0 && (
          <>
            <span className="text-border">·</span>
            <span className="tabular-nums text-primary">
              <strong>{totalUnread}</strong> não lid{totalUnread === 1 ? "a" : "as"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function abreviarSubmissao(g?: MailboxGroup) {
  if (!g) return "Submissão";
  const nome = g.produto_nome.length > 18 ? `${g.produto_nome.slice(0, 18)}…` : g.produto_nome;
  return `${g.produto_codigo} · ${nome}`;
}

// Pequeno helper interno: dispara o callback quando `signal` muda.
function useMemoOpenSignal(signal: number | undefined, cb: () => void) {
  useEffect(() => {
    if (signal === undefined) return;
    cb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal]);
}
