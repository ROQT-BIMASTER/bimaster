import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Gift,
  FileText,
  Save,
  Loader2,
  X,
  Upload,
  Building2,
  Plus,
  Camera,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { ClientSearchSelect } from "./ClientSearchSelect";
import { TipoBrindeQuickAdd } from "./TipoBrindeQuickAdd";
import { LancamentoPhotoCapture } from "./LancamentoPhotoCapture";

interface Campaign {
  id: string;
  code: string;
  name: string;
  campaign_type: string;
  start_date: string;
  end_date: string;
  estimated_cost: number;
  actual_cost?: number | null;
  verba_prevista: number;
  verba_orcada: number;
  budget?: { name: string; code: string } | null;
  responsible?: { nome: string } | null;
}

interface Lancamento {
  id: string;
  campaign_id: string;
  customer_id: string | null;
  data_lancamento: string;
  valor_pedido: number;
  tipo_brinde: string | null;
  acoes_manuais: string | null;
  sell_out_anterior: number;
  sell_out_atual: number;
  unon_anterior: number;
  unon_atual: number;
  crescimento_percentual: number | null;
  roi_percentual: number | null;
  status: string;
  evidencias: string[];
  cliente_nome?: string;
}

interface CampaignLancamentoFormProps {
  campaign: Campaign;
  lancamentoId?: string | null;
  customerId?: string | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}
// Tipos de brinde agora são carregados dinamicamente do banco

