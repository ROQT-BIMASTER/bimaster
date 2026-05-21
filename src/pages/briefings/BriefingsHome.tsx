import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
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
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePageBgColor } from "@/components/shared/PageBgCustomizer";

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
  concluido: "default",
};

export default function BriefingsHome() {
  const navigate = useNavigate();
  const { bgStyle, BgColorButton } = usePageBgColor("briefings_home");
  const [briefings, setBriefings] = useState<BriefingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tipoSel, setTipoSel] = useState<Tipo>("");
  const [titulo, setTitulo] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("__todos");
  const [busca, setBusca] = useState("");

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

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("briefings")
        .select("id, tipo, titulo, status, completude, updated_at")
        .order("updated_at", { ascending: false });
      if (error) toast.error("Erro ao carregar briefings");
      setBriefings((data ?? []) as BriefingRow[]);
      setLoading(false);
    })();
  }, []);

  const contagemPorTipo = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of briefings) m.set(b.tipo, (m.get(b.tipo) ?? 0) + 1);
    return m;
  }, [briefings]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return briefings.filter((b) => {
      if (filtroTipo !== "__todos" && b.tipo !== filtroTipo) return false;
      if (q && !b.titulo.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [briefings, filtroTipo, busca]);

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
    <div className="w-full px-6 py-8 space-y-6 min-h-screen" style={bgStyle}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/dashboard"))}
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


      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        {/* Sidebar de tipos */}
        <aside className="space-y-1">
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
        </aside>

        {/* Tabela */}
        <section className="space-y-4 min-w-0">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título..."
              className="pl-9"
            />
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
                    : "Nenhum briefing encontrado para este filtro."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[45%]">Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[180px]">Progresso</TableHead>
                    <TableHead className="text-right">Atualizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((b) => {
                    const Icon = ICON_POR_TIPO[b.tipo] ?? ICON_FALLBACK;
                    const nomeTipo =
                      tipos?.find((t) => t.tipo === b.tipo)?.nome ?? b.tipo;
                    return (
                      <TableRow
                        key={b.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/dashboard/briefings/${b.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                              <Icon className="h-4 w-4 text-primary" />
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
                            className="capitalize"
                          >
                            {b.status.replace("_", " ")}
                          </Badge>
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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
