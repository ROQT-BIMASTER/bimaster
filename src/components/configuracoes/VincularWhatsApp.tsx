import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Phone, CheckCircle2, XCircle, MessageSquare, Copy } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export function VincularWhatsApp() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [linked, setLinked] = useState(false);
  const [currentPhone, setCurrentPhone] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchCurrentLink();
    generateWebhookUrl();
  }, []);

  function generateWebhookUrl() {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const webhookPath = "/functions/v1/whatsapp-webhook";
    setWebhookUrl(`${baseUrl}${webhookPath}`);
  }

  async function fetchCurrentLink() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_whatsapp")
        .select("phone_number, verified")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setCurrentPhone(data.phone_number);
        setLinked(data.verified);
        setPhoneNumber(data.phone_number);
      }
    } catch (error) {
      console.error("Erro ao buscar vínculo:", error);
    }
  }

  async function handleLink() {
    if (!phoneNumber) {
      toast({
        title: "Erro",
        description: "Digite um número de telefone",
        variant: "destructive",
      });
      return;
    }

    const cleanNumber = phoneNumber.replace(/\D/g, "");
    if (cleanNumber.length < 10 || cleanNumber.length > 15) {
      toast({
        title: "Erro",
        description: "Número de telefone inválido. Use o formato internacional (ex: +5511999999999)",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("user_whatsapp")
        .upsert({
          user_id: user.id,
          phone_number: cleanNumber,
          verified: false,
        }, {
          onConflict: "user_id",
        });

      if (error) throw error;

      setCurrentPhone(cleanNumber);
      setLinked(false);

      toast({
        title: "Sucesso",
        description: "Número vinculado! Envie uma mensagem para o WhatsApp do sistema para verificar.",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlink() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("user_whatsapp")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;

      setCurrentPhone(null);
      setLinked(false);
      setPhoneNumber("");

      toast({
        title: "Sucesso",
        description: "Número desvinculado com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <MessageSquare className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <CardTitle>WhatsApp Business</CardTitle>
                <CardDescription>
                  Configure seu número do WhatsApp para lançamentos rápidos via IA
                </CardDescription>
              </div>
            </div>
            {linked && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Verificado
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentPhone && (
            <Alert className={linked ? "border-green-500" : "border-yellow-500"}>
              <div className="flex items-start gap-2">
                {linked ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-yellow-500" />
                )}
                <AlertDescription>
                  {linked ? (
                    <>
                      <strong>Número verificado:</strong> {currentPhone}
                      <br />
                      Você pode enviar mensagens para criar lançamentos rápidos.
                    </>
                  ) : (
                    <>
                      <strong>Número aguardando verificação:</strong> {currentPhone}
                      <br />
                      Envie qualquer mensagem para o WhatsApp do sistema para verificar.
                    </>
                  )}
                </AlertDescription>
              </div>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Número do WhatsApp *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+55 11 99999-9999"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Use o formato internacional com código do país (ex: +5511999999999)
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleLink}
                disabled={loading}
                className="flex-1"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {currentPhone ? "Atualizar Número" : "Vincular Número"}
              </Button>

              {currentPhone && (
                <Button
                  variant="destructive"
                  onClick={handleUnlink}
                  disabled={loading}
                >
                  Desvincular
                </Button>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>URL do Webhook (para desenvolvedores)</Label>
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  toast({
                    title: "Copiado!",
                    description: "URL copiada para área de transferência",
                  });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              URL para configuração do webhook no WhatsApp Business API
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Como Funciona
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Vincule seu número do WhatsApp aqui</li>
                <li>Envie <code className="bg-muted px-1 rounded">/novo</code> para o WhatsApp do sistema</li>
                <li>A IA vai guiar você passo a passo</li>
                <li>Colete: loja, fotos (antes/depois), faces, observações</li>
                <li>O lançamento é criado automaticamente no sistema</li>
              </ol>

              <Separator className="my-4" />

              <strong className="block mb-2">Comandos disponíveis:</strong>
              <ul className="space-y-1 text-sm">
                <li><code className="bg-muted px-1 rounded">/novo</code> - Iniciar novo lançamento</li>
                <li><code className="bg-muted px-1 rounded">/cancelar</code> - Cancelar lançamento atual</li>
                <li><code className="bg-muted px-1 rounded">/ajuda</code> - Ver ajuda</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