export function CampaignLancamentoForm({ 
  campaign, 
  lancamentoId,
  customerId,
  onSuccess,
  onCancel 
}: CampaignLancamentoFormProps) {
  const queryClient = useQueryClient();
  const { isAdminOrSupervisor } = useUserRole();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(customerId || null);
  const [enablePhotoCapture, setEnablePhotoCapture] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState<Array<{
    id: string;
    url: string;
    status: 'uploading' | 'pending_analysis' | 'analyzing' | 'completed' | 'failed';
    analysisResult?: any;
  }>>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    valor_pedido: 0,
    tipo_brinde: "",
    acoes_manuais: "",
    sell_out_anterior: 0,
    sell_out_atual: 0,
    unon_anterior: 0,
    unon_atual: 0,
  });

  const [evidencias, setEvidencias] = useState<string[]>([]);

  // Fetch existing lancamento if editing
  const { data: existingLancamento, isLoading: isLoadingLancamento } = useQuery({
    queryKey: ["lancamento", lancamentoId],
    queryFn: async () => {
      if (!lancamentoId) return null;
      
      const { data, error } = await supabase
        .from("trade_campaign_lancamentos")
        .select("*")
        .eq("id", lancamentoId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!lancamentoId,
  });

  // Fetch customers (prospects) - filtered by vendedor if not admin/supervisor
  const { data: customers } = useQuery({
    queryKey: ["prospects-for-lancamento", isAdminOrSupervisor],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from("prospects")
        .select("id, nome_empresa, cnpj")
        .order("nome_empresa");

      // If not admin/supervisor, filter by vendedor_id
      if (!isAdminOrSupervisor) {
        query = query.eq("vendedor_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch tipos de brinde
  const { data: tiposBrinde = [] } = useQuery({
    queryKey: ["tipos-brinde"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_tipos_brinde")
        .select("codigo, nome")
        .eq("ativo", true)
        .order("nome");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Load existing data when editing
  useEffect(() => {
    if (existingLancamento) {
      setFormData({
        valor_pedido: existingLancamento.valor_pedido || 0,
        tipo_brinde: existingLancamento.tipo_brinde || "",
        acoes_manuais: existingLancamento.acoes_manuais || "",
        sell_out_anterior: existingLancamento.sell_out_anterior || 0,
        sell_out_atual: existingLancamento.sell_out_atual || 0,
        unon_anterior: existingLancamento.unon_anterior || 0,
        unon_atual: existingLancamento.unon_atual || 0,
      });
      setSelectedCustomerId(existingLancamento.customer_id);
      setEvidencias((existingLancamento.evidencias as string[]) || []);
    }
  }, [existingLancamento]);

  // Cálculos automáticos
  const incrementoValor = formData.sell_out_atual - formData.sell_out_anterior;
  const crescimentoPercentual = formData.sell_out_anterior > 0
    ? ((formData.sell_out_atual - formData.sell_out_anterior) / formData.sell_out_anterior) * 100
    : 0;
  
  const crescimentoPositivo = crescimentoPercentual >= 0;

  // ROI = (Incremento Valor / Custo Campanha) * 100
  const custoBase = campaign.verba_orcada || campaign.estimated_cost || 1;
  const roiPercentual = custoBase > 0 ? (incrementoValor / custoBase) * 100 : 0;
  const roiPositivo = roiPercentual >= 0;

  const getCampaignTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      sell_in: "Sell In",
      sell_out: "Sell Out",
      institucional: "Institucional",
      cooperada: "Cooperada",
      mdf: "MDF",
      midia: "Mídia",
      incentivo: "Incentivo",
      degustacao: "Degustação",
      bonificacao: "Bonificação",
      compre_ganhe: "Compre e Ganhe",
    };
    return labels[type] || type;
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  const handleInputChange = (field: keyof typeof formData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${campaign.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { data, error } = await supabase.storage
          .from('campaign-evidence')
          .upload(fileName, file);

        if (error) {
          console.error('Upload error:', error);
          toast.error(`Erro ao enviar ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('campaign-evidence')
          .getPublicUrl(fileName);

        if (urlData?.publicUrl) {
          newUrls.push(urlData.publicUrl);
        }
      }

      setEvidencias(prev => [...prev, ...newUrls]);
      if (newUrls.length > 0) {
        toast.success(`${newUrls.length} arquivo(s) enviado(s)`);
      }
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Erro ao enviar arquivos');
    } finally {
      setIsUploading(false);
    }
  };

  const removeEvidencia = (index: number) => {
    setEvidencias(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!selectedCustomerId) {
      toast.error("Selecione um cliente para o lançamento");
      return;
    }

    setIsSaving(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Combine evidências + fotos capturadas
      const allPhotoUrls = [
        ...evidencias,
        ...capturedPhotos.filter(p => p.status !== 'uploading').map(p => p.url)
      ];

      const lancamentoData = {
        campaign_id: campaign.id,
        customer_id: selectedCustomerId,
        data_lancamento: new Date().toISOString().split('T')[0],
        valor_pedido: formData.valor_pedido,
        tipo_brinde: formData.tipo_brinde || null,
        acoes_manuais: formData.acoes_manuais || null,
        sell_out_anterior: formData.sell_out_anterior,
        sell_out_atual: formData.sell_out_atual,
        unon_anterior: formData.unon_anterior,
        unon_atual: formData.unon_atual,
        roi_percentual: roiPercentual,
        roi_valor: incrementoValor,
        evidencias: allPhotoUrls,
        status: 'pending',
        created_by: user.id,
      };

      if (lancamentoId) {
        // Update existing
        const { error } = await supabase
          .from("trade_campaign_lancamentos")
          .update({
            ...lancamentoData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", lancamentoId);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("trade_campaign_lancamentos")
          .insert(lancamentoData);

        if (error) throw error;
      }

      // Registrar no audit log
      await supabase.from("trade_campaign_audit_log").insert({
        campaign_id: campaign.id,
        action: lancamentoId ? "update_lancamento" : "create_lancamento",
        user_id: user.id,
        new_data: {
          customer_id: selectedCustomerId,
          valor_pedido: formData.valor_pedido,
          sell_out_anterior: formData.sell_out_anterior,
          sell_out_atual: formData.sell_out_atual,
          crescimento_percentual: crescimentoPercentual,
          roi_percentual: roiPercentual,
          evidencias_count: allPhotoUrls.length,
          photos_with_analysis: capturedPhotos.length,
        },
      });

      toast.success(lancamentoId ? "Lançamento atualizado!" : "Lançamento criado! Aguardando aprovação.");
      
      // Invalidar cache para atualizar a UI
      queryClient.invalidateQueries({ queryKey: ["campaign-lancamentos"] });
      queryClient.invalidateQueries({ queryKey: ["lancamento"] });
      
      onSuccess?.();
    } catch (err) {
      console.error('Save error:', err);
      toast.error("Erro ao salvar lançamento");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);

  if (isLoadingLancamento) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header da Campanha */}
      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <Badge variant="secondary" className="mb-2">
                {getCampaignTypeLabel(campaign.campaign_type)}
              </Badge>
              <h2 className="text-2xl font-bold">{campaign.name}</h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium">Código: {campaign.code}</span>
                <span className="text-muted-foreground/50">|</span>
                <span>OP: {campaign.id.slice(0, 8).toUpperCase()}</span>
              </div>
            </div>
            <div className="flex flex-col items-start md:items-end gap-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Período</span>
              </div>
              <p className="text-lg font-semibold">
                {format(new Date(campaign.start_date), "dd/MM/yyyy", { locale: ptBR })}
              </p>
              <p className="text-xs text-muted-foreground">
                até {format(new Date(campaign.end_date), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seleção de Cliente */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" />
            Cliente / PDV
          </CardTitle>
          <CardDescription>Selecione o cliente para este lançamento</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientSearchSelect
            customers={customers || []}
            value={selectedCustomerId}
            onValueChange={setSelectedCustomerId}
            placeholder="Buscar por nome ou CNPJ..."
          />
        </CardContent>
      </Card>

      {/* Seção: Lançamento de Fotos (Opcional) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Camera className="h-5 w-5 text-primary" />
                Lançamento de Fotos do PDV
              </CardTitle>
              <CardDescription>
                Registre fotos da execução da campanha no ponto de venda
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="enable-photos" className="text-sm font-normal text-muted-foreground">
                Habilitar
              </Label>
              <Switch
                id="enable-photos"
                checked={enablePhotoCapture}
                onCheckedChange={setEnablePhotoCapture}
              />
            </div>
          </div>
        </CardHeader>
        {enablePhotoCapture && (
          <CardContent>
            <LancamentoPhotoCapture
              campaignId={campaign.id}
              customerId={selectedCustomerId}
              photos={capturedPhotos}
              onPhotosChange={setCapturedPhotos}
            />
          </CardContent>
        )}
      </Card>

      {/* Seção: Valor do Pedido + Brinde + Ações */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-primary" />
            Dados do Lançamento
          </CardTitle>
          <CardDescription>Preencha os dados da execução da campanha no PDV</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Valor do Pedido */}
            <div className="space-y-2">
              <Label htmlFor="valor_pedido">Valor do Pedido</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  id="valor_pedido"
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-10"
                  value={formData.valor_pedido}
                  onChange={(e) => handleInputChange("valor_pedido", parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Tipo de Brinde */}
            <div className="space-y-2">
              <Label htmlFor="tipo_brinde" className="flex items-center gap-1">
                <Gift className="h-4 w-4" />
                Tipo de Brinde
              </Label>
              <div className="flex gap-2">
                <Select
                  value={formData.tipo_brinde}
                  onValueChange={(value) => handleInputChange("tipo_brinde", value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione o brinde" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposBrinde.map((tipo) => (
                      <SelectItem key={tipo.codigo} value={tipo.codigo}>
                        {tipo.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <TipoBrindeQuickAdd 
                  onSuccess={(codigo) => handleInputChange("tipo_brinde", codigo)} 
                />
              </div>
            </div>

            {/* Ações Manuais */}
            <div className="space-y-2">
              <Label htmlFor="acoes_manuais" className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Ações / Observações
              </Label>
              <Textarea
                id="acoes_manuais"
                placeholder="Descreva as ações realizadas..."
                className="min-h-[80px] resize-none"
                value={formData.acoes_manuais}
                onChange={(e) => handleInputChange("acoes_manuais", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção: Comparativo Sell Out */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Retorno da Campanha (Sell Out)
          </CardTitle>
          <CardDescription>Compare o desempenho antes e depois da campanha</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Grid de Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sell Out Anterior */}
            <div className="p-4 rounded-xl bg-muted/50 border space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Sell Out $ Anterior</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-10 text-lg font-semibold"
                  value={formData.sell_out_anterior}
                  onChange={(e) => handleInputChange("sell_out_anterior", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Unon x Cliente</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-10 h-8 text-sm"
                    value={formData.unon_anterior}
                    onChange={(e) => handleInputChange("unon_anterior", parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            {/* VS Indicator */}
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <span className="text-3xl font-bold text-primary">X</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">versus</p>
              </div>
            </div>

            {/* Sell Out Atual */}
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Sell Out $ Atual</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary text-sm">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-10 text-lg font-semibold border-primary/30 focus-visible:ring-primary"
                  value={formData.sell_out_atual}
                  onChange={(e) => handleInputChange("sell_out_atual", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="pt-2 border-t border-primary/20">
                <p className="text-xs text-muted-foreground mb-1">Unon x Cliente</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary text-xs">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-10 h-8 text-sm border-primary/30"
                    value={formData.unon_atual}
                    onChange={(e) => handleInputChange("unon_atual", parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Crescimento Calculado */}
          <div className="p-4 rounded-xl border-2 border-dashed flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                crescimentoPositivo ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
                {crescimentoPositivo ? (
                  <TrendingUp className="h-6 w-6" />
                ) : (
                  <TrendingDown className="h-6 w-6" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Crescimento</p>
                <p className={`text-2xl font-bold ${
                  crescimentoPositivo ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatPercent(crescimentoPercentual)}
                </p>
              </div>
            </div>
            <div className="h-12 w-px bg-border hidden md:block" />
            <div>
              <p className="text-sm text-muted-foreground">Valor Incremento</p>
              <p className={`text-2xl font-bold ${
                incrementoValor >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(Math.abs(incrementoValor))}
              </p>
            </div>
            <div className="h-12 w-px bg-border hidden md:block" />
            <div>
              <p className="text-sm text-muted-foreground">ROI Calculado</p>
              <p className={`text-2xl font-bold ${
                roiPositivo ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatPercent(roiPercentual)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção: Evidências */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-5 w-5 text-primary" />
            Evidências e Comprovantes
          </CardTitle>
          <CardDescription>Anexe fotos e comprovantes da execução</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Upload Area */}
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                id="file-upload"
                multiple
                accept="image/*,.pdf"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                {isUploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                ) : (
                  <Upload className="h-8 w-8 text-muted-foreground" />
                )}
                <p className="text-sm text-muted-foreground">
                  {isUploading ? "Enviando..." : "Clique ou arraste arquivos aqui"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Imagens ou PDFs
                </p>
              </label>
            </div>

            {/* Preview Grid */}
            {evidencias.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {evidencias.map((url, index) => (
                  <div key={index} className="relative group aspect-square">
                    <img
                      src={url}
                      alt={`Evidência ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={() => removeEvidencia(index)}
                      className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Botões de Ação */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={isSaving || !selectedCustomerId}
          className="gap-2"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {lancamentoId ? "Atualizar Lançamento" : "Salvar Lançamento"}
        </Button>
      </div>
    </div>
  );
}
