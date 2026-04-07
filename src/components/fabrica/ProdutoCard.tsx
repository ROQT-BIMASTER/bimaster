import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ProductThumbnail from "@/components/fabrica/ProductThumbnail";
import { DollarSign, Edit, Trash2, TrendingUp, Clock, Package, Barcode, Layers, User } from "lucide-react";
import { ComposicaoGradeCard } from "@/components/fabrica/ComposicaoGradeCard";
import { DisplayGradePopover } from "@/components/fabrica/DisplayGradePopover";
import { StatusAprovacaoBadge } from "@/components/fabrica/FichaAprovacaoBanner";
import type { StatusAprovacao } from "@/hooks/useFichaRevisao";
import { formatRelativeTime } from "@/lib/formatters";

interface ProdutoCardProps {
  produto: any;
  statusFicha?: string;
  custoTotal?: number;
  temAumento?: boolean;
  responsavelNome?: string;
  responsavelLabel?: string;
  responsavelData?: string;
  onEditar: (produto: any) => void;
  onExcluir: (produto: any) => void;
  onFichaCustos: (produto: any) => void;
  formatarMoeda: (valor: number) => string;
}

export function ProdutoCard({
  produto,
  statusFicha,
  custoTotal,
  temAumento,
  responsavelNome,
  responsavelLabel,
  responsavelData,
  onEditar,
  onExcluir,
  onFichaCustos,
  formatarMoeda,
}: ProdutoCardProps) {
  const isEmRevisao = statusFicha === "revisao_solicitada" || statusFicha === "em_revisao";

  return (
    <Card className={`relative overflow-hidden ${isEmRevisao ? "border-destructive/50 bg-destructive/5" : ""}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header: thumbnail + name + badges */}
        <div className="flex items-start gap-3">
          <ProductThumbnail src={produto.foto_url} alt={produto.nome} size="lg" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight truncate">{produto.nome}</h3>
            <p className="text-xs text-muted-foreground font-mono">{produto.codigo}</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {produto.modo_foco && (
                <Badge variant="warning" className="text-[10px] px-1.5 py-0">Modo Foco</Badge>
              )}
              <Badge variant={produto.ativo ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                {produto.ativo ? "Ativo" : "Inativo"}
              </Badge>
              <Badge variant={produto.origem === "importado" ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0">
                {produto.origem === "importado" ? "Importado" : "Nacional"}
              </Badge>
              {produto.tipo === "DISPLAY" && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 border-primary/40 text-primary">
                  <Layers className="h-2.5 w-2.5" /> Display
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Status da ficha */}
        <div className="flex items-center gap-2">
          {statusFicha ? (
            <StatusAprovacaoBadge status={statusFicha as StatusAprovacao} />
          ) : (
            <Badge variant="outline" className="text-[10px]">Sem Ficha</Badge>
          )}
        </div>

        {/* Display grade summary */}
        {produto.tipo === "DISPLAY" && (
          <div className="flex items-center gap-2">
            <ComposicaoGradeCard produtoId={produto.id} compact />
            <DisplayGradePopover produtoId={produto.id} produtoNome={produto.nome} produtoCodigo={produto.codigo} />
          </div>
        )}

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          {custoTotal != null && (
            <div className="col-span-2 flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Custo:</span>
              <span className="font-semibold font-mono">{formatarMoeda(custoTotal)}</span>
              {temAumento && <TrendingUp className="h-3 w-3 text-destructive" />}
            </div>
          )}
          {produto.itens_display && (
            <div className="flex items-center gap-1">
              <Package className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Itens/Display:</span>
              <span className="font-medium">{produto.itens_display}</span>
            </div>
          )}
          {produto.lead_time_dias && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Lead Time:</span>
              <span className="font-medium">{produto.lead_time_dias}d</span>
            </div>
          )}
          {produto.ncm && (
            <div className="flex items-center gap-1">
              <Barcode className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">NCM:</span>
              <span className="font-mono text-[11px]">{produto.ncm}</span>
            </div>
          )}
          {produto.processo_anvisa && (
            <div className="flex items-center gap-1 col-span-2">
              <span className="text-muted-foreground">Anvisa:</span>
              <span className="font-mono text-[11px]">{produto.processo_anvisa}</span>
            </div>
          )}
        </div>

        {/* Responsável */}
        {responsavelNome && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3 shrink-0" />
            <span className="font-medium text-foreground truncate">{responsavelNome}</span>
            <span>· {responsavelLabel}</span>
            {responsavelData && <span>· {formatRelativeTime(responsavelData)}</span>}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-1 pt-1 border-t">
          <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs" onClick={() => onFichaCustos(produto)}>
            <DollarSign className="h-3 w-3 mr-1" /> Custos
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onEditar(produto)}>
            <Edit className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => onExcluir(produto)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
