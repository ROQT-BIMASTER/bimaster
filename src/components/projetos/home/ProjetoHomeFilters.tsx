import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

interface Props {
  tarefas: MinaTarefa[];
  onFilterChange: (filtered: MinaTarefa[]) => void;
}

export function ProjetoHomeFilters({ tarefas, onFilterChange }: Props) {
  const [search, setSearch] = useState("");
  const [projetoId, setProjetoId] = useState("all");
  const [secaoId, setSecaoId] = useState("all");

  const projetos = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; cor: string }>();
    for (const t of tarefas) {
      if (!map.has(t.projeto_id)) {
        map.set(t.projeto_id, { id: t.projeto_id, nome: t.projeto_nome, cor: t.projeto_cor });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [tarefas]);

  const secoes = useMemo(() => {
    if (projetoId === "all") return [];
    const map = new Map<string, string>();
    for (const t of tarefas) {
      if (t.projeto_id === projetoId && t.secao_id && t.secao_nome) {
        map.set(t.secao_id, t.secao_nome);
      }
    }
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [tarefas, projetoId]);

  useEffect(() => {
    setSecaoId("all");
  }, [projetoId]);

  useEffect(() => {
    let result = tarefas;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t => t.titulo.toLowerCase().includes(q));
    }
    if (projetoId !== "all") {
      result = result.filter(t => t.projeto_id === projetoId);
    }
    if (secaoId !== "all") {
      result = result.filter(t => t.secao_id === secaoId);
    }
    onFilterChange(result);
  }, [search, projetoId, secaoId, tarefas]);

  const hasFilters = search || projetoId !== "all" || secaoId !== "all";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[180px] max-w-[280px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar tarefa..."
          className="h-8 pl-8 text-xs"
        />
      </div>

      <Select value={projetoId} onValueChange={setProjetoId}>
        <SelectTrigger className="h-8 w-[180px] text-xs">
          <SelectValue placeholder="Todos os projetos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os projetos</SelectItem>
          {projetos.map(p => (
            <SelectItem key={p.id} value={p.id}>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.cor }} />
                {p.nome}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {projetoId !== "all" && secoes.length > 0 && (
        <Select value={secaoId} onValueChange={setSecaoId}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Todas as seções" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as seções</SelectItem>
            {secoes.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-muted-foreground"
          onClick={() => { setSearch(""); setProjetoId("all"); setSecaoId("all"); }}
        >
          <X className="h-3 w-3 mr-1" /> Limpar
        </Button>
      )}
    </div>
  );
}
