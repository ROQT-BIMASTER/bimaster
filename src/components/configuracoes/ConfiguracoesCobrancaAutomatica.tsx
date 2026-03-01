import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Bot, 
  Clock, 
  Key, 
  MessageSquare, 
  Mail, 
  Shield, 
  Eye, 
  EyeOff,
  CheckCircle,
  AlertCircle,
  Copy,
  RefreshCw,
  HelpCircle,
  ExternalLink
} from "lucide-react";

interface CobrancaConfig {
  id?: string;
  api_key: string;
  whatsapp_verify_token: string;
  automacao_ativa: boolean;
  hora_inicio_envio: string;
  hora_fim_envio: string;
  max_envios_hora: number;
  intervalo_minimo_dias: number;
  email_remetente: string;
  nome_remetente: string;
}

export function ConfiguracoesCobrancaAutomatica() {
  const [config, setConfig] = useState<CobrancaConfig>({
    api_key: "",
    whatsapp_verify_token: "",
    automacao_ativa: false,
    hora_inicio_envio: "08:00",
    hora_fim_envio: "18:00",
    max_envios_hora: 50,
    intervalo_minimo_dias: 3,
    email_remetente: "",
    nome_remetente: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showVerifyToken, setShowVerifyToken] = useState(false);
  const { toast } = useToast();

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cobranca-whatsapp-webhook`;

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      // Read from safe view (tokens are masked as '***')
      const { data, error } = await supabase
        .from("configuracoes_cobranca_safe" as any)
        .select("*")
        .single();

      if (error && error.code !== "PGRST116") throw error;
      
      if (data) {
        const d = data as any;
        setConfig({
          id: d.id,
          api_key: d.api_key || "",
          whatsapp_verify_token: d.whatsapp_verify_token || "",
          automacao_ativa: d.automacao_ativa || false,
          hora_inicio_envio: d.hora_inicio_envio || "08:00",
          hora_fim_envio: d.hora_fim_envio || "18:00",
          max_envios_hora: d.max_envios_hora || 50,
          intervalo_minimo_dias: d.intervalo_minimo_dias || 3,
          email_remetente: d.email_remetente || "",
          nome_remetente: d.nome_remetente || ""
        });
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const configData = {
        api_key: config.api_key,
        whatsapp_verify_token: config.whatsapp_verify_token,
        automacao_ativa: config.automacao_ativa,
        hora_inicio_envio: config.hora_inicio_envio,
        hora_fim_envio: config.hora_fim_envio,
        max_envios_hora: config.max_envios_hora,
        intervalo_minimo_dias: config.intervalo_minimo_dias,
        email_remetente: config.email_remetente,
        nome_remetente: config.nome_remetente,
        updated_by: user.id
      };

      if (config.id) {
        const { error } = await supabase
          .from("configuracoes_cobranca" as any)
          .update(configData)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("configuracoes_cobranca" as any)
          .insert({ ...configData, created_by: user.id })
          .select()
          .single();
        if (error) throw error;
        setConfig(prev => ({ ...prev, id: (data as any).id }));
      }

      toast({
        title: "Configurações salvas",
        description: "As configurações de cobrança automática foram atualizadas"
      });
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const generateApiKey = () => {
    const key = `cobranca_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    setConfig(prev => ({ ...prev, api_key: key }));
  };

  const generateVerifyToken = () => {
    const token = `verify_${Math.random().toString(36).substring(2, 20)}`;
    setConfig(prev => ({ ...prev, whatsapp_verify_token: token }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${label} copiado para a área de transferência`
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Cobrança Automática
          </CardTitle>
          <CardDescription>
            Configure o processamento automático de cobranças por email e WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Ativar Automação</Label>
              <p className="text-sm text-muted-foreground">
                Habilita o processamento automático da fila de cobranças
              </p>
            </div>
            <Switch
              checked={config.automacao_ativa}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, automacao_ativa: checked }))}
            />
          </div>
          
          <div className="mt-4 flex items-center gap-2">
            <Badge variant={config.automacao_ativa ? "default" : "secondary"}>
              {config.automacao_ativa ? (
                <><CheckCircle className="h-3 w-3 mr-1" /> Ativo</>
              ) : (
                <><AlertCircle className="h-3 w-3 mr-1" /> Inativo</>
              )}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {config.automacao_ativa 
                ? "Cobranças serão processadas automaticamente a cada hora"
                : "Processamento manual necessário"
              }
            </span>
          </div>
        </CardContent>
      </Card>

      {/* API Keys Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Chaves de API
          </CardTitle>
          <CardDescription>
            Configure as chaves para autenticação dos webhooks e integrações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* API Key */}
          <div className="space-y-2">
            <Label>API Key (Autenticação)</Label>
            <p className="text-sm text-muted-foreground">
              Usada para autenticar chamadas do pg_cron e integrações externas (N8N)
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={config.api_key}
                  onChange={(e) => setConfig(prev => ({ ...prev, api_key: e.target.value }))}
                  placeholder="Insira ou gere uma API Key"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-8 top-0 h-full"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => copyToClipboard(config.api_key, "API Key")}
                  disabled={!config.api_key}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" onClick={generateApiKey}>
                Gerar
              </Button>
            </div>
          </div>

          <Separator />

          {/* WhatsApp Verify Token */}
          <div className="space-y-2">
            <Label>WhatsApp Verify Token</Label>
            <p className="text-sm text-muted-foreground">
              Token para verificação do webhook pelo Meta Business ou Twilio
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showVerifyToken ? "text" : "password"}
                  value={config.whatsapp_verify_token}
                  onChange={(e) => setConfig(prev => ({ ...prev, whatsapp_verify_token: e.target.value }))}
                  placeholder="Insira ou gere um token de verificação"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-8 top-0 h-full"
                  onClick={() => setShowVerifyToken(!showVerifyToken)}
                >
                  {showVerifyToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => copyToClipboard(config.whatsapp_verify_token, "Verify Token")}
                  disabled={!config.whatsapp_verify_token}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" onClick={generateVerifyToken}>
                Gerar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook URL Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Webhook WhatsApp
          </CardTitle>
          <CardDescription>
            URL para configurar no Meta Business, Twilio ou N8N
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL do Webhook</Label>
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button 
                variant="outline" 
                onClick={() => copyToClipboard(webhookUrl, "URL do Webhook")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <p className="text-sm font-medium">Endpoints disponíveis:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li><code className="text-xs bg-background px-1 rounded">/status</code> - Receber confirmação de entrega</li>
              <li><code className="text-xs bg-background px-1 rounded">/enviar</code> - Enviar WhatsApp (Twilio ou prepara N8N)</li>
              <li><code className="text-xs bg-background px-1 rounded">/pendentes-whatsapp</code> - N8N busca pendentes</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Agendamento
          </CardTitle>
          <CardDescription>
            Configure os horários e limites de envio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hora Início</Label>
              <Input
                type="time"
                value={config.hora_inicio_envio}
                onChange={(e) => setConfig(prev => ({ ...prev, hora_inicio_envio: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Hora Fim</Label>
              <Input
                type="time"
                value={config.hora_fim_envio}
                onChange={(e) => setConfig(prev => ({ ...prev, hora_fim_envio: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Máx. Envios/Hora</Label>
              <Input
                type="number"
                value={config.max_envios_hora}
                onChange={(e) => setConfig(prev => ({ ...prev, max_envios_hora: parseInt(e.target.value) || 50 }))}
                min={1}
                max={200}
              />
            </div>
            <div className="space-y-2">
              <Label>Intervalo Mínimo (dias)</Label>
              <Input
                type="number"
                value={config.intervalo_minimo_dias}
                onChange={(e) => setConfig(prev => ({ ...prev, intervalo_minimo_dias: parseInt(e.target.value) || 3 }))}
                min={1}
                max={30}
              />
              <p className="text-xs text-muted-foreground">
                Dias entre cobranças para o mesmo cliente
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Sender Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Remetente
          </CardTitle>
          <CardDescription>
            Configure seu e-mail corporativo para envio das cobranças automáticas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step-by-step instructions */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="instructions" className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  <span className="font-medium">Como configurar seu e-mail corporativo no Resend</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</div>
                      <div className="space-y-1">
                        <p className="font-medium">Acesse o Resend</p>
                        <p className="text-sm text-muted-foreground">
                          Vá para{" "}
                          <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">
                            resend.com <ExternalLink className="h-3 w-3" />
                          </a>{" "}
                          e faça login ou crie uma conta gratuita.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
                      <div className="space-y-1">
                        <p className="font-medium">Adicione seu domínio</p>
                        <p className="text-sm text-muted-foreground">
                          Acesse{" "}
                          <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">
                            Domains <ExternalLink className="h-3 w-3" />
                          </a>{" "}
                          no menu lateral e clique em <strong>"Add Domain"</strong>. Digite seu domínio (ex: suaempresa.com.br).
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</div>
                      <div className="space-y-1">
                        <p className="font-medium">Configure os registros DNS</p>
                        <p className="text-sm text-muted-foreground">
                          O Resend mostrará 3 tipos de registros que você deve adicionar no painel do seu provedor de domínio:
                        </p>
                        <ul className="text-sm text-muted-foreground list-disc list-inside pl-2 space-y-1">
                          <li><strong>TXT</strong> - Para verificação de propriedade e SPF</li>
                          <li><strong>CNAME</strong> - Para assinatura DKIM</li>
                          <li><strong>MX</strong> (opcional) - Para receber respostas</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">4</div>
                      <div className="space-y-1">
                        <p className="font-medium">Adicione no seu provedor DNS</p>
                        <p className="text-sm text-muted-foreground">
                          Acesse o painel do seu provedor (Registro.br, GoDaddy, Cloudflare, Hostinger, etc.) e adicione os registros DNS exibidos pelo Resend.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">5</div>
                      <div className="space-y-1">
                        <p className="font-medium">Aguarde a verificação</p>
                        <p className="text-sm text-muted-foreground">
                          Clique em <strong>"Verify DNS Records"</strong> no Resend. A propagação pode levar de alguns minutos até 48 horas. 
                          O status mudará para <Badge variant="outline" className="text-green-600 border-green-600 ml-1">Verified</Badge> quando estiver pronto.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">6</div>
                      <div className="space-y-1">
                        <p className="font-medium">Configure aqui</p>
                        <p className="text-sm text-muted-foreground">
                          Após verificar, preencha os campos abaixo com o nome e e-mail do remetente (ex: cobranca@suaempresa.com.br).
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <p>
                      <strong>Atenção:</strong> Sem verificar o domínio, os e-mails serão enviados como "onboarding@resend.dev" e podem cair no spam do destinatário.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome do Remetente</Label>
              <Input
                value={config.nome_remetente}
                onChange={(e) => setConfig(prev => ({ ...prev, nome_remetente: e.target.value }))}
                placeholder="Ex: Financeiro - Sua Empresa"
              />
              <p className="text-xs text-muted-foreground">
                Nome que aparecerá para o destinatário
              </p>
            </div>
            <div className="space-y-2">
              <Label>E-mail Remetente</Label>
              <Input
                type="email"
                value={config.email_remetente}
                onChange={(e) => setConfig(prev => ({ ...prev, email_remetente: e.target.value }))}
                placeholder="Ex: cobranca@suaempresa.com.br"
              />
              <p className="text-xs text-muted-foreground">
                E-mail corporativo (domínio deve estar verificado)
              </p>
            </div>
          </div>

          {config.email_remetente && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                E-mails serão enviados como: <strong>{config.nome_remetente || "Cobrança"} &lt;{config.email_remetente}&gt;</strong>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Channels Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Canais Configurados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Email (Resend)</p>
                <p className="text-sm text-muted-foreground">
                  {config.email_remetente ? config.email_remetente : "Usando domínio padrão"}
                </p>
              </div>
              <Badge variant={config.email_remetente ? "default" : "secondary"} className="ml-auto">
                {config.email_remetente ? "Personalizado" : "Padrão"}
              </Badge>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <MessageSquare className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium">WhatsApp</p>
                <p className="text-sm text-muted-foreground">Via webhook externo</p>
              </div>
              <Badge variant={config.whatsapp_verify_token ? "default" : "secondary"} className="ml-auto">
                {config.whatsapp_verify_token ? "Configurado" : "Pendente"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar Configurações"
          )}
        </Button>
      </div>
    </div>
  );
}
