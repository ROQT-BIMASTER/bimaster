import { memo, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMinhasDelegadas, type DelegadaTarefa } from "@/hooks/useMinhasDelegadas";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TarefaResponsavelAvatar } from "@/components/projetos/shared/TarefaResponsavelAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Search } from "lucide-react";
import { format, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { CentralToolbarPortal, CentralChipsPortal } from "@/components/projetos/central/CentralLayout";
import { CentralChip } from "@/components/projetos/central/CentralChips";
import { EmptyState } from "@/components/ui/empty-state";
import { useTarefaDensity } from "@/hooks/useTarefaDensity";
import { cn } from "@/lib/utils";

const Row = memo(function Row({ t, onOpen, isCompact }: { t: DelegadaTarefa; onOpen: (t: DelegadaTarefa) => void; isCompact: boolean }) {
  const prazoDate = parseLocalDate(t.data_prazo);
  const isOverdue = prazoDate && prazoDate < new Date() && t.status !== "concluida";
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Abrir tarefa: ${t.titulo}`}
      className={cn(
        "flex items-center gap-3 px-4 hover:bg-accent/30 focus:bg-muted/40 outline-none transition-colors cursor-pointer border-b border-border/20 last:border-b-0",
        isCompact ? "min-h-[44px] py-2" : "min-h-[56px] py-3",
      )}
      onClick={() => onOpen(t)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(t); } }}
    >
      <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t.projeto_cor }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate text-foreground">{t.titulo}</div>
        <div className="text-xs text-muted-foreground truncate">
          {t.secao_nome ? `${t.secao_nome} · ` : ""}
          {t.projeto_nome}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <TarefaResponsavelAvatar
          responsavelId={t.responsavel_id}
          nome={t.responsavel_nome}
          avatarUrl={t.responsavel_avatar_url}
          size="xs"
          showName
        />
        {prazoDate && (
          <span className={`text-xs ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            {format(prazoDate, "d MMM", { locale: ptBR })}
          </span>
        )}
        {t.status === "concluida" && (
          <Badge variant="secondary" className="text-[10px] h-4">Concluída</Badge>
        )}
      </div>
    </div>
  );
});

type StatusFilter = "pendentes" | "concluidas" | "todas";
type ChipFilter = "pendentes" | "para_hoje" | "atrasadas";

interface DelegadasProps {
  /** Contador de notificações não lidas (vem da Central, evita refetch). */
  naoLidas?: number;
  /** Handler para navegar até a aba de Inbox quando o chip "Não lidas" é clicado. */
  onGoToInbox?: () => void;
}

