import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Inbox, AlertTriangle, CheckCircle2, ListChecks } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAprovacoesConsolidado,
  type AprovacaoConsolidado,
  type EscopoAprovacao,
} from "@/hooks/useAprovacoesConsolidado";
import { LoteAprovacaoCardCompacto } from "./LoteAprovacaoCardCompacto";
import { LoteAprovacaoDrawer } from "./LoteAprovacaoDrawer";
import { AprovacoesEmptyState } from "./AprovacoesEmptyState";

interface Props {
  escopo: EscopoAprovacao["escopo"];
  projetoId?: string;
  secaoId?: string | null;
  titulo?: string;
  subtitulo?: string;
  hideBreadcrumb?: boolean;
}

const STATUS_FINAL = ["concluido", "cancelado"];

export function AprovacoesDashboard({
  escopo,
  projetoId,
  secaoId,
  titulo = "Aprovações",
  subtitulo,
  hideBreadcrumb,
}: Props) {
  const { user } = useAuth();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"abertos" | "atrasados" | "concluidos" | "todos">("abertos");
  const [drawerItem, setDrawerItem] = useState<AprovacaoConsolidado | null>(null);

  const input = useMemo<EscopoAprovacao>(() => {
    if (escopo === "pessoal") return { escopo: "pessoal", userId: user?.id };
    if (escopo === "projeto") return { escopo: "projeto", projetoId, secaoId };
    return { escopo: "secao", secaoId: secaoId ?? undefined };
  }, [escopo, user?.id, projetoId, secaoId]);

  const { data: itens = [], isLoading } = useAprovacoesConsolidado(input);

  const filtrados = useMemo(() => {
    return itens.filter((i) => {
      if (filtroStatus === "abertos" && STATUS_FINAL.includes(i.status)) return false;
      if (filtroStatus === "atrasados" && !i.atrasado) return false;
      if (filtroStatus === "concluidos" && !STATUS_FINAL.includes(i.status)) return false;

      if (busca.trim()) {
        const q = busca.toLowerCase();
        const hay = [
          i.lote_nome,
          i.titulo,
          i.projeto_nome,
          i.secao_nome,
          i.tarefa_titulo,
          i.etapa_nome,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [itens, busca, filtroStatus]);

  // Agrupamento por etapa (kanban)
  const colunas = useMemo(() => {
    const map = new Map<string, AprovacaoConsolidado[]>();
    for (const i of filtrados) {
      const key = i.status === "concluido"
        ? "Concluído"
        : i.status === "cancelado"
          ? "Cancelado"
          : i.etapa_nome || "Sem etapa";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    }
    return Array.from(map.entries());
  }, [filtrados]);

  const kpis = useMemo(() => {
    const abertos = itens.filter((i) => !STATUS_FINAL.includes(i.status));
    return {
      total: abertos.length,
      atrasados: abertos.filter((i) => i.atrasado).length,
      concluidos: itens.filter((i) => i.status === "concluido").length,
    };
  }, [itens]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{titulo}</h1>
        {subtitulo && <p className="text-sm text-muted-foreground">{subtitulo}</p>}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 bg-card/70 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            <p className="text-[10px] uppercase text-muted-foreground">Pendentes</p>
          </div>
          <p className="text-2xl font-semibold mt-1">{kpis.total}</p>
        </Card>
        <Card className="p-3 bg-card/70 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <p className="text-[10px] uppercase text-muted-foreground">Atrasadas</p>
          </div>
          <p className="text-2xl font-semibold mt-1 text-destructive">{kpis.atrasados}</p>
        </Card>
        <Card className="p-3 bg-card/70 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <p className="text-[10px] uppercase text-muted-foreground">Concluídas</p>
          </div>
          <p className="text-2xl font-semibold mt-1">{kpis.concluidos}</p>
        </Card>
        <Card className="p-3 bg-card/70 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-muted-foreground" />
            <p className="text-[10px] uppercase text-muted-foreground">Total</p>
          </div>
          <p className="text-2xl font-semibold mt-1">{itens.length}</p>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <Tabs value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)}>
          <TabsList>
            <TabsTrigger value="abertos">Abertos</TabsTrigger>
            <TabsTrigger value="atrasados">Atrasados</TabsTrigger>
            <TabsTrigger value="concluidos">Concluídos</TabsTrigger>
            <TabsTrigger value="todos">Todos</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar lote, projeto, tarefa, etapa…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>

      {/* Kanban consolidado */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : itens.length === 0 ? (
        <AprovacoesEmptyState />
      ) : colunas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground bg-card/50">
          Nenhuma aprovação para os filtros selecionados.
        </Card>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {colunas.map(([nomeColuna, lotes]) => (
            <div
              key={nomeColuna}
              className="min-w-[280px] w-[280px] shrink-0 bg-muted/30 rounded-lg p-2 space-y-2"
            >
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-semibold">{nomeColuna}</p>
                <Badge variant="outline" className="text-[10px] h-4">
                  {lotes.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {lotes.map((l) => (
                  <LoteAprovacaoCardCompacto
                    key={l.id}
                    item={l}
                    onOpen={setDrawerItem}
                    showBreadcrumb={!hideBreadcrumb}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <LoteAprovacaoDrawer
        item={drawerItem}
        open={!!drawerItem}
        onOpenChange={(v) => !v && setDrawerItem(null)}
      />
    </div>
  );
}
