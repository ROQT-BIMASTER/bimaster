import { useEffect, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Tipo = string;

const ICON_POR_TIPO: Record<string, React.ComponentType<{ className?: string }>> = {
  // 4 legados
  marketing: Megaphone,
  criativo: Sparkles,
  produto: Package,
  trade: Store,
  // 8 canônicos v2
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

export default function BriefingsHome() {
  const navigate = useNavigate();
  const [briefings, setBriefings] = useState<BriefingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tipoSel, setTipoSel] = useState<Tipo>("");
  const [titulo, setTitulo] = useState("");

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
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Briefings</h1>
          <p className="text-muted-foreground mt-1">
            Crie briefings profissionais com apoio de um agente de IA.
          </p>
        </div>
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

      {loading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : briefings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">
              Você ainda não tem briefings. Crie o primeiro.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {briefings.map((b) => {
            const Icon = ICON_POR_TIPO[b.tipo] ?? ICON_FALLBACK;
            const nomeTipo = tipos?.find((t) => t.tipo === b.tipo)?.nome ?? b.tipo;
            return (
              <Card
                key={b.id}
                className="cursor-pointer hover:border-primary/40 transition"
                onClick={() => navigate(`/dashboard/briefings/${b.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <Icon className="h-5 w-5 text-primary mt-0.5" />
                    <Badge variant="outline" className="capitalize">
                      {b.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <CardTitle className="text-base line-clamp-2">{b.titulo}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xs text-muted-foreground capitalize">{nomeTipo}</div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${b.completude}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{b.completude}% completo</span>
                    <span>
                      {formatDistanceToNow(new Date(b.updated_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
