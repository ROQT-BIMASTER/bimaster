import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Upload, X } from "lucide-react";

interface Reward {
  id: string;
  reward_name: string;
  description: string | null;
  reward_type: string;
  min_points: number | null;
  max_points: number | null;
  points_value: number | null;
  fixed_amount: number | null;
  period_type: string | null;
  is_active: boolean;
  requires_approval: boolean;
  banner_url: string | null;
}

export function GerenciamentoPremiacoes() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    reward_name: "",
    description: "",
    reward_type: "monetary",
    min_points: "",
    max_points: "",
    points_value: "",
    fixed_amount: "",
    period_type: "monthly",
    is_active: true,
    requires_approval: true,
    banner_url: "",
  });

  useEffect(() => {
    fetchRewards();
  }, []);

  const fetchRewards = async () => {
    try {
      const { data, error } = await supabase
        .from("trade_rewards")
        .select("*")
        .order("min_points", { ascending: true });

      if (error) throw error;
      setRewards(data || []);
    } catch (error) {
      console.error("Erro ao buscar premiações:", error);
      toast({
        title: "Erro ao carregar premiações",
        description: "Não foi possível carregar as premiações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      reward_name: "",
      description: "",
      reward_type: "monetary",
      min_points: "",
      max_points: "",
      points_value: "",
      fixed_amount: "",
      period_type: "monthly",
      is_active: true,
      requires_approval: true,
      banner_url: "",
    });
    setBannerPreview(null);
    setEditingReward(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleEdit = (reward: Reward) => {
    setEditingReward(reward);
    setFormData({
      reward_name: reward.reward_name,
      description: reward.description || "",
      reward_type: reward.reward_type,
      min_points: reward.min_points?.toString() || "",
      max_points: reward.max_points?.toString() || "",
      points_value: reward.points_value?.toString() || "",
      fixed_amount: reward.fixed_amount?.toString() || "",
      period_type: reward.period_type || "monthly",
      is_active: reward.is_active,
      requires_approval: reward.requires_approval,
      banner_url: reward.banner_url || "",
    });
    setBannerPreview(reward.banner_url);
    setDialogOpen(true);
  };

  const handleBannerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione apenas arquivos de imagem.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);

      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('reward-banners')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Armazenar apenas o caminho (path) por segurança
      setFormData({ ...formData, banner_url: filePath });

      toast({
        title: "Banner enviado",
        description: "O banner foi enviado com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível enviar o banner.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveBanner = () => {
    setBannerPreview(null);
    setFormData({ ...formData, banner_url: "" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    try {
      const rewardData = {
        reward_name: formData.reward_name,
        description: formData.description || null,
        reward_type: formData.reward_type,
        min_points: formData.min_points ? parseInt(formData.min_points) : null,
        max_points: formData.max_points ? parseInt(formData.max_points) : null,
        points_value: formData.points_value ? parseFloat(formData.points_value) : null,
        fixed_amount: formData.fixed_amount ? parseFloat(formData.fixed_amount) : null,
        period_type: formData.period_type,
        is_active: formData.is_active,
        requires_approval: formData.requires_approval,
        banner_url: formData.banner_url || null,
      };

      if (editingReward) {
        const { error } = await supabase
          .from("trade_rewards")
          .update(rewardData)
          .eq("id", editingReward.id);

        if (error) throw error;

        toast({
          title: "Premiação atualizada",
          description: "A premiação foi atualizada com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from("trade_rewards")
          .insert([rewardData]);

        if (error) throw error;

        toast({
          title: "Premiação criada",
          description: "A premiação foi criada com sucesso.",
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchRewards();
    } catch (error) {
      console.error("Erro ao salvar premiação:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a premiação.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta premiação?")) return;

    try {
      const { error } = await supabase
        .from("trade_rewards")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Premiação excluída",
        description: "A premiação foi excluída com sucesso.",
      });

      fetchRewards();
    } catch (error) {
      console.error("Erro ao excluir premiação:", error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir a premiação.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gerenciamento de Premiações</CardTitle>
            <CardDescription>
              Configure as premiações por faixa de pontuação com banners de comunicação visual
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Premiação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingReward ? "Editar Premiação" : "Nova Premiação"}
                </DialogTitle>
                <DialogDescription>
                  Configure os detalhes da premiação por pontuação
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="reward_name">Nome da Premiação</Label>
                  <Input
                    id="reward_name"
                    value={formData.reward_name}
                    onChange={(e) => setFormData({ ...formData, reward_name: e.target.value })}
                    placeholder="Ex: Bônus Mensal Bronze"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descreva a premiação"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="min_points">Pontuação Mínima</Label>
                    <Input
                      id="min_points"
                      type="number"
                      value={formData.min_points}
                      onChange={(e) => setFormData({ ...formData, min_points: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="max_points">Pontuação Máxima</Label>
                    <Input
                      id="max_points"
                      type="number"
                      value={formData.max_points}
                      onChange={(e) => setFormData({ ...formData, max_points: e.target.value })}
                      placeholder="1000"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="reward_type">Tipo de Premiação</Label>
                  <Select
                    value={formData.reward_type}
                    onValueChange={(value) => setFormData({ ...formData, reward_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monetary">Monetária (R$)</SelectItem>
                      <SelectItem value="points_conversion">Conversão de Pontos</SelectItem>
                      <SelectItem value="prize">Prêmio/Produto</SelectItem>
                      <SelectItem value="recognition">Reconhecimento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.reward_type === "monetary" && (
                  <div className="grid gap-2">
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
                )}

                {formData.reward_type === "points_conversion" && (
                  <div className="grid gap-2">
                    <Label htmlFor="points_value">Valor por Ponto (R$)</Label>
                    <Input
                      id="points_value"
                      type="number"
                      step="0.01"
                      value={formData.points_value}
                      onChange={(e) => setFormData({ ...formData, points_value: e.target.value })}
                      placeholder="0.10"
                    />
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="period_type">Período</Label>
                  <Select
                    value={formData.period_type}
                    onValueChange={(value) => setFormData({ ...formData, period_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="quarterly">Trimestral</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                      <SelectItem value="all_time">Geral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="banner">Banner da Campanha</Label>
                  <p className="text-sm text-muted-foreground">
                    Faça upload de uma imagem para comunicação visual (max 5MB)
                  </p>
                  
                  {bannerPreview ? (
                    <div className="relative">
                      <img 
                        src={bannerPreview} 
                        alt="Banner preview" 
                        className="w-full h-48 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={handleRemoveBanner}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
                      <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Clique para fazer upload do banner
                      </p>
                      <Input
                        ref={fileInputRef}
                        id="banner"
                        type="file"
                        accept="image/*"
                        onChange={handleBannerUpload}
                        disabled={uploading}
                        className="cursor-pointer"
                      />
                      {uploading && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Enviando...
                        </p>
                      )}
                    </div>
                  )}
                </div>

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
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  {editingReward ? "Atualizar" : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Banner</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Faixa de Pontos</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rewards.map((reward) => (
              <TableRow key={reward.id}>
                <TableCell>
                  {reward.banner_url ? (
                    <img 
                      src={reward.banner_url} 
                      alt={reward.reward_name} 
                      className="w-20 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-20 h-12 bg-muted rounded flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">Sem banner</span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium">{reward.reward_name}</TableCell>
                <TableCell>
                  {reward.reward_type === "monetary" && "Monetária"}
                  {reward.reward_type === "points_conversion" && "Conversão"}
                  {reward.reward_type === "prize" && "Prêmio"}
                  {reward.reward_type === "recognition" && "Reconhecimento"}
                </TableCell>
                <TableCell>
                  {reward.min_points} - {reward.max_points || "∞"} pts
                </TableCell>
                <TableCell>
                  {reward.reward_type === "monetary" && `R$ ${reward.fixed_amount?.toFixed(2)}`}
                  {reward.reward_type === "points_conversion" && `R$ ${reward.points_value?.toFixed(2)}/pt`}
                  {!["monetary", "points_conversion"].includes(reward.reward_type) && "-"}
                </TableCell>
                <TableCell>
                  {reward.period_type === "monthly" && "Mensal"}
                  {reward.period_type === "quarterly" && "Trimestral"}
                  {reward.period_type === "yearly" && "Anual"}
                  {reward.period_type === "all_time" && "Geral"}
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                    reward.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                  }`}>
                    {reward.is_active ? "Ativa" : "Inativa"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(reward)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(reward.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
