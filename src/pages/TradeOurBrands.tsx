import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Star, Tag } from "lucide-react";

interface Brand {
  id: string;
  brand_name: string;
  description: string | null;
  logo_url: string | null;
  is_primary: boolean;
  active: boolean;
  created_at: string;
}

export default function TradeOurBrands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  
  const [formData, setFormData] = useState({
    brand_name: "",
    description: "",
    logo_url: "",
    is_primary: false,
    active: true
  });

  useEffect(() => {
    fetchBrands();

    const channel = supabase
      .channel('brands-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'our_brands' }, fetchBrands)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchBrands = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("our_brands")
        .select("*")
        .order("is_primary", { ascending: false })
        .order("brand_name");

      if (error) throw error;
      setBrands(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.brand_name.trim()) {
      toast.error("Nome da marca é obrigatório");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (editingBrand) {
        const { error } = await supabase
          .from("our_brands")
          .update({
            brand_name: formData.brand_name,
            description: formData.description || null,
            logo_url: formData.logo_url || null,
            is_primary: formData.is_primary,
            active: formData.active
          })
          .eq("id", editingBrand.id);

        if (error) throw error;
        toast.success("Marca atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("our_brands")
          .insert({
            brand_name: formData.brand_name,
            description: formData.description || null,
            logo_url: formData.logo_url || null,
            is_primary: formData.is_primary,
            active: formData.active,
            created_by: user.id
          });

        if (error) throw error;
        toast.success("Marca cadastrada com sucesso!");
      }

      setDialogOpen(false);
      resetForm();
      fetchBrands();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar marca");
    }
  };

  const handleEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setFormData({
      brand_name: brand.brand_name,
      description: brand.description || "",
      logo_url: brand.logo_url || "",
      is_primary: brand.is_primary,
      active: brand.active
    });
    setDialogOpen(true);
  };

  const handleDelete = async (brandId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta marca?")) return;

    try {
      const { error } = await supabase
        .from("our_brands")
        .delete()
        .eq("id", brandId);

      if (error) throw error;
      toast.success("Marca excluída com sucesso!");
      fetchBrands();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir marca");
    }
  };

  const resetForm = () => {
    setFormData({
      brand_name: "",
      description: "",
      logo_url: "",
      is_primary: false,
      active: true
    });
    setEditingBrand(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Nossas Marcas</h1>
            <p className="text-muted-foreground">
              Configure as marcas próprias para análises de IA
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Marca
          </Button>
        </div>

        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Tag className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                  Base de Conhecimento para IA
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  As marcas cadastradas aqui são usadas pela IA para identificar e analisar seus produtos nas lojas,
                  calcular share de prateleira e gerar insights sobre o desempenho das suas marcas.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-8">Carregando marcas...</div>
        ) : brands.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">Nenhuma marca cadastrada</p>
              <p className="text-muted-foreground mb-4">
                Cadastre suas marcas para que a IA possa identificá-las nas análises
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar Primeira Marca
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {brands.map((brand) => (
              <Card key={brand.id} className={!brand.active ? "opacity-60" : ""}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {brand.brand_name}
                        {brand.is_primary && (
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        )}
                      </CardTitle>
                      {brand.description && (
                        <CardDescription className="mt-2">
                          {brand.description}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant={brand.active ? "default" : "secondary"}>
                      {brand.active ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {brand.logo_url && (
                    <div className="mb-4">
                      <img 
                        src={brand.logo_url} 
                        alt={brand.brand_name}
                        className="h-16 object-contain"
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(brand)}
                      className="flex-1"
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(brand.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBrand ? "Editar Marca" : "Nova Marca"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brand_name">Nome da Marca *</Label>
              <Input
                id="brand_name"
                value={formData.brand_name}
                onChange={(e) => setFormData(prev => ({ ...prev, brand_name: e.target.value }))}
                placeholder="Ex: Coca-Cola, Guaraná Antarctica..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva a marca, categoria de produtos..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo_url">URL do Logo</Label>
              <Input
                id="logo_url"
                value={formData.logo_url}
                onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
                placeholder="https://exemplo.com/logo.png"
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="is_primary">Marca Principal</Label>
                <p className="text-sm text-muted-foreground">
                  Destaque esta marca nas análises
                </p>
              </div>
              <Switch
                id="is_primary"
                checked={formData.is_primary}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_primary: checked }))}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="active">Marca Ativa</Label>
                <p className="text-sm text-muted-foreground">
                  Incluir nas análises de IA
                </p>
              </div>
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked }))}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingBrand ? "Atualizar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
