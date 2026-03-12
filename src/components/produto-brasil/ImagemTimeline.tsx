import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Plus, Trash2, Upload } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useProdutoBrasilImagens,
  useUploadProdutoImagem,
  useDeleteProdutoImagem,
  useImportChinaPhotos,
  ETAPA_LABELS,
  ORIGEM_LABELS,
} from "@/hooks/useProdutoBrasilImagens";
import type { ProdutoBrasil } from "@/hooks/useProdutoBrasil";

interface Props {
  produto: ProdutoBrasil;
}

const ETAPA_COLORS: Record<string, string> = {
  china_source: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  product_analysis: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  development: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved_catalog: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  marketing: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

export function ImagemTimeline({ produto }: Props) {
  const { data: imagens = [] } = useProdutoBrasilImagens(produto.id);
  const uploadImagem = useUploadProdutoImagem();
  const deleteImagem = useDeleteProdutoImagem();
  const importChina = useImportChinaPhotos();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadEtapa, setUploadEtapa] = useState("product_analysis");
  const [uploadOrigem, setUploadOrigem] = useState("internal_team");

  // Auto-import china photos
  useEffect(() => {
    if (produto.submissao_china_id && imagens.length === 0) {
      importChina.mutate({
        produtoBrasilId: produto.id,
        submissaoId: produto.submissao_china_id,
      });
    }
  }, [produto.submissao_china_id, produto.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadImagem.mutate({
      produtoBrasilId: produto.id,
      file,
      etapa: uploadEtapa,
      origem: uploadOrigem,
    });
    e.target.value = "";
  };

  // Group by etapa
  const grouped = Object.entries(ETAPA_LABELS).map(([key, label]) => ({
    key,
    label,
    images: imagens.filter((i) => i.etapa === key),
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            📷 Linha do Tempo de Imagens
            <Badge variant="secondary" className="text-[10px]">{imagens.length} foto(s)</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={uploadEtapa} onValueChange={setUploadEtapa}>
              <SelectTrigger className="h-8 text-xs w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ETAPA_LABELS).filter(([k]) => k !== "china_source").map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={uploadOrigem} onValueChange={setUploadOrigem}>
              <SelectTrigger className="h-8 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ORIGEM_LABELS).filter(([k]) => k !== "china_supplier").map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadImagem.isPending}
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              Upload
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {grouped.map((group) => (
          <div key={group.key}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
              <p className="text-xs font-semibold text-muted-foreground">{group.label}</p>
              <Badge variant="outline" className="text-[10px]">{group.images.length}</Badge>
            </div>
            {group.images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 ml-4 border-l-2 border-border pl-4">
                {group.images.map((img) => (
                  <div key={img.id} className="group relative">
                    <img
                      src={img.image_url}
                      alt={img.descricao || "Produto"}
                      className="w-full h-24 object-cover rounded-lg border border-border"
                      loading="lazy"
                    />
                    <button
                      onClick={() => deleteImagem.mutate({ id: img.id, produtoBrasilId: produto.id, imagePath: img.image_path })}
                      className="absolute top-1 right-1 bg-destructive/80 text-destructive-foreground rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <div className="mt-1">
                      <p className="text-[10px] text-muted-foreground truncate">{img.descricao || "—"}</p>
                      <div className="flex items-center gap-1">
                        <span className={`text-[9px] px-1 py-0.5 rounded ${ETAPA_COLORS[img.etapa] || "bg-muted text-muted-foreground"}`}>
                          {ORIGEM_LABELS[img.origem] || img.origem}
                        </span>
                      </div>
                      <p className="text-[9px] text-muted-foreground">
                        {format(new Date(img.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground ml-4 border-l-2 border-border pl-4 py-2 italic">
                Nenhuma foto nesta etapa
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
