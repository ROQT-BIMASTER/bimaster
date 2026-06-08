import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

const signupSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Informe seu nome completo")
    .max(120, "Nome deve ter no máximo 120 caracteres"),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(255, "Email deve ter no máximo 255 caracteres")
    .toLowerCase(),
  password: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres")
    .max(100, "A senha deve ter no máximo 100 caracteres"),
  confirmPassword: z.string(),
}).strict().refine((d) => d.password === d.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

export const SignupForm = () => {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (honeypot) {
      await new Promise((r) => setTimeout(r, 1200));
      toast.error("Erro ao criar conta", { description: "Tente novamente em instantes." });
      return;
    }

    try {
      const validated = signupSchema.parse({ nome, email, password, confirmPassword });
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          data: { nome: validated.nome },
          emailRedirectTo: `${window.location.origin}/aguardando-aprovacao`,
        },
      });

      if (error) {
        const msg = error.message?.toLowerCase() ?? "";
        if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
          toast.error("Email já cadastrado", {
            description: "Use o link 'Entrar' ou recupere sua senha.",
          });
        } else if (msg.includes("password")) {
          toast.error("Senha não atende aos requisitos", { description: error.message });
        } else {
          toast.error("Erro ao criar conta", { description: error.message });
        }
        return;
      }

      // Se o e-mail já foi confirmado automaticamente, tentamos logar e cair na fila de aprovação.
      if (data.session) {
        toast.success("Cadastro realizado", {
          description: "Sua conta está aguardando aprovação do administrador.",
        });
        navigate("/aguardando-aprovacao", { replace: true });
        return;
      }

      // Fallback: caso a sessão não venha (ex.: confirmação por e-mail ativada)
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (loginError) {
        toast.success("Cadastro recebido", {
          description: "Verifique seu e-mail para concluir o cadastro e aguardar a aprovação.",
        });
        navigate("/auth/login", { replace: true });
        return;
      }

      toast.success("Cadastro realizado", {
        description: "Sua conta está aguardando aprovação do administrador.",
      });
      navigate("/aguardando-aprovacao", { replace: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error("Erro de validação", { description: error.errors[0].message });
        return;
      }
      logger.error("[SignupForm] erro:", error);
      toast.error("Erro ao criar conta", { description: "Tente novamente em instantes." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          Criar conta
        </CardTitle>
        <CardDescription>
          Cadastre-se para solicitar acesso ao sistema. Seu acesso ficará pendente de aprovação por um administrador.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome completo</Label>
            <Input
              id="nome"
              type="text"
              placeholder="Seu nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              maxLength={120}
              autoComplete="name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email corporativo</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={255}
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={100}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              placeholder="Repita a senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              maxLength={100}
              autoComplete="new-password"
            />
          </div>

          {/* Honeypot */}
          <div
            aria-hidden="true"
            style={{ position: "absolute", left: "-9999px", top: "-9999px", opacity: 0, height: 0, overflow: "hidden" }}
          >
            <label htmlFor="company-website">Website</label>
            <input
              id="company-website"
              name="company-website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Enviando solicitação..." : "Criar conta e solicitar acesso"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Ao criar a conta você concorda com a Política de Privacidade. Seu acesso só será liberado após aprovação do administrador.
          </p>

          <p className="text-center text-sm text-muted-foreground">
            Já tem uma conta?{" "}
            <Link to="/auth/login" className="text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
};
