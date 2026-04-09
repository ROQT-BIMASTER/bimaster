import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, LayoutTemplate, ArrowRight } from "lucide-react";

interface Template {
  id: string;
  nome: string;
  categoria: string;
  prompt_base: string;
  dimensoes: string;
  tags: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  post_instagram: "Post Instagram",
  story_reels: "Story/Reels",
  banner_web: "Banner Web",
  email_marketing: "Email Marketing",
  material_pdv: "Material PDV",
  embalagem: "Embalagem",
  catalogo: "Catálogo",
  rotulo: "Rótulo",
};

interface Props {
  onSelectTemplate: (prompt: string) => void;
}

export const TemplateLibrary = ({ onSelectTemplate }: Props) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const { data } = await supabase
      .from("stitch_templates")
      .select("id, nome, categoria, prompt_base, dimensoes, tags")
      .eq("is_active", true)
      .order("categoria");
    setTemplates((data as Template[]) || []);
    setLoading(false);
  };

  const categories = [...new Set(templates.map((t) => t.categoria))];

  const filtered = templates.filter((t) => {
    const matchSearch = !search || t.nome.toLowerCase().includes(search.toLowerCase()) || t.tags?.some((tag) => tag.includes(search.toLowerCase()));
    const matchCategory = !selectedCategory || t.categoria === selectedCategory;
    return matchSearch && matchCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar templates..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant={selectedCategory === null ? "default" : "outline"} onClick={() => setSelectedCategory(null)}>
            Todos
          </Button>
          {categories.map((cat) => (
            <Button key={cat} size="sm" variant={selectedCategory === cat ? "default" : "outline"} onClick={() => setSelectedCategory(cat)}>
              {CATEGORY_LABELS[cat] || cat}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <LayoutTemplate className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum template encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((template) => (
            <Card key={template.id} className="group cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={() => onSelectTemplate(template.prompt_base)}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-sm">{template.nome}</h4>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {CATEGORY_LABELS[template.categoria] || template.categoria}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{template.dimensoes}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3">{template.prompt_base}</p>
                <div className="flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="h-3 w-3" /> Usar este template
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
