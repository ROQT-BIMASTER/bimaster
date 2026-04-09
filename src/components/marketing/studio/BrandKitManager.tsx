import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Palette, Plus, Save, Trash2, Star } from "lucide-react";

interface BrandKit {
  id: string;
  nome: string;
  logo_url: string | null;
  cores_primarias: string[];
  cores_secundarias: string[];
  fontes: string[];
  diretrizes_visuais: string | null;
  is_default: boolean;
}

export const BrandKitManager = () => {
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingKit, setEditingKit] = useState<BrandKit | null>(null);
  const [newColor, setNewColor] = useState("#000000");
  const [newFont, setNewFont] = useState("");

  useEffect(() => {
    loadKits();
  }, []);

  const loadKits = async () => {
    const { data } = await supabase
      .from("brand_kits")
      .select("*")
      .order("is_default", { ascending: false });
    setKits((data as BrandKit[]) || []);
    setLoading(false);
  };

  const handleCreate = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("brand_kits").insert({
        user_id: user.id,
        nome: "Novo Kit de Marca",
        cores_primarias: [],
        cores_secundarias: [],
        fontes: [],
        is_default: kits.length === 0,
      });
      if (error) throw error;
      toast.success("Kit criado");
      loadKits();
    } catch {
      toast.error("Erro ao criar kit");
    }
  };

  const handleSave = async () => {
    if (!editingKit) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("brand_kits")
        .update({
          nome: editingKit.nome,
          logo_url: editingKit.logo_url,
          cores_primarias: editingKit.cores_primarias,
          cores_secundarias: editingKit.cores_secundarias,
          fontes: editingKit.fontes,
          diretrizes_visuais: editingKit.diretrizes_visuais,
        })
        .eq("id", editingKit.id);
      if (error) throw error;
      toast.success("Kit salvo!");
      loadKits();
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("brand_kits").delete().eq("id", id);
    if (!error) {
      toast.success("Kit removido");
      if (editingKit?.id === id) setEditingKit(null);
      loadKits();
    }
  };

  const addColor = (type: "cores_primarias" | "cores_secundarias") => {
    if (!editingKit) return;
    setEditingKit({ ...editingKit, [type]: [...editingKit[type], newColor] });
  };

  const removeColor = (type: "cores_primarias" | "cores_secundarias", idx: number) => {
    if (!editingKit) return;
    setEditingKit({ ...editingKit, [type]: editingKit[type].filter((_, i) => i !== idx) });
  };

  const addFont = () => {
    if (!editingKit || !newFont.trim()) return;
    setEditingKit({ ...editingKit, fontes: [...editingKit.fontes, newFont.trim()] });
    setNewFont("");
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Brand Kits</h3>
          <p className="text-sm text-muted-foreground">Configure a identidade visual para injetar nos prompts automaticamente</p>
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Novo Kit
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Kit List */}
        <div className="space-y-2">
          {kits.map((kit) => (
            <Card
              key={kit.id}
              className={`cursor-pointer transition-all ${editingKit?.id === kit.id ? "ring-2 ring-primary" : ""}`}
              onClick={() => setEditingKit(kit)}
            >
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{kit.nome}</span>
                  {kit.is_default && <Star className="h-3 w-3 text-warning fill-warning" />}
                </div>
                <div className="flex gap-1">
                  {kit.cores_primarias?.slice(0, 4).map((c, i) => (
                    <div key={i} className="w-4 h-4 rounded-full border" style={{ backgroundColor: c }} />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          {kits.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum kit criado. Clique em "Novo Kit" para começar.</p>
          )}
        </div>

        {/* Editor */}
        {editingKit && (
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base">Editando: {editingKit.nome}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Kit</Label>
                    <Input value={editingKit.nome} onChange={(e) => setEditingKit({ ...editingKit, nome: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>URL do Logo</Label>
                    <Input value={editingKit.logo_url || ""} onChange={(e) => setEditingKit({ ...editingKit, logo_url: e.target.value })} placeholder="https://..." />
                  </div>
                </div>

                {/* Colors */}
                {(["cores_primarias", "cores_secundarias"] as const).map((type) => (
                  <div key={type} className="space-y-2">
                    <Label>{type === "cores_primarias" ? "Cores Primárias" : "Cores Secundárias"}</Label>
                    <div className="flex flex-wrap gap-2 items-center">
                      {editingKit[type]?.map((c, i) => (
                        <div key={i} className="relative group">
                          <div className="w-8 h-8 rounded-md border cursor-pointer" style={{ backgroundColor: c }} onClick={() => removeColor(type, i)} />
                          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-3 h-3 text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100">×</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-1">
                        <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-8 h-8 cursor-pointer" />
                        <Button size="sm" variant="outline" onClick={() => addColor(type)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Fonts */}
                <div className="space-y-2">
                  <Label>Fontes</Label>
                  <div className="flex flex-wrap gap-2 items-center">
                    {editingKit.fontes?.map((f, i) => (
                      <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => setEditingKit({ ...editingKit, fontes: editingKit.fontes.filter((_, j) => j !== i) })}>
                        {f} ×
                      </Badge>
                    ))}
                    <div className="flex gap-1">
                      <Input value={newFont} onChange={(e) => setNewFont(e.target.value)} placeholder="Ex: Inter" className="w-32 h-8 text-xs" onKeyDown={(e) => e.key === "Enter" && addFont()} />
                      <Button size="sm" variant="outline" onClick={addFont}><Plus className="h-3 w-3" /></Button>
                    </div>
                  </div>
                </div>

                {/* Guidelines */}
                <div className="space-y-2">
                  <Label>Diretrizes Visuais</Label>
                  <Textarea
                    value={editingKit.diretrizes_visuais || ""}
                    onChange={(e) => setEditingKit({ ...editingKit, diretrizes_visuais: e.target.value })}
                    placeholder="Ex: Tom premium, minimalista, usar muito espaço branco..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    Salvar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(editingKit.id)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
