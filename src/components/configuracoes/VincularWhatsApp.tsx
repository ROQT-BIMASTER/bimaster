import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Phone, CheckCircle2, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function VincularWhatsApp() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [linked, setLinked] = useState(false);
  const [currentPhone, setCurrentPhone] = useState<string | null>(null);
  const { toast } = useToast();

  // Buscar vínculo existente ao carregar
  useEffect(() => {
    fetchCurrentLink();
  }, []);

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

    // Validar formato básico
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          WhatsApp - Lançamento Rápido
        </CardTitle>
        <CardDescription>
          Vincule seu número do WhatsApp para registrar lançamentos rápidos via conversa com IA
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
                    Você pode enviar mensagens para o WhatsApp do sistema para criar lançamentos rápidos.
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

        <div className="space-y-2">
          <Label htmlFor="phone">Número do WhatsApp</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+55 11 99999-9999"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            disabled={loading}
          />
          <p className="text-sm text-muted-foreground">
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

        <Alert>
          <AlertDescription>
            <strong>Como funciona:</strong>
            <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
              <li>Vincule seu número do WhatsApp aqui</li>
              <li>Envie "/novo" para o WhatsApp do sistema</li>
              <li>A IA vai guiar você passo a passo</li>
              <li>Colete: loja, fotos (antes/depois), faces, observações</li>
              <li>O lançamento é criado automaticamente no sistema</li>
            </ol>
          </AlertDescription>
        </Alert>

        <Alert>
          <AlertDescription>
            <strong>Comandos disponíveis:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li><code>/novo</code> - Iniciar novo lançamento</li>
              <li><code>/cancelar</code> - Cancelar lançamento atual</li>
              <li><code>/ajuda</code> - Ver ajuda</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
