import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Gift,
  FileText,
  Camera,
  Save,
  Loader2,
  X,
  Upload
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Campaign {
  id: string;
  code: string;
  name: string;
  campaign_type: string;
  start_date: string;
  end_date: string;
  estimated_cost: number;
  actual_cost: number | null;
  verba_prevista: number;
  verba_orcada: number;
  sell_in_anterior: number;
  sell_in_atual: number;
  sell_out_anterior: number;
  sell_out_atual: number;
  crescimento_percentual: number | null;
  roi_percentual: number | null;
  roi_valor: number | null;
  valor_pedido?: number | null;
  tipo_brinde?: string | null;
  acoes_manuais?: string | null;
  unon_anterior?: number | null;
  unon_atual?: number | null;
  budget?: { name: string; code: string } | null;
  responsible?: { nome: string } | null;
}

interface CampaignLancamentoFormProps {
  campaign: Campaign;
  onSuccess?: () => void;
}

const BRINDE_OPTIONS = [
  { value: "brinde_produto", label: "Brinde Produto" },
  { value: "desconto", label: "Desconto" },
  { value: "bonificacao", label: "Bonificação" },
  { value: "kit_promocional", label: "Kit Promocional" },
  { value: "premio", label: "Prêmio" },
  { value: "outro", label: "Outro" },
];

export function CampaignLancamentoForm({ campaign, onSuccess }: CampaignLancamentoFormProps) {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    valor_pedido: campaign.valor_pedido || 0,
    tipo_brinde: campaign.tipo_brinde || "",
    acoes_manuais: campaign.acoes_manuais || "",
    sell_out_anterior: campaign.sell_out_anterior || 0,
    sell_out_atual: campaign.sell_out_atual || 0,
    unon_anterior: campaign.unon_anterior || 0,
    unon_atual: campaign.unon_atual || 0,
  });

  const [evidencias, setEvidencias] = useState<string[]>([]);

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

  const parseCurrencyInput = (value: string): number => {
    // Remove tudo exceto números e vírgula/ponto
    const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
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
    setIsSaving(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Atualizar campanha com os dados do lançamento
      const { error: updateError } = await supabase
        .from("trade_campaigns")
        .update({
          valor_pedido: formData.valor_pedido,
          tipo_brinde: formData.tipo_brinde || null,
          acoes_manuais: formData.acoes_manuais || null,
          sell_out_anterior: formData.sell_out_anterior,
          sell_out_atual: formData.sell_out_atual,
          unon_anterior: formData.unon_anterior,
          unon_atual: formData.unon_atual,
          crescimento_percentual: crescimentoPercentual,
          roi_percentual: roiPercentual,
          roi_valor: incrementoValor,
          validation_status: 'pending', // Marcar para validação
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign.id);

      if (updateError) {
        console.error('Update error:', updateError);
        toast.error("Erro ao salvar lançamento");
        return;
      }

      // Se houver evidências, criar registro de despesa com as evidências
      if (evidencias.length > 0) {
        const { error: expenseError } = await supabase
          .from("trade_campaign_expenses")
          .insert({
            campaign_id: campaign.id,
            category: "lancamento_pdv",
            description: `Lançamento PDV - ${campaign.name}`,
            valor_realizado: formData.valor_pedido,
            expense_date: new Date().toISOString().split('T')[0],
            evidencias: evidencias,
            comprovante_url: evidencias[0] || null,
            status: "pending",
            created_by: user.id,
          });

        if (expenseError) {
          console.error('Expense error:', expenseError);
          // Não bloquear se falhar, apenas avisar
          toast.warning("Lançamento salvo, mas houve erro ao vincular evidências");
        }
      }

      // Registrar no audit log
      await supabase.from("trade_campaign_audit_log").insert({
        campaign_id: campaign.id,
        action: "lancamento_pdv",
        user_id: user.id,
        old_data: {
          valor_pedido: campaign.valor_pedido,
          sell_out_anterior: campaign.sell_out_anterior,
          sell_out_atual: campaign.sell_out_atual,
        },
        new_data: {
          valor_pedido: formData.valor_pedido,
          sell_out_anterior: formData.sell_out_anterior,
          sell_out_atual: formData.sell_out_atual,
          crescimento_percentual: crescimentoPercentual,
          roi_percentual: roiPercentual,
          evidencias_count: evidencias.length,
        },
      });

      toast.success("Lançamento salvo com sucesso! Aguardando aprovação.");
      
      // Invalidar cache para atualizar a UI
      queryClient.invalidateQueries({ queryKey: ["campaign"] });
      
      onSuccess?.();
    } catch (err) {
      console.error('Save error:', err);
      toast.error("Erro ao salvar lançamento");
    } finally {
      setIsSaving(false);
    }
  };

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
                <span>Data Entrada</span>
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
              <Select
                value={formData.tipo_brinde}
                onValueChange={(value) => handleInputChange("tipo_brinde", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o brinde" />
                </SelectTrigger>
                <SelectContent>
                  {BRINDE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <p className="text-sm text-muted-foreground">Crescimento (Calculado)</p>
                <p className={`text-2xl font-bold ${
                  crescimentoPositivo ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatPercent(crescimentoPercentual)}
                </p>
              </div>
            </div>
            <div className="text-left md:text-right">
              <p className="text-sm text-muted-foreground">Valor Incremento</p>
              <p className={`text-xl font-bold ${
                incrementoValor >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(incrementoValor)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção: ROI Calculado */}
      <Card className={`border-2 ${
        roiPositivo 
          ? 'border-green-200 bg-gradient-to-r from-green-50/50 to-transparent' 
          : 'border-red-200 bg-gradient-to-r from-red-50/50 to-transparent'
      }`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">ROI da Campanha (Calculado)</CardTitle>
          <CardDescription>Baseado no incremento de vendas vs verba orçada</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 rounded-xl bg-background/80">
              <p className={`text-5xl font-bold ${
                roiPositivo ? 'text-green-600' : 'text-red-600'
              }`}>
                {roiPercentual.toFixed(0)}%
              </p>
              <p className="text-sm text-muted-foreground mt-2">ROI Percentual</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-background/80">
              <p className={`text-3xl font-bold ${
                roiPositivo ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(incrementoValor)}
              </p>
              <p className="text-sm text-muted-foreground mt-2">Valor Absoluto</p>
            </div>
            <div className="flex items-center justify-center p-4 rounded-xl bg-background/80">
              <div className="text-center">
                <p className="text-lg font-semibold">{formatCurrency(custoBase)}</p>
                <p className="text-sm text-muted-foreground">Verba Orçada</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção: Upload de Evidências */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Camera className="h-5 w-5 text-primary" />
            Evidências (Fotos/Comprovantes)
          </CardTitle>
          <CardDescription>Anexe fotos da execução no PDV</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Upload Zone */}
          <div className="border-2 border-dashed rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
            <input
              type="file"
              id="evidencias"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            <label 
              htmlFor="evidencias" 
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              {isUploading ? (
                <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
              ) : (
                <Upload className="h-10 w-10 text-muted-foreground" />
              )}
              <span className="text-sm text-muted-foreground">
                {isUploading ? "Enviando..." : "Clique para adicionar fotos"}
              </span>
            </label>
          </div>

          {/* Preview das Evidências */}
          {evidencias.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {evidencias.map((url, index) => (
                <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border">
                  <img 
                    src={url} 
                    alt={`Evidência ${index + 1}`} 
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeEvidencia(index)}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botões de Ação */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" disabled={isSaving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar Lançamento
        </Button>
      </div>
    </div>
  );
}
