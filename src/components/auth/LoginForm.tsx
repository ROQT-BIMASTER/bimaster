import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(255, "Email deve ter no máximo 255 caracteres")
    .toLowerCase(),
  password: z
    .string()
    .min(6, "Senha deve ter no mínimo 6 caracteres")
    .max(100, "Senha deve ter no máximo 100 caracteres"),
});

export const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "✅ Conexão restaurada",
        description: "Você está online novamente",
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "⚠️ Sem conexão",
        description: "Você está offline. Algumas funcionalidades podem não funcionar.",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isOnline) {
      toast({
        title: "Sem conexão",
        description: "Você precisa estar online para fazer login. Conecte-se à internet e tente novamente.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const validated = loginSchema.parse({ email, password });
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: "Erro ao fazer login",
            description: "Email ou senha incorretos",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro ao fazer login",
            description: error.message,
            variant: "destructive",
          });
        }
        return;
      }

      if (data.user) {
        toast({
          title: "Login realizado!",
          description: "Bem-vindo de volta",
        });
        navigate("/dashboard");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Erro de validação",
          description: error.errors[0].message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Acesse sua conta para continuar</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={255}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={100}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !isOnline}>
            {loading ? "Entrando..." : isOnline ? "Entrar" : "Sem conexão"}
          </Button>
          {!isOnline && (
            <p className="text-sm text-destructive text-center">
              ⚠️ Você está offline. Conecte-se para fazer login.
            </p>
          )}
          <div className="text-center text-sm">
            <span className="text-muted-foreground">Não tem uma conta? </span>
            <Button
              type="button"
              variant="link"
              className="p-0"
              onClick={() => navigate("/auth/signup")}
            >
              Cadastre-se
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
