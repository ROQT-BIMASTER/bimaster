import { useMemo, useState } from "react";
import { format, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, KanbanSquare, Search } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

import { useRrTasksMirror, type RrTaskMirror } from "@/hooks/useRrTasksMirror";
import { RrTaskDrilldownSheet } from "@/components/rr-tasks/RrTaskDrilldownSheet";
import { RRTASK_STATUS } from "@/lib/rrTasks";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";

const COLUMNS = [...RRTASK_STATUS, "Outros"] as const;

function aprovacaoVariant(v: string | null) {
  switch (v) {
    case "Aprovado":
      return "success" as const;
    case "Devolvido":
      return "destructive" as const;
    case "Pendente":
      return "warning" as const;
    default:
      return "ghost" as const;
  }
}

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function TaskCard({ task, onClick }: { task: RrTaskMirror; onClick: () => void }) {
  const prazo = parseLocalDate(task.data_prazo);
  const overdue = prazo ? isBefore(prazo, startOfDay(new Date())) : false;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-md border border-border bg-card p-3 hover:border-primary/50 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium leading-snug line-clamp-2">
          {task.titulo ?? "Sem título"}
        </h4>
        {task.rrtask_round != null && (
          <Badge variant="secondary" className="shrink-0">
            R{task.rrtask_round}
          </Badge>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant={aprovacaoVariant(task.rrtask_aprovacao)}>
          {task.rrtask_aprovacao ?? "—"}
        </Badge>
        {task.estagio && (
          <Badge variant="outline" className="font-normal">
            {task.estagio}
          </Badge>
        )}
        {task.produto?.marca && (
          <Badge variant="ghost" className="font-normal">
            {task.produto.marca}
          </Badge>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <div className="flex -space-x-2">
          {task.responsaveis.slice(0, 3).map((r) => (
            <Avatar key={r.user_id} className="h-6 w-6 border-2 border-card">
              {r.avatar_url && <AvatarImage src={r.avatar_url} />}
              <AvatarFallback className="text-[10px]">
                {initials(r.nome)}
              </AvatarFallback>
            </Avatar>
          ))}
          {task.responsaveis.length > 3 && (
            <div className="h-6 w-6 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px]">
              +{task.responsaveis.length - 3}
            </div>
          )}
        </div>
        {prazo && (
          <span
            className={
              overdue
                ? "inline-flex items-center gap-1 text-destructive font-medium"
                : "inline-flex items-center gap-1 text-muted-foreground"
            }
          >
            <CalendarDays className="h-3 w-3" />
            {format(prazo, "dd MMM", { locale: ptBR })}
          </span>
        )}
      </div>
    </button>
  );
}

export default function RrTasksBoard() {
  const { data, isLoading } = useRrTasksMirror();
  const [busca, setBusca] = useState("");
  const [marca, setMarca] = useState<string>("all");
  const [responsavel, setResponsavel] = useState<string>("all");
  const [estagio, setEstagio] = useState<string>("all");
  const [aprovacao, setAprovacao] = useState<string>("all");
  const [selected, setSelected] = useState<RrTaskMirror | null>(null);

  const tasks = data ?? [];

  const marcas = useMemo(
    () =>
      Array.from(
        new Set(tasks.map((t) => t.produto?.marca).filter((v): v is string => !!v)),
      ).sort(),
    [tasks],
  );
  const responsaveis = useMemo(() => {
    const m = new Map<string, string>();
    tasks.forEach((t) =>
      t.responsaveis.forEach((r) => {
        if (!m.has(r.user_id)) m.set(r.user_id, r.nome ?? r.user_id);
      }),
    );
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [tasks]);
  const estagios = useMemo(
    () =>
      Array.from(
        new Set(tasks.map((t) => t.estagio).filter((v): v is string => !!v)),
      ).sort(),
    [tasks],
  );
  const aprovacoes = useMemo(
    () =>
      Array.from(
        new Set(
          tasks.map((t) => t.rrtask_aprovacao).filter((v): v is string => !!v),
        ),
      ).sort(),
    [tasks],
  );

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q && !(t.titulo ?? "").toLowerCase().includes(q)) return false;
      if (marca !== "all" && t.produto?.marca !== marca) return false;
      if (
        responsavel !== "all" &&
        !t.responsaveis.some((r) => r.user_id === responsavel)
      )
        return false;
      if (estagio !== "all" && t.estagio !== estagio) return false;
      if (aprovacao !== "all" && t.rrtask_aprovacao !== aprovacao) return false;
      return true;
    });
  }, [tasks, busca, marca, responsavel, estagio, aprovacao]);

  const byColumn = useMemo(() => {
    const map = new Map<string, RrTaskMirror[]>();
    COLUMNS.forEach((c) => map.set(c, []));
    filtered.forEach((t) => {
      const col = (RRTASK_STATUS as readonly string[]).includes(t.status ?? "")
        ? (t.status as string)
        : "Outros";
      map.get(col)!.push(t);
    });
    return map;
  }, [filtered]);

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <KanbanSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-tight">
              RR-Tasks (espelho)
            </h1>
            <p className="text-xs text-muted-foreground">
              Visão das tarefas espelhadas a partir do RR-Tasks.
            </p>
          </div>
        </div>
        <Badge variant="ghost" className="font-normal">
          somente leitura · fonte: RR-Tasks
        </Badge>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título…"
              className="pl-8"
            />
          </div>
          <Select value={marca} onValueChange={setMarca}>
            <SelectTrigger>
              <SelectValue placeholder="Marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as marcas</SelectItem>
              {marcas.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={responsavel} onValueChange={setResponsavel}>
            <SelectTrigger>
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os responsáveis</SelectItem>
              {responsaveis.map(([id, nome]) => (
                <SelectItem key={id} value={id}>
                  {nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={estagio} onValueChange={setEstagio}>
            <SelectTrigger>
              <SelectValue placeholder="Etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etapas</SelectItem>
              {estagios.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={aprovacao} onValueChange={setAprovacao}>
            <SelectTrigger>
              <SelectValue placeholder="Aprovação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as aprovações</SelectItem>
              {aprovacoes.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-md" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={KanbanSquare}
          title="Nenhuma tarefa espelhada"
          description="Quando briefings forem enviados ao RR-Tasks, eles aparecerão aqui."
        />
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max xl:min-w-0 xl:grid xl:grid-cols-7">
            {COLUMNS.map((col) => {
              const items = byColumn.get(col) ?? [];
              if (col === "Outros" && items.length === 0) return null;
              return (
                <div
                  key={col}
                  className="w-72 xl:w-auto flex flex-col rounded-lg border border-border bg-muted/30"
                >
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="text-sm font-medium">{col}</span>
                    <Badge variant="secondary">{items.length}</Badge>
                  </div>
                  <div className="flex-1 p-2 space-y-2 min-h-[120px]">
                    {items.length === 0 ? (
                      <div className="text-center text-xs text-muted-foreground py-6">
                        Sem tarefas
                      </div>
                    ) : (
                      items.map((t) => (
                        <TaskCard
                          key={t.id}
                          task={t}
                          onClick={() => setSelected(t)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <RrTaskDrilldownSheet
        task={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
  );
}
