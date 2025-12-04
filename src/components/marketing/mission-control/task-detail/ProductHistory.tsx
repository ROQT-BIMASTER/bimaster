import { Badge } from "@/components/ui/badge";
import { Package, Tag, Layers, Factory, FileText } from "lucide-react";

interface Product {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  descricao_completa?: string | null;
  foto_url?: string | null;
  categoria?: string | null;
  subcategoria?: string | null;
  linha?: string | null;
  marca?: string | null;
  fabricante?: string | null;
  sku?: string | null;
  codigo_barras_ean?: string | null;
}

interface ProductHistoryProps {
  product: Product | null;
}

export function ProductHistory({ product }: ProductHistoryProps) {
  if (!product) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Produto não vinculado</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com foto */}
      <div className="flex gap-4">
        <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center overflow-hidden border">
          {product.foto_url ? (
            <img 
              src={product.foto_url} 
              alt={product.nome}
              className="w-full h-full object-cover"
            />
          ) : (
            <Package className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg line-clamp-2">{product.nome}</h3>
          <p className="text-sm text-muted-foreground">Código: {product.codigo}</p>
          {product.sku && (
            <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
          )}
          {product.codigo_barras_ean && (
            <p className="text-sm text-muted-foreground">EAN: {product.codigo_barras_ean}</p>
          )}
        </div>
      </div>

      {/* Tags de categorização */}
      <div className="flex flex-wrap gap-2">
        {product.categoria && (
          <Badge variant="outline" className="flex items-center gap-1">
            <Tag className="h-3 w-3" />
            {product.categoria}
          </Badge>
        )}
        {product.subcategoria && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {product.subcategoria}
          </Badge>
        )}
        {product.linha && (
          <Badge variant="outline" className="flex items-center gap-1">
            {product.linha}
          </Badge>
        )}
        {product.marca && (
          <Badge className="flex items-center gap-1 bg-primary/10 text-primary border-0">
            {product.marca}
          </Badge>
        )}
        {product.fabricante && (
          <Badge variant="outline" className="flex items-center gap-1">
            <Factory className="h-3 w-3" />
            {product.fabricante}
          </Badge>
        )}
      </div>

      {/* Descrição */}
      {(product.descricao_completa || product.descricao) && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Descrição do Produto
          </h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">
            {product.descricao_completa || product.descricao}
          </p>
        </div>
      )}
    </div>
  );
}