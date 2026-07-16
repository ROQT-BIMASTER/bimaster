import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, Settings2, Filter, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  SUPORTE_PRIORIDADE_CLASS,
  SUPORTE_PRIORIDADE_LABEL,
  SUPORTE_STATUS_COLOR,
  SUPORTE_STATUS_LABEL,
  type SuporteChamado,
  type SuporteFila,
  type SuportePrioridade,
  type SuporteTicketStatus,
} from "@/hooks/suporte/types";
import { useSuporteChamadosPaginated } from "@/hooks/suporte/useSuporteChamadosPaginated";
import type { SuporteViewFiltros, SuporteViewOrdenacao } from "@/hooks/suporte/useSuporteViews";
import {
  COLUNAS_DEFAULT,
  COLUNA_LABEL,
  TODAS_COLUNAS,
  type TicketColuna,
} from "@/lib/suporte/exportTickets";

const CATEGORIA_LABEL: Record<string, string> = {
  bug: "Bug",
  duvida_uso: "Dúvida",
  solicitacao_acesso: "Acesso",
  solicitacao_funcionalidade: "Feature",
  integracao: "Integração",
  financeiro: "Financeiro",
  performance: "Performance",
  dados_inconsistentes: "Dados",
  outro: "Outro",
};

interface Props {
  filaIds: string[];
  filasSelecionaveis: SuporteFila[];
  filtros: SuporteViewFiltros;
  onFiltrosChange: (f: SuporteViewFiltros) => void;
  colunas: TicketColuna[];
  onColunasChange: (c: TicketColuna[]) => void;
  ordenacao: SuporteViewOrdenacao;
  onOrdenacaoChange: (o: SuporteViewOrdenacao) => void;
  selecionados: Set<string>;
  onSelecionadosChange: (s: Set<string>) => void;
  onOpenTicket: (id: string) => void;
  onDataChange?: (tickets: SuporteChamado[], nomes: Map<string, string>) => void;
}

const PAGE_SIZE = 50;

