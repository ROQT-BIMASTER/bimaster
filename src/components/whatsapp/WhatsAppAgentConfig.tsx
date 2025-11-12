import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Bot, Save, RefreshCw, MessageSquare, Image, Calendar, Store } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function WhatsAppAgentConfig() {
  const [systemPrompt, setSystemPrompt] = useState(
    `Você é um assistente de vendas especializado em registrar lançamentos rápidos de produtos em lojas.

Seu objetivo é guiar o usuário pelo processo de registro de forma amigável e eficiente, coletando:
1. Nome da loja
2. Data do lançamento
3. Foto "antes" do produto
4. Foto "depois" do produto
5. Quantidade de faces do produto

Regras importantes:
- Seja cordial e profissional
- Confirme cada informação antes de avançar
- Use linguagem clara e objetiva
- Ao receber fotos, confirme o recebimento
- Valide datas no formato DD/MM/AAAA
- Aceite apenas números inteiros para quantidade de faces`
  );

  const [maxMessagesPerConversation, setMaxMessagesPerConversation] = useState("50");
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Aqui você pode salvar as configurações no banco de dados
      // Por enquanto, apenas simula o salvamento
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar configurações");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSystemPrompt(`Você é um assistente de vendas especializado em registrar lançamentos rápidos de produtos em lojas.

Seu objetivo é guiar o usuário pelo processo de registro de forma amigável e eficiente, coletando:
1. Nome da loja
2. Data do lançamento
3. Foto "antes" do produto
4. Foto "depois" do produto
5. Quantidade de faces do produto

Regras importantes:
- Seja cordial e profissional
- Confirme cada informação antes de avançar
- Use linguagem clara e objetiva
- Ao receber fotos, confirme o recebimento
- Valide datas no formato DD/MM/AAAA
- Aceite apenas números inteiros para quantidade de faces`);
    setMaxMessagesPerConversation("50");
    toast.info("Configurações resetadas para o padrão");
  };

  const flowSteps = [
    { icon: MessageSquare, label: "Início", description: "Saudação e apresentação" },
    { icon: Store, label: "Loja", description: "Identificação da loja" },
    { icon: Calendar, label: "Data", description: "Data do lançamento" },
    { icon: Image, label: "Foto Antes", description: "Upload da foto antes" },
    { icon: Image, label: "Foto Depois", description: "Upload da foto depois" },
    { icon: MessageSquare, label: "Faces", description: "Quantidade de faces" },
    { icon: Bot, label: "Conclusão", description: "Lançamento criado" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle>Configuração do Agente IA</CardTitle>
          </div>
          <CardDescription>
            Configure o comportamento e as regras do assistente de WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="system-prompt">Prompt do Sistema</Label>
            <Textarea
              id="system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Define a personalidade e as instruções principais do agente
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="max-messages">Máximo de Mensagens por Conversa</Label>
            <Input
              id="max-messages"
              type="number"
              value={maxMessagesPerConversation}
              onChange={(e) => setMaxMessagesPerConversation(e.target.value)}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Limite de mensagens antes de encerrar a conversa automaticamente
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isLoading}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? "Salvando..." : "Salvar Configurações"}
            </Button>
            <Button onClick={handleReset} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Resetar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fluxo de Conversação</CardTitle>
          <CardDescription>
            Sequência de passos que o agente segue durante a conversa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {flowSteps.map((step, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{step.label}</p>
                    <Badge variant="outline">Passo {index + 1}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comandos Disponíveis</CardTitle>
          <CardDescription>
            Comandos que os usuários podem usar durante a conversa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge variant="secondary" className="font-mono">/novo</Badge>
              <p className="text-sm text-muted-foreground">Inicia um novo registro de lançamento</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="secondary" className="font-mono">/cancelar</Badge>
              <p className="text-sm text-muted-foreground">Cancela o processo atual</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="secondary" className="font-mono">/ajuda</Badge>
              <p className="text-sm text-muted-foreground">Mostra ajuda e informações sobre o bot</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Limitações e Regras</CardTitle>
          <CardDescription>
            Restrições e validações aplicadas pelo agente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Aceita apenas imagens (JPEG, PNG) com tamanho máximo de 5MB</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Datas devem estar no formato DD/MM/AAAA ou palavra "hoje"</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Quantidade de faces deve ser um número inteiro positivo</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Conversa expira após 24 horas de inatividade</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Cada conversa suporta o registro de apenas um lançamento</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Nome da loja deve ter no mínimo 3 caracteres</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
