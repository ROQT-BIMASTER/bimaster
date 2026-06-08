import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus,
  FileText,
  Megaphone,
  Sparkles,
  Package,
  Store,
  Box,
  Calendar,
  ShoppingBag,
  Newspaper,
  BookOpen,
  Search,
  LayoutGrid,
  ArrowLeft,
  Users,
  Link2,
  FolderKanban,
  ListChecks,
  MoreHorizontal,
  ArrowUpDown,
  Trash2,
  Archive,
  ArchiveRestore,
  Settings,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePageBgColor } from "@/components/shared/PageBgCustomizer";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { uniqueChannelName } from "@/lib/realtime/channelName";
import { BriefingMembrosDialog } from "@/components/briefings/BriefingMembrosDialog";
import { VincularProjetoDialog } from "@/components/briefings/VincularProjetoDialog";

type Tipo = string;

const ICON_POR_TIPO: Record<string, React.ComponentType<{ className?: string }>> = {
  marketing: Megaphone,
  criativo: Sparkles,
  produto: Package,
  trade: Store,
  pdv: Store,
  embalagem: Box,
  evento: Calendar,
  campanha: Megaphone,
  ecommerce: ShoppingBag,
  presskit: Newspaper,
  catalogo: BookOpen,
  material_interno: FileText,
};
const ICON_FALLBACK = FileText;

interface BriefingRow {
  id: string;
  tipo: string;
  titulo: string;
  status: string;
  completude: number;
  updated_at: string;
  user_id: string;
  projeto_id: string | null;
  tarefa_id: string | null;
  rrtask_page_id: string | null;
  rrtask_aprovacao: string | null;
  rrtask_status: string | null;
  rrtask_etapa: string | null;
  rrtask_round: number | null;
  rrtask_synced_at: string | null;
}

interface MembroLite {
  briefing_id: string;
  user_id: string;
  papel: string;
  last_read_at: string | null;
}

interface ProfileLite {
  id: string;
  nome: string | null;
  avatar_url: string | null;
}

interface TipoTemplate {
  tipo: string;
  nome: string;
  descricao: string | null;
  versao: number;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  rascunho: "outline",
  em_andamento: "secondary",
  final: "default",
  arquivado: "outline",
};

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_andamento: "Em andamento",
  final: "Final",
  arquivado: "Arquivado",
};

type AgenciaFiltro =
  | "todos"
  | "nao_enviado"
  | "pendente"
  | "em_revisao"
  | "aprovado"
  | "rejeitado";

function normalizeAprovacao(v: string | null | undefined): AgenciaFiltro {
  if (!v) return "pendente";
  const s = v.trim().toLowerCase();
  if (s.includes("aprov")) return "aprovado";
  if (s.includes("revis")) return "em_revisao";
  if (s.includes("rejeit") || s.includes("reprov")) return "rejeitado";
  return "pendente";
}

