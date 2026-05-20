import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, FileText, Megaphone, Sparkles, Package, Store } from "lucide-react";
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
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Tipo = "marketing" | "criativo" | "produto" | "trade";

const TIPOS: Array<{
  tipo: Tipo;
  nome: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { tipo: "marketing", nome: "Marketing", desc: "Campanhas, objetivos de negócio, KPIs", icon: Megaphone },
  { tipo: "criativo", nome: "Criativo", desc: "Conceito, moodboard, referências visuais", icon: Sparkles },
  { tipo: "produto", nome: "Produto / Fábrica", desc: "Conceito, regulatório, custo-alvo", icon: Package },
  { tipo: "trade", nome: "Trade Marketing", desc: "PDV, sell-out, incentivo", icon: Store },
];

interface BriefingRow {
  id: string;
  tipo: Tipo;
  titulo: string;
  status: string;
  completude: number;
  updated_at: string;
}

export default function BriefingsHome() {
  const navigate = useNavigate();
  const [briefings, setBriefings] = useState<BriefingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tipoSel, setTipoSel] = useState<Tipo>("marketing");
  const [titulo, setTitulo] = useState("");

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
              <div className="grid grid-cols-2 gap-3">
                {TIPOS.map((t) => {
                  const Icon = t.icon;
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
                      <div className="text-xs text-muted-foreground mt-1">{t.desc}</div>
                    </button>
                  );
                })}
              </div>
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
              <Button onClick={criar} disabled={creating}>
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
            const meta = TIPOS.find((t) => t.tipo === b.tipo);
            const Icon = meta?.icon ?? FileText;
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
                  <div className="text-xs text-muted-foreground capitalize">{meta?.nome}</div>
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
