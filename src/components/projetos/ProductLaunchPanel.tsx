import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import ProductThumbnail from "@/components/fabrica/ProductThumbnail";
import { ProdutoAcabado } from "@/hooks/useProjetoTarefaDetalhe";
import { cn } from "@/lib/utils";
import {
  Package, CheckCircle2, Circle, FileText, Palette, Tag,
  ClipboardList, FlaskConical, Award, UserCheck, Search, Link2, X,
  Eye, ChevronDown, ChevronUp, CornerDownRight
} from "lucide-react";

interface ChecklistItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  done: boolean;
}

interface ProductLaunchPanelProps {
  linkedProduto: ProdutoAcabado | null;
  cofreDocs: any[];
  metas: any[];
  searchProdutos: (query?: string) => Promise<ProdutoAcabado[]>;
  onLinkProduto: (produtoId: string) => void;
}

const CHECKLIST_CONFIG = [
  { key: "briefing", label: "Briefing", icon: <FileText className="h-3.5 w-3.5" /> },
  { key: "arte_final", label: "Arte Final", icon: <Palette className="h-3.5 w-3.5" /> },
  { key: "rotulo", label: "Rótulo", icon: <Tag className="h-3.5 w-3.5" /> },
  { key: "ficha_tecnica", label: "Ficha Técnica", icon: <ClipboardList className="h-3.5 w-3.5" /> },
  { key: "laudo", label: "Laudo", icon: <FlaskConical className="h-3.5 w-3.5" /> },
  { key: "certificado", label: "Certificado", icon: <Award className="h-3.5 w-3.5" /> },
  { key: "aprovacao_cliente", label: "Aprovação Cliente", icon: <UserCheck className="h-3.5 w-3.5" /> },
];

export function ProductLaunchPanel({ linkedProduto, cofreDocs, metas, searchProdutos, onLinkProduto }: ProductLaunchPanelProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<ProdutoAcabado[]>([]);
  const [searching, setSearching] = useState(false);
  const [showFilhos, setShowFilhos] = useState(false);

  const checklist = useMemo<ChecklistItem[]>(() => {
    const cofreCategorias = new Set(cofreDocs.map((d: any) => d.categoria));
    const hasAprovacao = metas.some(
      m => m.concluida && m.descricao?.toLowerCase().includes("aprovação")
    );

    return CHECKLIST_CONFIG.map(item => ({
      ...item,
      done: item.key === "aprovacao_cliente"
        ? hasAprovacao
        : cofreCategorias.has(item.key),
    }));
  }, [cofreDocs, metas]);

  const completedCount = checklist.filter(c => c.done).length;
  const progressPercent = Math.round((completedCount / checklist.length) * 100);

  const progressColor = progressPercent >= 70
    ? "bg-emerald-500"
    : progressPercent >= 30
      ? "bg-amber-500"
      : "bg-red-500";

  const handleOpenSearch = async () => {
    setShowSearch(true);
    setSearching(true);
    const r = await searchProdutos();
    setResults(r);
    setSearching(false);
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    setSearching(true);
    const r = await searchProdutos(q || undefined);
    setResults(r);
    setSearching(false);
  };

  const handleSelect = (produto: ProdutoAcabado) => {
    onLinkProduto(produto.id);
    setShowSearch(false);
    setSearchQuery("");
    setResults([]);
  };

  return (
    <div className="w-[280px] flex-shrink-0 border-r border-border/50 overflow-y-auto p-4 space-y-4">
      {/* Product Card */}
      <Card className="shadow-none border-border/50">
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Produto Vinculado
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {linkedProduto ? (
            <div className="flex flex-col items-center text-center gap-3">
              <ProductThumbnail
                src={linkedProduto.foto_url}
                alt={linkedProduto.nome}
                size="xl"
              />
              <div className="space-y-1">
                <Badge variant="outline" className="text-[10px] font-mono px-2">
                  {linkedProduto.codigo}
                </Badge>
                <p className="text-sm font-medium leading-tight">{linkedProduto.nome}</p>
                {(linkedProduto.marca || linkedProduto.linha) && (
                  <p className="text-[11px] text-muted-foreground">
                    {[linkedProduto.marca, linkedProduto.linha].filter(Boolean).join(" · ")}
                  </p>
                )}
                {linkedProduto.tipo && (
                  <Badge className="text-[9px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-0">
                    {linkedProduto.tipo}
                  </Badge>
                )}
              </div>

              {/* Display filhos */}
              {linkedProduto.tipo === "DISPLAY" && linkedProduto.filhos && linkedProduto.filhos.length > 0 && (
                <div className="w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-[11px] h-7 gap-1.5 justify-between"
                    onClick={() => setShowFilhos(!showFilhos)}
                  >
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      Grade ({linkedProduto.filhos.length} itens)
                    </span>
                    {showFilhos ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                  {showFilhos && (
                    <div className="mt-2 space-y-1.5">
                      {linkedProduto.filhos.map(filho => (
                        <div key={filho.id} className="flex items-center gap-2 p-1.5 rounded-md bg-muted/30 border border-border/30">
                          <CornerDownRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <ProductThumbnail src={filho.foto_url} alt={filho.nome} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium truncate">{filho.nome}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{filho.codigo}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="text-[11px] h-7 text-muted-foreground gap-1"
                onClick={handleOpenSearch}
              >
                <Link2 className="h-3 w-3" />
                Trocar produto
              </Button>
            </div>
          ) : (
            <div className="text-center py-4">
              <Package className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground mb-3">Nenhum produto vinculado</p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={handleOpenSearch}
              >
                <Link2 className="h-3.5 w-3.5" />
                Vincular produto
              </Button>
            </div>
          )}

          {/* Product Search Dropdown */}
          {showSearch && (
            <div className="mt-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Buscar por nome ou código..."
                  className="h-8 text-xs pl-7 pr-7"
                  autoFocus
                />
                <button
                  onClick={() => { setShowSearch(false); setSearchQuery(""); setResults([]); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-1">
                  {searching && (
                    <p className="text-[11px] text-muted-foreground text-center py-3">Buscando...</p>
                  )}
                  {!searching && results.length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center py-3">Nenhum produto encontrado.</p>
                  )}
                  {!searching && results.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelect(p)}
                      className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                    >
                      <ProductThumbnail src={p.foto_url} alt={p.nome} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium truncate">{p.nome}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{p.codigo}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pre-Launch Checklist */}
      <Card className="shadow-none border-border/50">
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Checklist Pré-Lançamento
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="space-y-2">
            {checklist.map(item => (
              <div key={item.key} className="flex items-center gap-2">
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                )}
                <span className={cn(
                  "text-xs flex items-center gap-1.5",
                  item.done ? "text-foreground" : "text-muted-foreground"
                )}>
                  {item.icon}
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          <Separator />

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground font-medium">Progresso</span>
              <span className={cn(
                "text-xs font-bold",
                progressPercent >= 70 ? "text-emerald-500" : progressPercent >= 30 ? "text-amber-500" : "text-red-500"
              )}>
                {progressPercent}%
              </span>
            </div>
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={cn("h-full transition-all duration-500 ease-out rounded-full", progressColor)}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              {completedCount} de {checklist.length} etapas concluídas
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
