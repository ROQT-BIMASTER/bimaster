import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { ArrowLeft, Mail } from "lucide-react";

const emailSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255).toLowerCase(),
});

export const ForgotPasswordForm = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validated = emailSchema.parse({ email });
      setLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(validated.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }

      setSent(true);
      toast({ title: "Email enviado!", description: "Verifique sua caixa de entrada para redefinir a senha." });
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({ title: "Erro de validação", description: err.errors[0].message, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recuperar Senha</CardTitle>
        <CardDescription>
          {sent
            ? "Verifique seu email para o link de redefinição de senha."
            : "Informe seu email para receber o link de redefinição."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Se o email estiver cadastrado, você receberá um link para redefinir sua senha.
            </p>
            <Button variant="outline" asChild className="w-full">
              <Link to="/auth/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao login
              </Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recovery-email">Email</Label>
              <Input
                id="recovery-email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Enviando..." : "Enviar link de recuperação"}
            </Button>
            <Button variant="ghost" asChild className="w-full">
              <Link to="/auth/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao login
              </Link>
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
};
