import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2, Download, Trash2, Image as ImageIcon, Paintbrush, Package, Share2, Filter
} from "lucide-react";

interface CreativeAsset {
  id: string;
  prompt: string;
  image_url: string | null;
  model_used: string;
  asset_type: string;
  category: string;
  format: string | null;
  created_at: string;
}

interface CreativeGalleryProps {
  refreshKey?: number;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: typeof Paintbrush }> = {
  marketing: { label: "Marketing", icon: Paintbrush },
  mockup: { label: "Mockup", icon: Package },
  social_media: { label: "Social", icon: Share2 },
};

export const CreativeGallery = ({ refreshKey }: CreativeGalleryProps) => {
  const [assets, setAssets] = useState<CreativeAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const loadAssets = async () => {
    try {
      let query = supabase
        .from("creative_studio_assets")
        .select("id, prompt, image_url, model_used, asset_type, category, format, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (filter !== "all") {
        query = query.eq("category", filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAssets((data as CreativeAsset[]) || []);
    } catch (err) {
      console.error("Erro ao carregar assets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [filter, refreshKey]);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("creative_studio_assets").delete().eq("id", id);
      if (error) throw error;
      setAssets((prev) => prev.filter((a) => a.id !== id));
      toast.success("Asset removido");
    } catch {
      toast.error("Erro ao remover asset");
    }
  };

  const handleDownload = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `creative-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Erro ao fazer download");
    }
  };

  const modelLabel = (m: string) => {
    if (m.includes("flash")) return "Flash";
    if (m.includes("pro")) return "Pro";
    return m;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" /> Galeria Criativa
            </CardTitle>
            <CardDescription>{assets.length} imagem(ns) gerada(s)</CardDescription>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[160px]">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
              <SelectItem value="mockup">Mockups</SelectItem>
              <SelectItem value="social_media">Redes Sociais</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : assets.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma imagem gerada ainda. Use a aba "Criar Imagem" para começar!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map((asset) => {
              const catInfo = CATEGORY_LABELS[asset.category] || CATEGORY_LABELS.marketing;
              const CatIcon = catInfo.icon;
              return (
                <Card key={asset.id} className="overflow-hidden group">
                  {asset.image_url ? (
                    <div className="relative">
                      <img
                        src={asset.image_url}
                        alt={asset.prompt}
                        className="w-full h-48 object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8"
                          onClick={() => handleDownload(asset.image_url!)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8"
                          onClick={() => handleDelete(asset.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-48 bg-muted flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <CardContent className="p-3 space-y-2">
                    <p className="text-xs line-clamp-2">{asset.prompt}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-xs gap-1">
                        <CatIcon className="h-2.5 w-2.5" /> {catInfo.label}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {modelLabel(asset.model_used)}
                      </Badge>
                      {asset.format && (
                        <Badge variant="secondary" className="text-xs">{asset.format}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(asset.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