const AGENCIA_LABEL: Record<AgenciaFiltro, string> = {
  todos: "Toda a agência",
  nao_enviado: "Não enviado",
  pendente: "Enviado / Pendente",
  em_revisao: "Em revisão",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

function agenciaBadgeClass(a: AgenciaFiltro): string {
  switch (a) {
    case "aprovado":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    case "em_revisao":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
    case "rejeitado":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "pendente":
      return "bg-primary/10 text-primary border-primary/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

type EscopoFiltro = "todos" | "meus" | "compartilhados";
type StatusFiltro = "todos" | "rascunho" | "em_andamento" | "final" | "arquivado";
type RodadaFiltro = "todos" | "1" | "2" | "3+";
type SortKey = "updated_at" | "titulo" | "completude";

function iniciais(nome?: string | null) {
  if (!nome) return "?";
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function BriefingsHome() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const { bgStyle, BgColorButton } = usePageBgColor("briefings_home");

  const [openNew, setOpenNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tipoSel, setTipoSel] = useState<Tipo>("");
  const [titulo, setTitulo] = useState("");

  const { isGerente } = useUserRole();
  const canConfigure = isAdmin || isGerente;

  const [filtroTipo, setFiltroTipo] = useState<string>("__todos");
  const [escopo, setEscopo] = useState<EscopoFiltro>("todos");
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>("todos");
  const [filtroAgencia, setFiltroAgencia] = useState<AgenciaFiltro>("todos");
  const [filtroRodada, setFiltroRodada] = useState<RodadaFiltro>("todos");
  const [filtroProjeto, setFiltroProjeto] = useState<string>("__todos");
  const [busca, setBusca] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("updated_at");
  const [sortAsc, setSortAsc] = useState(false);

  // Dialogs por linha
  const [membrosDialogId, setMembrosDialogId] = useState<string | null>(null);
  const [vincDialog, setVincDialog] = useState<
    { id: string; projetoId: string | null; tarefaId: string | null } | null
  >(null);
  const [excluirDialog, setExcluirDialog] = useState<
    { id: string; titulo: string } | null
  >(null);

  const { data: tipos, isLoading: loadingTipos } = useQuery({
    queryKey: ["briefing_templates_lista"],
    queryFn: async (): Promise<TipoTemplate[]> => {
      const { data, error } = await supabase
        .from("briefing_templates")
        .select("tipo, nome, descricao, versao")
        .eq("ativo", true)
        .order("nome", { ascending: true });
      if (error) throw error;
      const map = new Map<string, TipoTemplate>();
      for (const row of (data ?? []) as TipoTemplate[]) {
        const cur = map.get(row.tipo);
        if (!cur || row.versao > cur.versao) map.set(row.tipo, row);
      }
      return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
    },
  });

  const { data: briefings = [], isLoading: loading } = useQuery({
    queryKey: ["briefings_home_lista"],
    queryFn: async (): Promise<BriefingRow[]> => {
      const { data, error } = await supabase
        .from("briefings")
        .select(
          "id, tipo, titulo, status, completude, updated_at, user_id, projeto_id, tarefa_id, rrtask_page_id, rrtask_aprovacao, rrtask_status, rrtask_etapa, rrtask_round, rrtask_synced_at",
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BriefingRow[];
    },
  });

  const briefingIds = useMemo(() => briefings.map((b) => b.id), [briefings]);
  const ownerIds = useMemo(
    () => Array.from(new Set(briefings.map((b) => b.user_id).filter(Boolean))),
    [briefings],
  );
  const projetoIds = useMemo(
    () =>
      Array.from(
        new Set(briefings.map((b) => b.projeto_id).filter((x): x is string => !!x)),
      ),
    [briefings],
  );
  const tarefaIds = useMemo(
    () =>
      Array.from(
        new Set(briefings.map((b) => b.tarefa_id).filter((x): x is string => !!x)),
      ),
    [briefings],
  );

  const { data: membrosAll = [] } = useQuery({
    queryKey: ["briefings_home_membros", briefingIds.join(",")],
    enabled: briefingIds.length > 0,
    queryFn: async (): Promise<MembroLite[]> => {
      const { data, error } = await supabase
        .from("briefing_membros")
        .select("briefing_id, user_id, papel, last_read_at")
        .in("briefing_id", briefingIds);
      if (error) throw error;
      return (data ?? []) as MembroLite[];
    },
  });

  const memberIds = useMemo(
    () => Array.from(new Set(membrosAll.map((m) => m.user_id))),
    [membrosAll],
  );

  const allProfileIds = useMemo(
    () => Array.from(new Set([...ownerIds, ...memberIds])),
    [ownerIds, memberIds],
  );

  const { data: profiles = [] } = useQuery({
    queryKey: ["briefings_home_profiles", allProfileIds.join(",")],
    enabled: allProfileIds.length > 0,
    queryFn: async (): Promise<ProfileLite[]> => {
      const { data, error } = await (supabase.rpc as any)(
        "get_chat_directory",
        { _ids: allProfileIds },
      );
      if (error) throw error;
      return ((data ?? []) as unknown) as ProfileLite[];
    },
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, ProfileLite>();
    profiles.forEach((p) => m.set(p.id, p));
    return m;
  }, [profiles]);

  const { data: projetosMap = new Map<string, string>() } = useQuery({
    queryKey: ["briefings_home_projetos", projetoIds.join(",")],
    enabled: projetoIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, nome")
        .in("id", projetoIds);
      if (error) throw error;
      const m = new Map<string, string>();
      (data ?? []).forEach((p: any) => m.set(p.id, p.nome));
      return m;
    },
  });

  const { data: tarefasMap = new Map<string, string>() } = useQuery({
    queryKey: ["briefings_home_tarefas", tarefaIds.join(",")],
    enabled: tarefaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefas")
        .select("id, titulo")
        .in("id", tarefaIds);
      if (error) throw error;
      const m = new Map<string, string>();
      (data ?? []).forEach((t: any) => m.set(t.id, t.titulo));
      return m;
    },
  });

  const membrosPorBriefing = useMemo(() => {
    const m = new Map<string, MembroLite[]>();
    membrosAll.forEach((mb) => {
      const arr = m.get(mb.briefing_id) ?? [];
      arr.push(mb);
      m.set(mb.briefing_id, arr);
    });
    return m;
  }, [membrosAll]);

  // Realtime: atualizações em briefings e membros
  useEffect(() => {
    const channel = supabase
      .channel(uniqueChannelName("briefings-home"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "briefings" },
        () => queryClient.invalidateQueries({ queryKey: ["briefings_home_lista"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "briefing_membros" },
        () =>
          queryClient.invalidateQueries({
            queryKey: ["briefings_home_membros"],
            exact: false,
          }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const contagemPorTipo = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of briefings) m.set(b.tipo, (m.get(b.tipo) ?? 0) + 1);
    return m;
  }, [briefings]);

  // Lista de projetos para filtro (só os que têm briefing)
  const projetosFiltro = useMemo(() => {
    const arr: Array<{ id: string; nome: string }> = [];
    projetoIds.forEach((id) => {
      const nome = projetosMap.get(id);
      if (nome) arr.push({ id, nome });
    });
    return arr.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [projetoIds, projetosMap]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const uid = user?.id;
    const list = briefings.filter((b) => {
      if (filtroTipo !== "__todos" && b.tipo !== filtroTipo) return false;
      if (filtroStatus !== "todos" && b.status !== filtroStatus) return false;
      if (filtroProjeto !== "__todos" && b.projeto_id !== filtroProjeto) return false;
      if (filtroAgencia !== "todos") {
        if (filtroAgencia === "nao_enviado") {
          if (b.rrtask_page_id) return false;
        } else {
          if (!b.rrtask_page_id) return false;
          if (normalizeAprovacao(b.rrtask_aprovacao) !== filtroAgencia) return false;
        }
      }
      if (filtroRodada !== "todos") {
        const r = b.rrtask_round ?? 0;
        if (filtroRodada === "1" && r !== 1) return false;
        if (filtroRodada === "2" && r !== 2) return false;
        if (filtroRodada === "3+" && r < 3) return false;
      }
      if (escopo === "meus" && b.user_id !== uid) return false;
      if (escopo === "compartilhados") {
        if (b.user_id === uid) return false;
        const membros = membrosPorBriefing.get(b.id) ?? [];
        if (!membros.some((m) => m.user_id === uid)) return false;
      }
      if (q && !b.titulo.toLowerCase().includes(q)) return false;
      return true;
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "titulo") cmp = a.titulo.localeCompare(b.titulo);
      else if (sortBy === "completude") cmp = a.completude - b.completude;
      else cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [
    briefings,
    filtroTipo,
    filtroStatus,
    filtroAgencia,
    filtroRodada,
    filtroProjeto,
    escopo,
    busca,
    user?.id,
    membrosPorBriefing,
    sortBy,
    sortAsc,
  ]);

  const naoLidoFn = (b: BriefingRow): boolean => {
    if (!user?.id) return false;
    if (b.user_id === user.id) return false;
    const membros = membrosPorBriefing.get(b.id) ?? [];
    const eu = membros.find((m) => m.user_id === user.id);
    if (!eu?.last_read_at) return true;
    return new Date(b.updated_at).getTime() > new Date(eu.last_read_at).getTime();
  };

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc((v) => !v);
    else {
      setSortBy(key);
      setSortAsc(key === "titulo");
    }
  };

  const criar = async () => {
    if (!titulo.trim()) {
      toast.error("Informe um título");
      return;
    }
    if (!tipoSel) {
      toast.error("Selecione um tipo de briefing");
      return;
    }
    setCreating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("Sessão expirada");
        return;
      }
      const { data: tpl } = await supabase
        .from("briefing_templates")
        .select("id")
        .eq("tipo", tipoSel)
        .eq("ativo", true)
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: novo, error } = await supabase
        .from("briefings")
        .insert({
          user_id: userData.user.id,
          tipo: tipoSel,
          titulo: titulo.trim(),
          template_id: tpl?.id ?? null,
          status: "rascunho",
          payload: {},
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Briefing criado");
      setOpenNew(false);
      navigate(`/dashboard/briefings/${novo.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar");
    } finally {
      setCreating(false);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="w-full px-6 py-6 space-y-6 min-h-[calc(100vh-4rem)] flex flex-col" style={bgStyle}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Briefings</h1>
              <p className="text-muted-foreground mt-1">
                Crie briefings profissionais com apoio de um agente de IA.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BgColorButton />
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" /> Novo briefing
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Novo briefing</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {loadingTipos ? (
                    <div className="grid grid-cols-2 gap-3">
                      <Skeleton className="h-24 rounded-lg" />
                      <Skeleton className="h-24 rounded-lg" />
                      <Skeleton className="h-24 rounded-lg" />
                    </div>
                  ) : !tipos || tipos.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Nenhum tipo de briefing disponível. Contate o administrador.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {tipos.map((t) => {
                        const Icon = ICON_POR_TIPO[t.tipo] ?? ICON_FALLBACK;
                        const sel = tipoSel === t.tipo;
                        return (
                          <button
                            key={t.tipo}
                            type="button"
                            onClick={() => setTipoSel(t.tipo)}
                            className={`text-left rounded-lg border p-4 transition ${
                              sel
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-muted/50"
                            }`}
                          >
                            <Icon className="h-5 w-5 mb-2 text-primary" />
                            <div className="font-medium">{t.nome}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {t.descricao ?? ""}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="titulo">Título</Label>
                    <Input
                      id="titulo"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder="Ex.: Lançamento Linha Verão 2026"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenNew(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={criar} disabled={creating || !tipoSel}>
                    {creating ? "Criando..." : "Criar e abrir"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 flex-1 min-h-0">
          {/* Sidebar de tipos */}
          <aside className="space-y-4">
            <div className="space-y-1">
              <div className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Escopo
              </div>
              {(
                [
                  { v: "todos", l: "Todos" },
                  { v: "meus", l: "Meus" },
                  { v: "compartilhados", l: "Compartilhados comigo" },
                ] as Array<{ v: EscopoFiltro; l: string }>
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setEscopo(opt.v)}
                  className={`w-full text-left rounded-md px-3 py-2 text-sm transition ${
                    escopo === opt.v
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <div className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Categorias
              </div>
              <button
                type="button"
                onClick={() => setFiltroTipo("__todos")}
                className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-sm transition ${
                  filtroTipo === "__todos"
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted text-foreground"
                }`}
              >
                <span className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Todos
                </span>
                <span className="text-xs text-muted-foreground">{briefings.length}</span>
              </button>
              {(tipos ?? []).map((t) => {
                const Icon = ICON_POR_TIPO[t.tipo] ?? ICON_FALLBACK;
                const sel = filtroTipo === t.tipo;
                const count = contagemPorTipo.get(t.tipo) ?? 0;
                return (
                  <button
                    key={t.tipo}
                    type="button"
                    onClick={() => setFiltroTipo(t.tipo)}
                    className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-sm transition ${
                      sel
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{t.nome}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{count}</span>
                  </button>
                );
              })}
            </div>

            {canConfigure && (
              <div className="space-y-1 pt-2 border-t border-border/60">
                <div className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Configurações
                </div>
                <Link
                  to="/admin/briefings-fluxos"
                  className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition hover:bg-muted text-foreground"
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  <span className="truncate">Fluxos de aprovação</span>
                </Link>
              </div>
            )}
          </aside>


          {/* Tabela */}
          <section className="space-y-4 min-w-0 flex flex-col min-h-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative max-w-sm flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por título..."
                  className="pl-9"
                />
              </div>

              <Select
                value={filtroStatus}
                onValueChange={(v) => setFiltroStatus(v as StatusFiltro)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="final">Final</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filtroAgencia}
                onValueChange={(v) => setFiltroAgencia(v as AgenciaFiltro)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Agência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Toda a agência</SelectItem>
                  <SelectItem value="nao_enviado">Não enviado</SelectItem>
                  <SelectItem value="pendente">Enviado / Pendente</SelectItem>
                  <SelectItem value="em_revisao">Em revisão</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="rejeitado">Rejeitado</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filtroRodada}
                onValueChange={(v) => setFiltroRodada(v as RodadaFiltro)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Rodada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas rodadas</SelectItem>
                  <SelectItem value="1">Rodada 1</SelectItem>
                  <SelectItem value="2">Rodada 2</SelectItem>
                  <SelectItem value="3+">Rodada 3+</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filtroProjeto} onValueChange={setFiltroProjeto}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Projeto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos">Todos os projetos</SelectItem>
                  {projetosFiltro.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="text-muted-foreground">Carregando...</div>
            ) : filtrados.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center space-y-3">
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {briefings.length === 0
                      ? "Você ainda não tem briefings. Crie o primeiro."
                      : escopo === "compartilhados"
                        ? "Nenhum briefing foi compartilhado com você ainda."
                        : "Nenhum briefing encontrado para este filtro."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-lg border bg-card overflow-auto flex-1 min-h-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="min-w-[260px]">
                        <button
                          type="button"
                          onClick={() => toggleSort("titulo")}
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          Título
                          <ArrowUpDown className="h-3 w-3 opacity-60" />
                        </button>
                      </TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Agência</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Equipe</TableHead>
                      <TableHead>Projeto / Tarefa</TableHead>
                      <TableHead className="w-[140px]">
                        <button
                          type="button"
                          onClick={() => toggleSort("completude")}
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          Progresso
                          <ArrowUpDown className="h-3 w-3 opacity-60" />
                        </button>
                      </TableHead>
                      <TableHead className="text-right">
                        <button
                          type="button"
                          onClick={() => toggleSort("updated_at")}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          Atualizado
                          <ArrowUpDown className="h-3 w-3 opacity-60" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[40px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtrados.map((b) => {
                      const Icon = ICON_POR_TIPO[b.tipo] ?? ICON_FALLBACK;
                      const nomeTipo =
                        tipos?.find((t) => t.tipo === b.tipo)?.nome ?? b.tipo;
                      const responsavel = profileMap.get(b.user_id);
                      const membros = membrosPorBriefing.get(b.id) ?? [];
                      const membrosVisiveis = membros
                        .filter((m) => m.user_id !== b.user_id)
                        .slice(0, 3);
                      const restoMembros = Math.max(
                        0,
                        membros.filter((m) => m.user_id !== b.user_id).length -
                          membrosVisiveis.length,
                      );
                      const projetoNome = b.projeto_id
                        ? projetosMap.get(b.projeto_id)
                        : null;
                      const tarefaNome = b.tarefa_id
                        ? tarefasMap.get(b.tarefa_id)
                        : null;
                      const naoLido = naoLidoFn(b);
                      const agenciaKey: AgenciaFiltro = b.rrtask_page_id
                        ? normalizeAprovacao(b.rrtask_aprovacao)
                        : "nao_enviado";
                      const rodada = b.rrtask_round ?? 1;
                      const agenciaTooltip = b.rrtask_page_id
                        ? [
                            `Aprovação: ${b.rrtask_aprovacao ?? "Pendente"}`,
                            b.rrtask_status ? `Status: ${b.rrtask_status}` : null,
                            b.rrtask_etapa ? `Etapa: ${b.rrtask_etapa}` : null,
                            b.rrtask_synced_at
                              ? `Sincronizado em ${new Date(b.rrtask_synced_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join("\n")
                        : "Briefing ainda não enviado à agência";

                      return (
                        <TableRow
                          key={b.id}
                          className={`cursor-pointer ${agenciaKey === "em_revisao" ? "border-l-2 border-amber-500/60" : agenciaKey === "rejeitado" ? "border-l-2 border-destructive/60" : agenciaKey === "aprovado" ? "border-l-2 border-emerald-500/60" : ""}`}
                          onClick={() => navigate(`/dashboard/briefings/${b.id}`)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                <Icon className="h-4 w-4 text-primary" />
                                {naoLido && (
                                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" />
                                )}
                              </div>
                              <span className="font-medium truncate">{b.titulo}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground capitalize">
                            {nomeTipo}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={STATUS_VARIANT[b.status] ?? "outline"}
                            >
                              {STATUS_LABEL[b.status] ?? b.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell title={agenciaTooltip}>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${agenciaBadgeClass(agenciaKey)}`}
                              >
                                {AGENCIA_LABEL[agenciaKey]}
                              </span>
                              {b.rrtask_page_id && (
                                <span className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                  R{rodada}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={responsavel?.avatar_url ?? undefined} />
                                <AvatarFallback className="text-[10px]">
                                  {iniciais(responsavel?.nome)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm truncate">
                                {responsavel?.nome ?? "—"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMembrosDialogId(b.id);
                              }}
                              className="flex items-center -space-x-2 hover:opacity-80"
                              title="Gerenciar equipe"
                            >
                              {membrosVisiveis.length === 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground border rounded-full px-2 py-1 hover:bg-muted">
                                  <Users className="h-3 w-3" />
                                  Marcar usuários
                                </span>
                              ) : (
                                <>
                                  {membrosVisiveis.map((m) => {
                                    const p = profileMap.get(m.user_id);
                                    return (
                                      <Tooltip key={m.user_id}>
                                        <TooltipTrigger asChild>
                                          <Avatar className="h-7 w-7 ring-2 ring-card">
                                            <AvatarImage
                                              src={p?.avatar_url ?? undefined}
                                            />
                                            <AvatarFallback className="text-[10px]">
                                              {iniciais(p?.nome)}
                                            </AvatarFallback>
                                          </Avatar>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {p?.nome ?? m.user_id.slice(0, 8)}
                                        </TooltipContent>
                                      </Tooltip>
                                    );
                                  })}
                                  {restoMembros > 0 && (
                                    <span className="h-7 min-w-7 px-1.5 rounded-full bg-muted ring-2 ring-card text-[10px] font-medium flex items-center justify-center">
                                      +{restoMembros}
                                    </span>
                                  )}
                                </>
                              )}
                            </button>
                          </TableCell>
                          <TableCell>
                            {projetoNome ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVincDialog({
                                    id: b.id,
                                    projetoId: b.projeto_id,
                                    tarefaId: b.tarefa_id,
                                  });
                                }}
                                className="text-left min-w-0 max-w-[220px] hover:opacity-80"
                              >
                                <div className="flex items-center gap-1.5 text-sm truncate">
                                  <FolderKanban className="h-3.5 w-3.5 text-primary shrink-0" />
                                  <span className="truncate">{projetoNome}</span>
                                </div>
                                {tarefaNome && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate mt-0.5">
                                    <ListChecks className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{tarefaNome}</span>
                                  </div>
                                )}
                              </button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVincDialog({
                                    id: b.id,
                                    projetoId: null,
                                    tarefaId: null,
                                  });
                                }}
                              >
                                <Link2 className="h-3 w-3 mr-1" />
                                Vincular
                              </Button>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary transition-all"
                                  style={{ width: `${b.completude}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-10 text-right">
                                {b.completude}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(b.updated_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    navigate(`/dashboard/briefings/${b.id}`)
                                  }
                                >
                                  Abrir
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setMembrosDialogId(b.id)}
                                >
                                  <Users className="h-3.5 w-3.5 mr-2" />
                                  Gerenciar equipe
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setVincDialog({
                                      id: b.id,
                                      projetoId: b.projeto_id,
                                      tarefaId: b.tarefa_id,
                                    })
                                  }
                                >
                                  <Link2 className="h-3.5 w-3.5 mr-2" />
                                  Vincular projeto/tarefa
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {b.status === "arquivado" ? (
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      const { error } = await supabase
                                        .from("briefings")
                                        .update({ status: "em_andamento" })
                                        .eq("id", b.id);
                                      if (error) toast.error("Erro ao reativar");
                                      else toast.success("Briefing reativado");
                                    }}
                                  >
                                    <ArchiveRestore className="h-3.5 w-3.5 mr-2" />
                                    Reativar
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      const { error } = await supabase
                                        .from("briefings")
                                        .update({ status: "arquivado" })
                                        .eq("id", b.id);
                                      if (error) toast.error("Erro ao inativar");
                                      else toast.success("Briefing inativado");
                                    }}
                                  >
                                    <Archive className="h-3.5 w-3.5 mr-2" />
                                    Inativar
                                  </DropdownMenuItem>
                                )}
                                {isAdmin && (
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() =>
                                      setExcluirDialog({ id: b.id, titulo: b.titulo })
                                    }
                                  >
                                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </div>

        {membrosDialogId && (
          <BriefingMembrosDialog
            open={!!membrosDialogId}
            onOpenChange={(o) => !o && setMembrosDialogId(null)}
            briefingId={membrosDialogId}
          />
        )}

        {vincDialog && (
          <VincularProjetoDialog
            open={!!vincDialog}
            onOpenChange={(o) => !o && setVincDialog(null)}
            briefingId={vincDialog.id}
            projetoIdAtual={vincDialog.projetoId}
            tarefaIdAtual={vincDialog.tarefaId}
            onVinculado={() => {
              queryClient.invalidateQueries({ queryKey: ["briefings_home_lista"] });
              setVincDialog(null);
            }}
          />
        )}

        <AlertDialog
          open={!!excluirDialog}
          onOpenChange={(o) => !o && setExcluirDialog(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir briefing</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação é permanente e não pode ser desfeita. O briefing
                {excluirDialog ? ` "${excluirDialog.titulo}"` : ""}, suas mensagens,
                comentários e vínculos serão removidos. Para remover apenas da
                listagem ativa, use Inativar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  if (!excluirDialog) return;
                  const { error } = await supabase
                    .from("briefings")
                    .delete()
                    .eq("id", excluirDialog.id);
                  if (error) {
                    toast.error(error.message || "Erro ao excluir");
                  } else {
                    toast.success("Briefing excluído");
                    queryClient.invalidateQueries({
                      queryKey: ["briefings_home_lista"],
                    });
                  }
                  setExcluirDialog(null);
                }}
              >
                Excluir definitivamente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