export function SuporteTicketsTable({
  filaIds,
  filasSelecionaveis,
  filtros,
  onFiltrosChange,
  colunas,
  onColunasChange,
  ordenacao,
  onOrdenacaoChange,
  selecionados,
  onSelecionadosChange,
  onOpenTicket,
  onDataChange,
}: Props) {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useSuporteChamadosPaginated({
    filaIds,
    filtros,
    ordenacao,
    page,
    pageSize: PAGE_SIZE,
  });

  const tickets = data?.tickets ?? [];
  const total = data?.total ?? 0;
  const nomes = data?.nomes ?? new Map<string, string>();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    onDataChange?.(tickets, nomes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, nomes]);

  const todosMarcados = tickets.length > 0 && tickets.every((t) => selecionados.has(t.id));
  const algunsMarcados = tickets.some((t) => selecionados.has(t.id)) && !todosMarcados;

  const toggleAll = () => {
    const next = new Set(selecionados);
    if (todosMarcados) tickets.forEach((t) => next.delete(t.id));
    else tickets.forEach((t) => next.add(t.id));
    onSelecionadosChange(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selecionados);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelecionadosChange(next);
  };

  const setSort = (campo: string) => {
    if (ordenacao.campo === campo) {
      onOrdenacaoChange({ campo, dir: ordenacao.dir === "asc" ? "desc" : "asc" });
    } else {
      onOrdenacaoChange({ campo, dir: "desc" });
    }
  };

  const setFiltro = (patch: Partial<SuporteViewFiltros>) => {
    onFiltrosChange({ ...filtros, ...patch });
    setPage(0);
  };

  const isSortable = (col: TicketColuna) =>
    ["protocolo", "titulo", "status", "prioridade", "atualizado_em", "criado_em"].includes(col);

  return (
    <div className="flex flex-col gap-2 min-h-0 flex-1">
      {/* Barra de filtros + colunas */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={filtros.busca ?? ""}
            onChange={(e) => setFiltro({ busca: e.target.value })}
            placeholder="Buscar título, protocolo, resumo…"
            className="pl-8 w-64 h-8 text-xs"
          />
        </div>

        <Select
          value={filtros.status ?? "abertos"}
          onValueChange={(v) => setFiltro({ status: v })}
        >
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="abertos">Abertos</SelectItem>
            <SelectItem value="todos">Todos status</SelectItem>
            {(Object.keys(SUPORTE_STATUS_LABEL) as SuporteTicketStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{SUPORTE_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filtros.prioridade ?? "todas"}
          onValueChange={(v) => setFiltro({ prioridade: v })}
        >
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Prioridade</SelectItem>
            {(Object.keys(SUPORTE_PRIORIDADE_LABEL) as SuportePrioridade[]).map((p) => (
              <SelectItem key={p} value={p}>{SUPORTE_PRIORIDADE_LABEL[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filtros.categoria ?? "todas"}
          onValueChange={(v) => setFiltro({ categoria: v })}
        >
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Categorias</SelectItem>
            {Object.entries(CATEGORIA_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Filter className="h-3.5 w-3.5" />
              Filtros avançados
              {(filtros.sla_violado || filtros.sem_responsavel) && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">•</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-2" align="start">
            <label className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={!!filtros.sla_violado}
                onCheckedChange={(v) => setFiltro({ sla_violado: !!v })}
              />
              SLA violado
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={!!filtros.sem_responsavel}
                onCheckedChange={(v) => setFiltro({ sem_responsavel: !!v })}
              />
              Sem responsável
            </label>
            <div className="pt-1">
              <label className="text-xs text-muted-foreground">Departamento</label>
              <Select
                value={filtros.fila_id ?? "todas"}
                onValueChange={(v) => setFiltro({ fila_id: v === "todas" ? undefined : v })}
              >
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos</SelectItem>
                  {filasSelecionaveis.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Settings2 className="h-3.5 w-3.5" />
              Colunas
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="end">
            <div className="text-xs font-medium mb-2">Colunas visíveis</div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {TODAS_COLUNAS.map((c) => (
                <label key={c} className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={colunas.includes(c)}
                    onCheckedChange={(v) => {
                      if (v) onColunasChange([...colunas, c]);
                      else onColunasChange(colunas.filter((x) => x !== c));
                    }}
                  />
                  {COLUNA_LABEL[c]}
                </label>
              ))}
            </div>
            <div className="pt-2 mt-2 border-t">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-full text-xs"
                onClick={() => onColunasChange(COLUNAS_DEFAULT)}
              >
                Restaurar padrão
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="ml-auto text-xs text-muted-foreground">
          {total === 0 ? "0 tickets" : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} de ${total}`}
        </div>
      </div>

      {/* Tabela */}
      <div className="border rounded-md overflow-hidden flex flex-col min-h-0 flex-1 bg-card">
        <div className="overflow-auto flex-1">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr className="border-b">
                <th className="w-8 p-2">
                  <Checkbox
                    checked={todosMarcados || (algunsMarcados ? "indeterminate" : false)}
                    onCheckedChange={toggleAll}
                  />
                </th>
                {colunas.map((c) => (
                  <th
                    key={c}
                    className={cn(
                      "text-left px-2 py-1.5 font-medium text-muted-foreground whitespace-nowrap",
                      isSortable(c) && "cursor-pointer hover:text-foreground",
                    )}
                    onClick={() => isSortable(c) && setSort(c)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {COLUNA_LABEL[c]}
                      {isSortable(c) && ordenacao.campo === c && (
                        <ArrowUpDown className="h-3 w-3" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={colunas.length + 1} className="py-8 text-center">
                  <Loader2 className="h-4 w-4 animate-spin inline-block text-primary" />
                </td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan={colunas.length + 1} className="py-8 text-center text-muted-foreground">
                  Nenhum ticket nesta visão.
                </td></tr>
              ) : (
                tickets.map((t) => {
                  const sel = selecionados.has(t.id);
                  return (
                    <tr
                      key={t.id}
                      className={cn(
                        "border-b hover:bg-muted/40 cursor-pointer transition-colors",
                        sel && "bg-primary/5",
                      )}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("[data-stop]")) return;
                        onOpenTicket(t.id);
                      }}
                    >
                      <td className="p-2" data-stop>
                        <Checkbox
                          checked={sel}
                          onCheckedChange={() => toggleOne(t.id)}
                        />
                      </td>
                      {colunas.map((c) => (
                        <td key={c} className="px-2 py-1.5 whitespace-nowrap">
                          <CellRenderer col={c} ticket={t} nomes={nomes} />
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="flex items-center justify-between border-t px-2 py-1.5 bg-muted/30 text-xs">
          <div className="text-muted-foreground">
            Página {page + 1} de {totalPages}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CellRenderer({
  col,
  ticket: t,
  nomes,
}: { col: TicketColuna; ticket: SuporteChamado; nomes: Map<string, string> }) {
  switch (col) {
    case "protocolo":
      return t.protocolo ? (
        <span className="font-mono text-[10px] text-muted-foreground">{t.protocolo}</span>
      ) : <span className="text-muted-foreground">—</span>;
    case "titulo":
      return <span className="font-medium truncate max-w-[320px] inline-block align-middle">{t.titulo ?? "(sem título)"}</span>;
    case "solicitante":
      return <span>{t.requester?.nome ?? "—"}</span>;
    case "fila":
      return t.fila ? (
        <Badge variant="outline" className="text-[10px]">{t.fila.nome}</Badge>
      ) : <span className="text-muted-foreground">—</span>;
    case "responsavel":
      return t.assignee_id ? (
        <span>{nomes.get(t.assignee_id) ?? "—"}</span>
      ) : <span className="text-muted-foreground italic">sem responsável</span>;
    case "status":
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", SUPORTE_STATUS_COLOR[t.status])} />
          {SUPORTE_STATUS_LABEL[t.status]}
        </span>
      );
    case "prioridade":
      return (
        <Badge variant="outline" className={cn("text-[10px]", SUPORTE_PRIORIDADE_CLASS[t.prioridade])}>
          {SUPORTE_PRIORIDADE_LABEL[t.prioridade]}
        </Badge>
      );
    case "sla": {
      if (t.status === "resolvido") {
        if (t.sla_status === "cumprido") return <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-700 border-green-500/20">Cumprido</Badge>;
        if (t.sla_status === "violado") return <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-700 border-red-500/20">Violado</Badge>;
        return <span className="text-muted-foreground">—</span>;
      }
      if (t.sla_status === "violado") return <Badge className="text-[10px] bg-red-600 text-white">Violado</Badge>;
      if (t.sla_status === "em_risco") return <Badge className="text-[10px] bg-orange-500 text-white">Em risco</Badge>;
      if (t.sla_status === "cumprido") return <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-700 border-green-500/20">Cumprido</Badge>;
      if (t.sla_status === "pausado") return <Badge variant="outline" className="text-[10px] text-muted-foreground">Pausado</Badge>;
      const prazo = t.primeira_resposta_em ? t.prazo_resolucao_em : t.prazo_primeira_resposta_em;
      if (prazo) {
        return (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(prazo), { addSuffix: true, locale: ptBR })}
          </Badge>
        );
      }
      return <span className="text-muted-foreground">—</span>;
    }
    case "categoria":
      return t.categoria ? <span className="text-muted-foreground">{CATEGORIA_LABEL[t.categoria] ?? t.categoria}</span> : <span className="text-muted-foreground">—</span>;
    case "canal":
      return <span className="text-muted-foreground">{t.canal}</span>;
    case "criado_em":
      return <span className="text-muted-foreground">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: ptBR })}</span>;
    case "atualizado_em":
      return <span className="text-muted-foreground">{t.ultima_interacao_em ? formatDistanceToNow(new Date(t.ultima_interacao_em), { addSuffix: true, locale: ptBR }) : "—"}</span>;
    case "tags":
      return (t.tags ?? []).length > 0 ? (
        <span className="flex gap-1 flex-wrap">
          {(t.tags ?? []).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
          ))}
        </span>
      ) : <span className="text-muted-foreground">—</span>;
  }
}
