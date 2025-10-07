import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  Brain, MapPin, CreditCard, Mail, CheckCircle2, 
  XCircle, ExternalLink, Info, Copy, Eye, EyeOff 
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface IntegrationConfig {
  id: string;
  name: string;
  description: string;
  icon: any;
  status: "active" | "inactive" | "pending";
  secretName: string;
  instructions: {
    title: string;
    steps: string[];
    link?: string;
  };
  testConnection?: () => Promise<boolean>;
}

export const GerenciamentoIntegracoes = () => {
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  const integrations: IntegrationConfig[] = [
    {
      id: "lovable-ai",
      name: "Lovable AI",
      description: "IA para análise de fotos e insights automáticos",
      icon: Brain,
      status: "active",
      secretName: "LOVABLE_API_KEY",
      instructions: {
        title: "Lovable AI já está configurado automaticamente",
        steps: [
          "✅ A chave LOVABLE_API_KEY é fornecida automaticamente",
          "✅ Não é necessária nenhuma configuração adicional",
          "✅ A IA está pronta para analisar fotos de PDVs",
        ],
      },
    },
    {
      id: "mapbox",
      name: "Mapbox",
      description: "Mapas interativos e geolocalização",
      icon: MapPin,
      status: "pending",
      secretName: "MAPBOX_ACCESS_TOKEN",
      instructions: {
        title: "Como obter seu token do Mapbox",
        steps: [
          "1. Acesse https://account.mapbox.com/",
          "2. Crie uma conta gratuita ou faça login",
          "3. Vá para 'Access Tokens' no menu",
          "4. Clique em 'Create a token'",
          "5. Dê um nome ao token (ex: 'Trade Marketing App')",
          "6. Mantenha todos os escopos padrão selecionados",
          "7. Clique em 'Create token'",
          "8. Copie o token e cole no campo abaixo",
        ],
        link: "https://account.mapbox.com/access-tokens/",
      },
      testConnection: async () => {
        try {
          const { data, error } = await supabase.functions.invoke('get-mapbox-token');
          return !error && !!data?.token;
        } catch {
          return false;
        }
      },
    },
    {
      id: "stripe",
      name: "Stripe",
      description: "Pagamentos e cobranças (opcional)",
      icon: CreditCard,
      status: "inactive",
      secretName: "STRIPE_SECRET_KEY",
      instructions: {
        title: "Como obter sua chave secreta do Stripe",
        steps: [
          "1. Acesse https://dashboard.stripe.com/",
          "2. Crie uma conta ou faça login",
          "3. No menu lateral, clique em 'Developers'",
          "4. Clique em 'API keys'",
          "5. Na seção 'Secret key', clique em 'Reveal test key'",
          "6. Copie a chave que começa com 'sk_test_'",
          "7. Para produção, use a 'Live key' (sk_live_)",
          "⚠️ IMPORTANTE: Mantenha esta chave em segredo!",
        ],
        link: "https://dashboard.stripe.com/apikeys",
      },
    },
    {
      id: "resend",
      name: "Resend",
      description: "Envio de emails transacionais (opcional)",
      icon: Mail,
      status: "inactive",
      secretName: "RESEND_API_KEY",
      instructions: {
        title: "Como obter sua chave da API Resend",
        steps: [
          "1. Acesse https://resend.com/",
          "2. Crie uma conta gratuita ou faça login",
          "3. Verifique seu domínio em https://resend.com/domains",
          "4. Vá para https://resend.com/api-keys",
          "5. Clique em 'Create API Key'",
          "6. Dê um nome à chave (ex: 'Trade Marketing')",
          "7. Selecione as permissões necessárias",
          "8. Copie a chave gerada",
          "⚠️ Você só verá esta chave uma vez!",
        ],
        link: "https://resend.com/api-keys",
      },
    },
  ];

  const handleCopyInstructions = (integration: IntegrationConfig) => {
    const text = integration.instructions.steps.join('\n');
    navigator.clipboard.writeText(text);
    toast.success("Instruções copiadas!");
  };

  const handleTestConnection = async (integration: IntegrationConfig) => {
    if (!integration.testConnection) {
      toast.info("Teste de conexão não disponível para esta integração");
      return;
    }

    setTestingConnection(integration.id);
    try {
      const success = await integration.testConnection();
      if (success) {
        toast.success(`${integration.name} está conectado e funcionando!`);
      } else {
        toast.error(`${integration.name} não está configurado ou há um problema na conexão.`);
      }
    } catch (error) {
      toast.error("Erro ao testar conexão");
    } finally {
      setTestingConnection(null);
    }
  };

  const toggleShowSecret = (integrationId: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [integrationId]: !prev[integrationId]
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Integrações de API</h3>
        <p className="text-sm text-muted-foreground">
          Configure as APIs necessárias para o funcionamento completo do sistema
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Dica de Segurança:</strong> Nunca compartilhe suas chaves de API publicamente. 
          Elas são armazenadas de forma segura e criptografada no backend.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          return (
            <Card key={integration.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {integration.name}
                        <Badge
                          variant={
                            integration.status === "active"
                              ? "default"
                              : integration.status === "pending"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {integration.status === "active" && (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          )}
                          {integration.status === "inactive" && (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          {integration.status === "active"
                            ? "Ativo"
                            : integration.status === "pending"
                            ? "Pendente"
                            : "Inativo"}
                        </Badge>
                      </CardTitle>
                      <CardDescription>{integration.description}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="instructions" className="border-none">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        Instruções de Configuração
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        <div>
                          <h4 className="font-semibold mb-2">
                            {integration.instructions.title}
                          </h4>
                          <ol className="space-y-1 text-sm text-muted-foreground">
                            {integration.instructions.steps.map((step, index) => (
                              <li key={index} className="leading-relaxed">
                                {step}
                              </li>
                            ))}
                          </ol>
                        </div>

                        <div className="flex gap-2">
                          {integration.instructions.link && (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <a
                                href={integration.instructions.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="gap-2"
                              >
                                Abrir Console
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyInstructions(integration)}
                            className="gap-2"
                          >
                            <Copy className="h-3 w-3" />
                            Copiar Instruções
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {integration.status !== "active" && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="space-y-2">
                      <Label htmlFor={`api-key-${integration.id}`}>
                        Chave de API ({integration.secretName})
                      </Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id={`api-key-${integration.id}`}
                            type={showSecrets[integration.id] ? "text" : "password"}
                            placeholder="Cole sua chave de API aqui"
                            className="pr-10"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => toggleShowSecret(integration.id)}
                          >
                            {showSecrets[integration.id] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <Button>Salvar</Button>
                      </div>
                    </div>

                    {integration.testConnection && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestConnection(integration)}
                        disabled={testingConnection === integration.id}
                        className="w-full"
                      >
                        {testingConnection === integration.id
                          ? "Testando..."
                          : "Testar Conexão"}
                      </Button>
                    )}
                  </div>
                )}

                {integration.status === "active" && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Esta integração está configurada e funcionando corretamente.
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Precisa de ajuda?</strong> As integrações marcadas como "Opcional" não são 
          necessárias para o funcionamento básico do sistema. Configure-as apenas se precisar 
          dos recursos específicos que elas oferecem.
        </AlertDescription>
      </Alert>
    </div>
  );
};
