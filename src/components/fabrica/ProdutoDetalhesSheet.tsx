import React, { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import ProductThumbnail from "@/components/fabrica/ProductThumbnail";
import { NovoProdutoAcabadoDialog } from "@/components/fabrica/NovoProdutoAcabadoDialog";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Package, DollarSign, FlaskConical, ExternalLink, Barcode,
  Tag, Globe, Clock, Layers, Focus, CheckCircle2, XCircle, Pencil,
} from "lucide-react";

interface ProdutoDetalhesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtoId: string;
}

interface ProdutoData {
  id: string;
  nome: string;
  codigo: string;
  marca: string | null;
  linha: string | null;
  origem: string | null;
  ncm: string | null;
  processo_anvisa: string | null;
  lead_time_dias: number | null;
  itens_display: number | null;
  ativo: boolean;
  modo_foco: boolean;
  foto_url: string | null;
}

interface CustoConfigData {
  custo_mao_obra_nf: number;
  custo_mao_obra_servico: number;
  percentual_markup: number;
}

interface InsumoFormula {
  id: string;
  nome: string;
  codigo: string;
  custo_nf: number;
  custo_servico: number;
}

export function ProdutoDetalhesSheet({ open, onOpenChange, produtoId }: ProdutoDetalhesSheetProps) {
  const navigate = useNavigate();
  const [produto, setProduto] = useState<ProdutoData | null>(null);
  const [custoConfig, setCustoConfig] = useState<CustoConfigData | null>(null);
  const [insumos, setInsumos] = useState<InsumoFormula[]>([]);
  const [custoTotal, setCustoTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [fullProdutoData, setFullProdutoData] = useState<any>(null);

  useEffect(() => {
    if (!open || !produtoId) return;
    setLoading(true);

    const fetchData = async () => {
      // Fetch display data + full product data for edit dialog
      const [prodRes, fullProdRes, configRes, insumosRes] = await Promise.all([
        supabase.from("fabrica_produtos").select("id, nome, codigo, marca, linha, origem, ncm, processo_anvisa, lead_time_dias, itens_display, ativo, modo_foco, foto_url").eq("id", produtoId).single(),
        supabase.from("fabrica_produtos").select("*").eq("id", produtoId).single(),
        supabase.from("fabrica_produto_custos_config").select("custo_mao_obra_nf, custo_mao_obra_servico, percentual_markup").eq("produto_id", produtoId).maybeSingle(),
        supabase.from("fabrica_produto_custos").select("id, nome, codigo, custo_nf, custo_servico").eq("produto_id", produtoId).order("ordem"),
      ]);

      if (prodRes.data) setProduto(prodRes.data as unknown as ProdutoData);
      if (fullProdRes.data) setFullProdutoData(fullProdRes.data);
      if (configRes.data) setCustoConfig(configRes.data as CustoConfigData);
      
      const ins = (insumosRes.data || []) as InsumoFormula[];
      setInsumos(ins);

      // Calculate total cost
      if (ins.length > 0 || configRes.data) {
        const totalNF = ins.reduce((s, i) => s + (Number(i.custo_nf) || 0), 0) + (Number(configRes.data?.custo_mao_obra_nf) || 0);
        const totalServico = ins.reduce((s, i) => s + (Number(i.custo_servico) || 0), 0) + (Number(configRes.data?.custo_mao_obra_servico) || 0);
        const subtotal = totalNF + totalServico;
        const markup = subtotal * ((Number(configRes.data?.percentual_markup) || 0) / 100);
        setCustoTotal(subtotal + markup);
      }

      setLoading(false);
    };

    fetchData();
  }, [open, produtoId]);

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const goToEdit = () => {
    if (fullProdutoData) {
      setEditDialogOpen(true);
    }
  };

  const DetailRow = ({ icon: Icon, label, value, editable = true }: { icon: React.ElementType; label: string; value: React.ReactNode; editable?: boolean }) => (
    <button
      onClick={editable ? goToEdit : undefined}
      className={`flex items-start gap-2.5 py-1.5 w-full text-left rounded-md px-1 -mx-1 transition-colors ${editable ? "hover:bg-muted/50 cursor-pointer group" : ""}`}
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <div className="text-sm font-medium truncate">{value || "—"}</div>
      </div>
      {editable && (
        <Pencil className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors mt-1 shrink-0" />
      )}
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:max-w-[420px] p-0 flex flex-col">
        <SheetHeader className="p-4 pb-0">
          <SheetTitle className="text-base">Detalhes do Produto</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 pb-4">
          {loading ? (
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-16 w-16 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : produto ? (
            <div className="space-y-4 pt-4">
              {/* Product header */}
              <div className="flex items-start gap-3">
                <ProductThumbnail src={produto.foto_url} alt={produto.nome} size="lg" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm leading-tight">{produto.nome}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{produto.codigo}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Badge variant={produto.ativo ? "success" : "destructive"} className="text-[10px] py-0 gap-1">
                      {produto.ativo ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                      {produto.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                    {produto.modo_foco && (
                      <Badge variant="warning" className="text-[10px] py-0 gap-1">
                        <Focus className="h-2.5 w-2.5" /> Foco
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Cost highlight */}
              {custoTotal !== null && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Custo Total Estimado</p>
                      <p className="text-lg font-bold text-primary">{formatCurrency(custoTotal)}</p>
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              {/* Details grid */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Informações</h4>
                <DetailRow icon={Tag} label="Marca" value={produto.marca} />
                <DetailRow icon={Tag} label="Linha" value={produto.linha} />
                <DetailRow icon={Globe} label="Origem" value={produto.origem} />
                <DetailRow icon={Barcode} label="NCM" value={produto.ncm} />
                <DetailRow icon={Barcode} label="Anvisa" value={produto.processo_anvisa} />
                <DetailRow icon={Clock} label="Lead Time" value={produto.lead_time_dias ? `${produto.lead_time_dias} dias` : null} />
                <DetailRow icon={Layers} label="Itens/Display" value={produto.itens_display} />
              </div>

              {/* Raw materials */}
              {insumos.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      <FlaskConical className="h-3 w-3 inline mr-1" />
                      Insumos ({insumos.length})
                    </h4>
                    <div className="space-y-1">
                      {insumos.map(i => (
                        <div key={i.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/30 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant="outline" className="text-[9px] py-0 px-1 shrink-0">{i.codigo}</Badge>
                            <span className="truncate">{i.nome}</span>
                          </div>
                          <span className="text-muted-foreground shrink-0 ml-2">
                            {formatCurrency((Number(i.custo_nf) || 0) + (Number(i.custo_servico) || 0))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Actions */}
              <Separator />
              <div className="space-y-2 pb-4">
                <Button
                  className="w-full"
                  variant="default"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/dashboard/fabrica/produtos/${produtoId}/custos`);
                  }}
                >
                  <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                  Ver Ficha de Custos
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  size="sm"
                  onClick={goToEdit}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Editar Produto
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-10 w-10 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Produto não encontrado</p>
            </div>
          )}
        </ScrollArea>
      </SheetContent>

      <NovoProdutoAcabadoDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        produtoEdit={fullProdutoData}
        onSuccess={() => {
          setEditDialogOpen(false);
          // Reload product data
          setLoading(true);
          supabase.from("fabrica_produtos").select("id, nome, codigo, marca, linha, origem, ncm, processo_anvisa, lead_time_dias, itens_display, ativo, modo_foco, foto_url").eq("id", produtoId).single().then(({ data }) => {
            if (data) setProduto(data as unknown as ProdutoData);
            setLoading(false);
          });
        }}
      />
    </Sheet>
  );
}
