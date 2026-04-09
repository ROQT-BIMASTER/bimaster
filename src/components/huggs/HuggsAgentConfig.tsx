import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Bot, 
  Settings2, 
  Zap, 
  Save, 
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Code,
  MessageSquare,
  BarChart3,
  FileText
} from 'lucide-react';
import { useHuggsAgent } from '@/hooks/useHuggsAgent';

export function HuggsAgentConfig() {
  const { config, loadConfig, updateConfig, isLoading } = useHuggsAgent();
  
  const [localConfig, setLocalConfig] = useState({
    name: '',
    description: '',
    systemPrompt: '',
    model: 'gpt-4.1-mini',
    temperature: 0.7,
    maxTokens: 4000,
    n8nWorkflowId: '',
    n8nWebhookUrl: '',
    isActive: true,
    capabilities: [] as string[]
  });

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (config) {
      setLocalConfig({
        name: config.name,
        description: config.description,
        systemPrompt: config.systemPrompt,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        n8nWorkflowId: config.n8nWorkflowId,
        n8nWebhookUrl: config.n8nWebhookUrl,
        isActive: config.isActive,
        capabilities: config.capabilities
      });
    }
  }, [config]);

  useEffect(() => {
    if (config) {
      const changed = 
        localConfig.name !== config.name ||
        localConfig.description !== config.description ||
        localConfig.systemPrompt !== config.systemPrompt ||
        localConfig.temperature !== config.temperature ||
        localConfig.maxTokens !== config.maxTokens ||
        localConfig.n8nWebhookUrl !== config.n8nWebhookUrl ||
        localConfig.isActive !== config.isActive;
      
      setHasChanges(changed);
    }
  }, [localConfig, config]);

  const handleSave = async () => {
    await updateConfig(localConfig);
    setHasChanges(false);
  };

  const handleReset = () => {
    if (config) {
      setLocalConfig({
        name: config.name,
        description: config.description,
        systemPrompt: config.systemPrompt,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        n8nWorkflowId: config.n8nWorkflowId,
        n8nWebhookUrl: config.n8nWebhookUrl,
        isActive: config.isActive,
        capabilities: config.capabilities
      });
      setHasChanges(false);
    }
  };

  const capabilityLabels: Record<string, { label: string; icon: any }> = {
    reports: { label: 'Relatórios', icon: FileText },
    charts: { label: 'Gráficos', icon: BarChart3 },
    data_analysis: { label: 'Análise de Dados', icon: BarChart3 },
    lovable_mcp: { label: 'Bimaster MCP', icon: Zap },
    department_analytics: { label: 'Analytics por Departamento', icon: BarChart3 }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle>Configuração do Agente Huggs</CardTitle>
                <CardDescription>
                  Personalize o comportamento e integrações do assistente IA
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Ativo</span>
                <Switch
                  checked={localConfig.isActive}
                  onCheckedChange={(checked) => setLocalConfig(prev => ({ ...prev, isActive: checked }))}
                />
              </div>
              
              {hasChanges && (
                <>
                  <Button variant="outline" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Resetar
                  </Button>
                  <Button onClick={handleSave} disabled={isLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="prompt">Prompt do Sistema</TabsTrigger>
          <TabsTrigger value="n8n">Integração n8n</TabsTrigger>
          <TabsTrigger value="capabilities">Capacidades</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configurações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Agente</Label>
                  <Input
                    value={localConfig.name}
                    onChange={(e) => setLocalConfig(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Agente Huggs"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Modelo</Label>
                  <Input
                    value={localConfig.model}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Modelo fixo: Gemini 2.5 Flash via Bimaster AI
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={localConfig.description}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrição do agente..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Temperatura: {localConfig.temperature}</Label>
                </div>
                <Slider
                  value={[localConfig.temperature]}
                  onValueChange={([value]) => setLocalConfig(prev => ({ ...prev, temperature: value }))}
                  min={0}
                  max={1}
                  step={0.1}
                />
                <p className="text-xs text-muted-foreground">
                  Valores menores = respostas mais focadas. Valores maiores = respostas mais criativas.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Máximo de Tokens</Label>
                <Input
                  type="number"
                  value={localConfig.maxTokens}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 4000 }))}
                  min={500}
                  max={8000}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Prompt */}
        <TabsContent value="prompt">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Prompt do Sistema</CardTitle>
              <CardDescription>
                Define a personalidade e comportamento base do agente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={localConfig.systemPrompt}
                onChange={(e) => setLocalConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
                placeholder="Você é o Agente Huggs, um assistente de análise de dados empresariais..."
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Este prompt é enviado antes de cada conversa para definir o contexto do agente.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* n8n Integration */}
        <TabsContent value="n8n">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-5 w-5 text-orange-500" />
                Integração com n8n
              </CardTitle>
              <CardDescription>
                O agente está conectado ao workflow n8n via MCP
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Workflow Conectado</AlertTitle>
                <AlertDescription>
                  O workflow "Agente de Atendimento Huggs" está ativo e conectado via MCP.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Workflow ID</Label>
                <div className="flex gap-2">
                  <Input
                    value={localConfig.n8nWorkflowId}
                    disabled
                    className="bg-muted font-mono"
                  />
                  <Button variant="outline" size="icon" asChild>
                    <a 
                      href="https://huggs.app.n8n.cloud" 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Webhook URL (opcional)</Label>
                <Input
                  value={localConfig.n8nWebhookUrl}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, n8nWebhookUrl: e.target.value }))}
                  placeholder="https://huggs.app.n8n.cloud/webhook/..."
                />
                <p className="text-xs text-muted-foreground">
                  URL alternativa para chamar o workflow diretamente
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-sm">Ferramentas Disponíveis no Workflow:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Chat Trigger</strong> - Recebe mensagens do chat</li>
                  <li>• <strong>AI Consultant Agent</strong> - Agente principal com GPT-4.1-mini</li>
                  <li>• <strong>Generate Report Tool</strong> - Gera relatórios estruturados</li>
                  <li>• <strong>Generate Chart Tool</strong> - Cria visualizações de dados</li>
                  <li>• <strong>Bimaster MCP Tools</strong> - Acesso aos dados do sistema</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Capabilities */}
        <TabsContent value="capabilities">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Capacidades do Agente</CardTitle>
              <CardDescription>
                Funcionalidades habilitadas para o agente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(capabilityLabels).map(([key, { label, icon: Icon }]) => (
                  <div
                    key={key}
                    className={`p-4 rounded-lg border flex items-center gap-3 ${
                      localConfig.capabilities.includes(key) 
                        ? 'bg-primary/5 border-primary' 
                        : 'bg-muted/30'
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      localConfig.capabilities.includes(key)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">
                        {localConfig.capabilities.includes(key) ? 'Habilitado' : 'Desabilitado'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
