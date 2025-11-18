import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RewardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reward: any;
  onSuccess: () => void;
}

export function RewardDialog({ open, onOpenChange, reward, onSuccess }: RewardDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    reward_type: "monetary" as "monetary" | "item" | "experience",
    min_points: "",
    max_points: "",
    percentage_value: "",
    fixed_amount: "",
    period_type: "monthly" as "monthly" | "quarterly" | "yearly" | "lifetime",
    is_active: true,
    requires_approval: false,
    banner_url: "",
  });

  useEffect(() => {
    if (reward) {
      setFormData({
        name: reward.reward_name || "",
        description: reward.description || "",
        reward_type: reward.reward_type || "monetary",
        min_points: reward.min_points?.toString() || "",
        max_points: reward.max_points?.toString() || "",
        percentage_value: reward.points_value?.toString() || "",
        fixed_amount: reward.fixed_amount?.toString() || "",
        period_type: reward.period_type || "monthly",
        is_active: reward.is_active ?? true,
        requires_approval: reward.requires_approval ?? false,
        banner_url: reward.banner_url || "",
      });
      setBannerPreview(reward.banner_url || null);
    } else {
      setFormData({
        name: "",
        description: "",
        reward_type: "monetary",
        min_points: "",
        max_points: "",
        percentage_value: "",
        fixed_amount: "",
        period_type: "monthly",
        is_active: true,
        requires_approval: false,
        banner_url: "",
      });
      setBannerPreview(null);
    }
  }, [reward, open]);

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O banner deve ter no máximo 5MB",
        variant: "destructive",
      });
      return;
    }

    // Validar tipo
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Formato inválido",
        description: "Por favor, envie uma imagem",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadingBanner(true);

      // Preview local
      const reader = new FileReader();
      reader.onload = (e) => {
        setBannerPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Upload para storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("reward-banners")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Armazenar apenas o caminho (path) por segurança
      setFormData((prev) => ({ ...prev, banner_url: filePath }));

      toast({
        title: "Banner enviado",
        description: "Banner carregado com sucesso!",
      });
    } catch (error: any) {
      console.error("Erro ao fazer upload:", error);
      toast({
        title: "Erro no upload",
        description: error.message || "Erro ao enviar banner",
        variant: "destructive",
      });
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleRemoveBanner = () => {
    setBannerPreview(null);
    setFormData((prev) => ({ ...prev, banner_url: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.min_points) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome e pontos mínimos",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Buscar usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      console.log("Salvando premiação...", formData);

      const rewardData = {
        reward_name: formData.name,
        description: formData.description || null,
        reward_type: formData.reward_type,
        min_points: parseInt(formData.min_points),
        max_points: formData.max_points ? parseInt(formData.max_points) : null,
        points_value: formData.percentage_value ? parseFloat(formData.percentage_value) : null,
        fixed_amount: formData.fixed_amount ? parseFloat(formData.fixed_amount) : null,
        period_type: formData.period_type,
        is_active: formData.is_active,
        requires_approval: formData.requires_approval,
        banner_url: formData.banner_url || null,
        created_by: user.id,
      };

      console.log("Dados da premiação:", rewardData);

      if (reward) {
        const { data, error } = await supabase
          .from("trade_rewards")
          .update(rewardData)
          .eq("id", reward.id)
          .select();

        console.log("Resultado update:", { data, error });

        if (error) throw error;

        toast({
          title: "Premiação atualizada",
          description: "A premiação foi atualizada com sucesso.",
        });
      } else {
        const { data, error } = await supabase
          .from("trade_rewards")
          .insert([rewardData])
          .select();

        console.log("Resultado insert:", { data, error });

        if (error) throw error;

        toast({
          title: "Premiação criada",
          description: "A premiação foi criada com sucesso.",
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error("Erro detalhado ao salvar premiação:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Erro ao salvar premiação",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {reward ? "Editar Premiação" : "Nova Premiação"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="banner">Banner</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 mt-4">
              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Premiação *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Prêmio Bronze"
                  required
                />
              </div>

              {/* Descrição */}
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva a premiação..."
                  rows={3}
                />
              </div>

              {/* Tipo de Recompensa */}
              <div className="space-y-2">
                <Label htmlFor="reward_type">Tipo de Recompensa</Label>
                <Select
                  value={formData.reward_type}
                  onValueChange={(value: any) => setFormData({ ...formData, reward_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monetary">Monetário</SelectItem>
                    <SelectItem value="item">Item</SelectItem>
                    <SelectItem value="experience">Experiência</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Pontos */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min_points">Pontos Mínimos *</Label>
                  <Input
                    id="min_points"
                    type="number"
                    value={formData.min_points}
                    onChange={(e) => setFormData({ ...formData, min_points: e.target.value })}
                    placeholder="0"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_points">Pontos Máximos</Label>
                  <Input
                    id="max_points"
                    type="number"
                    value={formData.max_points}
                    onChange={(e) => setFormData({ ...formData, max_points: e.target.value })}
                    placeholder="Ilimitado"
                  />
                </div>
              </div>

              {/* Valores (apenas se monetário) */}
              {formData.reward_type === "monetary" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="percentage_value">Percentual (%)</Label>
                    <Input
                      id="percentage_value"
                      type="number"
                      step="0.01"
                      value={formData.percentage_value}
                      onChange={(e) => setFormData({ ...formData, percentage_value: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fixed_amount">Valor Fixo (R$)</Label>
                    <Input
                      id="fixed_amount"
                      type="number"
                      step="0.01"
                      value={formData.fixed_amount}
                      onChange={(e) => setFormData({ ...formData, fixed_amount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}

              {/* Período */}
              <div className="space-y-2">
                <Label htmlFor="period_type">Período</Label>
                <Select
                  value={formData.period_type}
                  onValueChange={(value: any) => setFormData({ ...formData, period_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                    <SelectItem value="lifetime">Vitalício</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Switches */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Premiação Ativa</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="requires_approval">Requer Aprovação</Label>
                  <Switch
                    id="requires_approval"
                    checked={formData.requires_approval}
                    onCheckedChange={(checked) => setFormData({ ...formData, requires_approval: checked })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="banner" className="space-y-4 mt-4">
              {/* Banner Upload */}
              <div className="space-y-4">
                <Label>Banner da Premiação</Label>
                
                {bannerPreview ? (
                  <div className="relative">
                    <img
                      src={bannerPreview}
                      alt="Preview"
                      className="w-full h-64 object-cover rounded-lg border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={handleRemoveBanner}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                    <input
                      type="file"
                      id="banner-upload"
                      className="hidden"
                      accept="image/*"
                      onChange={handleBannerUpload}
                      disabled={uploadingBanner}
                    />
                    <label
                      htmlFor="banner-upload"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      {uploadingBanner ? (
                        <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
                      ) : (
                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                      )}
                      <div className="space-y-1">
                        <p className="font-medium">
                          {uploadingBanner ? "Enviando..." : "Clique para enviar banner"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          PNG, JPG ou WEBP (max. 5MB)
                        </p>
                      </div>
                    </label>
                  </div>
                )}

                <p className="text-sm text-muted-foreground">
                  Recomendamos imagens em proporção 16:9 (ex: 1920x1080px) para melhor visualização
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {reward ? "Atualizar" : "Criar"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
