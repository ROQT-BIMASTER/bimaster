import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Search, ArrowLeft, Loader2, ChevronRight, Plus, AlertTriangle } from "lucide-react";
import { useState, useMemo } from "react";
import { PRODUCT_STATUS_LABELS } from "@/hooks/useProdutoBrasil";
import { useCreateProdutoBrasil } from "@/hooks/useProdutoBrasil";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function ProdutosBrasilListagem() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ china_nome: "", china_codigo: "", china_ean: "", china_categoria: "", china_descricao: "" });
  const createProduto = useCreateProdutoBrasil();

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["produtos-brasil-list"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("produtos_brasil" as any)
        .select("*")
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (!search) return produtos;
    const s = search.toLowerCase();
    return produtos.filter((p: any) =>
      p.china_nome?.toLowerCase().includes(s) ||
      p.china_codigo?.toLowerCase().includes(s) ||
      p.nome_brasil?.toLowerCase().includes(s) ||
      p.codigo_brasil?.toLowerCase().includes(s)
    );
  }, [produtos, search]);

  const statusBadgeVariant = (status: string) => {
    const map: Record<string, "secondary" | "default" | "destructive" | "outline"> = {
      produto_importado: "secondary",
      aguardando_precadastro: "outline",
      precadastro_em_andamento: "default",
      aguardando_regulatorio: "outline",
      aprovado_cadastro: "default",
      produto_ativo: "default",
    };
    return map[status] || "secondary";
  };

  const handleCreate = () => {
    if (!form.china_nome && !form.china_codigo) {
      toast.error("Informe ao menos o nome ou código do produto.");
      return;
    }
    createProduto.mutate(
      {
        china_nome: form.china_nome || null,
        china_codigo: form.china_codigo || "SEM-CODIGO",
        china_ean: form.china_ean || undefined,
        china_categoria: form.china_categoria || undefined,
        china_descricao: form.china_descricao || undefined,
      },
      {
        onSuccess: (produto) => {
          toast.success("Produto criado com sucesso!");
          setDialogOpen(false);
          setForm({ china_nome: "", china_codigo: "", china_ean: "", china_categoria: "", china_descricao: "" });
          navigate(`/dashboard/projetos/produto-brasil/${produto.id}`);
        },
      }
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Package className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">Cadastro Brasil</h1>
          <p className="text-sm text-muted-foreground">Produtos importados em processo de onboarding</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Produto — Pré-Cadastro</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Nome do Produto (China)</Label>
                <Input value={form.china_nome} onChange={(e) => setForm({ ...form, china_nome: e.target.value })} placeholder="Nome original" />
              </div>
              <div>
                <Label className="text-xs">Código (China)</Label>
                <Input value={form.china_codigo} onChange={(e) => setForm({ ...form, china_codigo: e.target.value })} placeholder="Código original" />
              </div>
              <div>
                <Label className="text-xs">EAN</Label>
                <Input value={form.china_ean} onChange={(e) => setForm({ ...form, china_ean: e.target.value })} placeholder="Opcional" />
              </div>
              <div>
                <Label className="text-xs">Categoria</Label>
                <Input value={form.china_categoria} onChange={(e) => setForm({ ...form, china_categoria: e.target.value })} placeholder="Opcional" />
              </div>
              <div>
                <Label className="text-xs">Descrição</Label>
                <Input value={form.china_descricao} onChange={(e) => setForm({ ...form, china_descricao: e.target.value })} placeholder="Opcional" />
              </div>
              <p className="text-xs text-muted-foreground">
                O produto será criado em <strong>Pré-Cadastro</strong>. A vinculação a um Projeto poderá ser feita depois.
              </p>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button onClick={handleCreate} disabled={createProduto.isPending}>
                {createProduto.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Criar Produto
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou código..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Nenhum produto encontrado. Clique em "Novo Produto" para iniciar um pré-cadastro.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p: any) => (
            <Card
              key={p.id}
              className="cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => navigate(`/dashboard/projetos/produto-brasil/${p.id}`)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-primary">{p.china_codigo}</span>
                    {p.nome_brasil && (
                      <span className="text-xs text-muted-foreground">→ {p.codigo_brasil || "sem código BR"}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">
                    {p.nome_brasil || p.china_nome || "Sem nome"}
                  </p>
                </div>
                {!p.projeto_id && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="shrink-0">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Sem projeto vinculado</TooltipContent>
                  </Tooltip>
                )}
                <Badge variant={statusBadgeVariant(p.status)} className="text-[10px] shrink-0">
                  {PRODUCT_STATUS_LABELS[p.status] || p.status}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