export function DelegadasContent({ naoLidas = 0, onGoToInbox }: DelegadasProps = {}) {
  const { data: tarefas = [], isLoading } = useMinhasDelegadas();
  const { isCompact } = useTarefaDensity();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pendentes");
  const [projetoFilter, setProjetoFilter] = useState<string>("all");
  const [chipFilter, setChipFilter] = useState<ChipFilter>("pendentes");

  const projetos = useMemo(() => {
    const m = new Map<string, { id: string; nome: string; cor: string }>();
    tarefas.forEach((t) => {
      if (!m.has(t.projeto_id)) {
        m.set(t.projeto_id, { id: t.projeto_id, nome: t.projeto_nome, cor: t.projeto_cor });
      }
    });
    return Array.from(m.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [tarefas]);

  const chipCounts = useMemo(() => {
    const now = startOfDay(new Date());
    const pendentes = tarefas.filter((t) => t.status !== "concluida");
    return {
      pendentes: pendentes.length,
      paraHoje: pendentes.filter((t) => {
        const p = parseLocalDate(t.data_prazo);
        return p && isToday(p);
      }).length,
      atrasadas: pendentes.filter((t) => {
        const p = parseLocalDate(t.data_prazo);
        return p && isBefore(startOfDay(p), now);
      }).length,
    };
  }, [tarefas]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = startOfDay(new Date());
    return tarefas.filter((t) => {
      if (statusFilter === "pendentes" && t.status === "concluida") return false;
      if (statusFilter === "concluidas" && t.status !== "concluida") return false;
      if (projetoFilter !== "all" && t.projeto_id !== projetoFilter) return false;
      if (chipFilter === "pendentes" && t.status === "concluida") return false;
      if (chipFilter === "para_hoje") {
        if (t.status === "concluida") return false;
        const p = parseLocalDate(t.data_prazo);
        if (!p || !isToday(p)) return false;
      }
      if (chipFilter === "atrasadas") {
        if (t.status === "concluida") return false;
        const p = parseLocalDate(t.data_prazo);
        if (!p || !isBefore(startOfDay(p), now)) return false;
      }
      if (q) {
        const hay = `${t.titulo} ${t.projeto_nome ?? ""} ${t.responsavel_nome ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tarefas, search, statusFilter, projetoFilter, chipFilter]);

  const handleOpen = (t: DelegadaTarefa) => {
    navigate(`/dashboard/projetos/${t.projeto_id}?tarefa=${t.id}`);
  };

  const toolbar = (
    <CentralToolbarPortal>
      <div className="relative w-72">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar tarefas delegadas..."
          className="h-9 pl-8 text-xs"
          maxLength={100}
        />
      </div>
      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
        <SelectTrigger className="w-[140px] h-9 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pendentes">Pendentes</SelectItem>
          <SelectItem value="concluidas">Concluídas</SelectItem>
          <SelectItem value="todas">Todas</SelectItem>
        </SelectContent>
      </Select>
      {projetos.length > 0 && (
        <Select value={projetoFilter} onValueChange={setProjetoFilter}>
          <SelectTrigger className="w-[180px] h-9 text-xs">
            <SelectValue placeholder="Projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {projetos.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </CentralToolbarPortal>
  );

  const chips = (
    <CentralChipsPortal>
      <CentralChip
        label="Pendentes"
        count={chipCounts.pendentes}
        active={chipFilter === "pendentes"}
        onClick={() => setChipFilter("pendentes")}
      />
      <CentralChip
        label="Para hoje"
        count={chipCounts.paraHoje}
        active={chipFilter === "para_hoje"}
        onClick={() => setChipFilter("para_hoje")}
      />
      <CentralChip
        label="Atrasadas"
        count={chipCounts.atrasadas}
        countVariant={
          chipCounts.atrasadas > 0 && chipFilter !== "atrasadas" ? "destructive" : undefined
        }
        active={chipFilter === "atrasadas"}
        onClick={() => setChipFilter("atrasadas")}
      />
      <CentralChip
        label="Não lidas"
        count={naoLidas}
        onClick={() => onGoToInbox?.()}
        title="Abrir notificações"
      />
    </CentralChipsPortal>
  );

  if (isLoading) {
    return (
      <>
        {toolbar}
        {chips}
        <Card>
          <CardContent className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </>
    );
  }

  if (tarefas.length === 0) {
    return (
      <>
        {toolbar}
        {chips}
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Inbox className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <div className="text-sm font-medium text-foreground">Nada delegado por enquanto</div>
            <div className="text-xs mt-1">
              Tarefas que você criar e atribuir a outras pessoas aparecem aqui.
            </div>
            <a
              href="/dashboard/ajuda/projetos-visibilidade"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 text-xs text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Como funciona a visibilidade?
            </a>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      {toolbar}
        {chips}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-2.5 border-b bg-muted/20 flex items-center gap-2">
            <Send className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tarefas que você delegou ({filtered.length})
            </span>
          </div>
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Nenhuma tarefa corresponde aos filtros atuais.
            </div>
          ) : (
            filtered.map((t) => <Row key={t.id} t={t} onOpen={handleOpen} />)
          )}
        </CardContent>
      </Card>
    </>
  );
}
