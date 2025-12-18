import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { 
  Plus, Trash2, RefreshCw, CheckCircle, AlertCircle, 
  Clock, ExternalLink, Settings, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface AdsAccountsManagerProps {
  onUpdate?: () => void;
}

const platformConfig = {
  google_ads: { 
    name: "Google Ads", 
    color: "bg-blue-500", 
    icon: "🔷",
    fields: ["Customer ID", "Client ID", "Client Secret", "Refresh Token"]
  },
  meta_ads: { 
    name: "Meta Ads", 
    color: "bg-blue-600", 
    icon: "📘",
    fields: ["Ad Account ID", "Access Token", "App ID", "App Secret"]
  },
  analytics: { 
    name: "Google Analytics", 
    color: "bg-orange-500", 
    icon: "📊",
    fields: ["Property ID", "Service Account JSON"]
  },
  tiktok_ads: { 
    name: "TikTok Ads", 
    color: "bg-black", 
    icon: "🎵",
    fields: ["Advertiser ID", "Access Token"]
  },
  linkedin_ads: { 
    name: "LinkedIn Ads", 
    color: "bg-blue-700", 
    icon: "💼",
    fields: ["Account ID", "Access Token"]
  }
};

export function AdsAccountsManager({ onUpdate }: AdsAccountsManagerProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [formData, setFormData] = useState({
    platform: "google_ads",
    account_name: "",
    account_id: "",
    credentials: {} as Record<string, string>
  });

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['ads-accounts-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ads_accounts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Não autenticado");

      const { error } = await supabase
        .from('ads_accounts')
        .insert({
          user_id: user.user.id,
          platform: data.platform,
          account_name: data.account_name,
          account_id: data.account_id,
          credentials: data.credentials,
          sync_status: 'pending'
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta adicionada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['ads-accounts-all'] });
      queryClient.invalidateQueries({ queryKey: ['ads-accounts'] });
      setDialogOpen(false);
      resetForm();
      onUpdate?.();
    },
    onError: (error: any) => {
      toast.error("Erro ao adicionar conta: " + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const { error } = await supabase
        .from('ads_accounts')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta atualizada!");
      queryClient.invalidateQueries({ queryKey: ['ads-accounts-all'] });
      queryClient.invalidateQueries({ queryKey: ['ads-accounts'] });
      onUpdate?.();
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar: " + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ads_accounts')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta removida!");
      queryClient.invalidateQueries({ queryKey: ['ads-accounts-all'] });
      queryClient.invalidateQueries({ queryKey: ['ads-accounts'] });
      onUpdate?.();
    },
    onError: (error: any) => {
      toast.error("Erro ao remover: " + error.message);
    }
  });

  const resetForm = () => {
    setFormData({
      platform: "google_ads",
      account_name: "",
      account_id: "",
      credentials: {}
    });
    setEditingAccount(null);
  };

  const handleSubmit = () => {
    if (!formData.account_name || !formData.account_id) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    createMutation.mutate(formData);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'syncing': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default: return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const selectedPlatformConfig = platformConfig[formData.platform as keyof typeof platformConfig];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Contas Conectadas</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Conta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Conta de Ads</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Plataforma</Label>
                <Select 
                  value={formData.platform} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, platform: v, credentials: {} }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(platformConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span>{config.icon}</span>
                          {config.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Nome da Conta</Label>
                <Input
                  placeholder="Ex: Conta Principal"
                  value={formData.account_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, account_name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>ID da Conta</Label>
                <Input
                  placeholder="Ex: 123-456-7890"
                  value={formData.account_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, account_id: e.target.value }))}
                />
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Credenciais (opcional)</p>
                {selectedPlatformConfig?.fields.map((field) => (
                  <div key={field} className="space-y-2 mb-3">
                    <Label className="text-xs">{field}</Label>
                    <Input
                      type="password"
                      placeholder={`Digite ${field}`}
                      value={formData.credentials[field] || ""}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        credentials: { ...prev.credentials, [field]: e.target.value }
                      }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : accounts?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h4 className="font-medium mb-2">Nenhuma conta conectada</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Adicione suas contas de Google Ads, Meta Ads ou Analytics para começar.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeira Conta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts?.map((account) => {
            const config = platformConfig[account.platform as keyof typeof platformConfig];
            return (
              <Card key={account.id} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{config?.icon}</span>
                      <div>
                        <CardTitle className="text-base">{account.account_name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{config?.name}</p>
                      </div>
                    </div>
                    {getStatusIcon(account.sync_status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ID:</span>
                      <span className="font-mono text-xs">{account.account_id}</span>
                    </div>
                    {account.last_sync_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Última sync:</span>
                        <span className="text-xs">
                          {format(new Date(account.last_sync_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={account.is_active}
                        onCheckedChange={(checked) => 
                          updateMutation.mutate({ id: account.id, is_active: checked })
                        }
                      />
                      <span className="text-xs text-muted-foreground">
                        {account.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8"
                        onClick={() => updateMutation.mutate({ id: account.id, sync_status: 'pending' })}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Tem certeza que deseja remover esta conta?")) {
                            deleteMutation.mutate(account.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            <strong>💡 Dica:</strong> Para sincronizar dados automaticamente, configure as credenciais de API 
            de cada plataforma. Os dados podem ser importados manualmente via CSV ou através de integrações 
            com ferramentas como n8n ou Zapier.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
