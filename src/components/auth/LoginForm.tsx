import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Lock, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import { MFAVerifyDialog } from "./MFAVerifyDialog";

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

const ROLE_REDIRECT_TIMEOUT = 3000;

const fetchUserRoleWithTimeout = async (userId: string): Promise<string | null> => {
  try {
    const result = await Promise.race([
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), ROLE_REDIRECT_TIMEOUT)
      ),
    ]);
    if (result.error) return null;
    return result.data?.role ?? null;
  } catch {
    return null;
  }
};

export const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lockout, setLockout] = useState<{ locked: boolean; remaining_seconds?: number; remaining_attempts?: number } | null>(null);
  const [lockoutCountdown, setLockoutCountdown] = useState(0);
  const [lastSubmitTime, setLastSubmitTime] = useState(0);
  const [showMFA, setShowMFA] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({ title: "✅ Conexão restaurada", description: "Você está online novamente" });
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast({ title: "⚠️ Sem conexão", description: "Você está offline. Algumas funcionalidades podem não funcionar.", variant: "destructive" });
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  // Countdown timer for lockout
  useEffect(() => {
    if (lockoutCountdown <= 0) return;
    const timer = setInterval(() => {
      setLockoutCountdown((prev) => {
        if (prev <= 1) {
          setLockout(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutCountdown]);

  const checkLockout = async (emailToCheck: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc("check_account_lockout", { p_email: emailToCheck });
      if (error) {
        console.error("[LoginForm] Lockout check error:", error);
        return false;
      }
      const result = data as unknown as { locked: boolean; remaining_seconds?: number; remaining_attempts?: number; failed_count?: number };
      if (result?.locked) {
        setLockout(result);
        setLockoutCountdown(result.remaining_seconds || 0);
        return true;
      }
      setLockout(result);
      return false;
    } catch {
      return false;
    }
  };

  const recordAttempt = async (attemptEmail: string, success: boolean) => {
    try {
      await supabase.rpc("record_login_attempt", {
        p_email: attemptEmail,
        p_success: success,
        p_ip: null,
      });
    } catch {
      // Non-blocking
    }
  };

  const handleMFASuccess = () => {
    setShowMFA(false);
    toast({ title: "Login realizado!", description: "Autenticação em duas etapas verificada" });
    navigateAfterLogin();
  };

  const navigateAfterLogin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    navigate("/dashboard", { replace: true });

    fetchUserRoleWithTimeout(session.user.id).then((role) => {
      if (role === "cliente") {
        Promise.resolve(
          supabase.rpc("registrar_acesso_portal", { p_acao: "login", p_detalhes: {} })
        ).catch(() => {});
        navigate("/portal/precos", { replace: true });
      }
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isOnline) {
      toast({ title: "Sem conexão", description: "Você precisa estar online para fazer login.", variant: "destructive" });
      return;
    }

    try {
      // Honeypot check — bots fill hidden fields
      if (honeypot) {
        console.warn("Bot detected via honeypot");
        // Simulate delay to not reveal detection
        await new Promise(r => setTimeout(r, 1500));
        toast({ title: "Erro ao fazer login", description: "Email ou senha incorretos", variant: "destructive" });
        return;
      }

      // Client-side rate limit — min 2s between submissions
      const now = Date.now();
      if (now - lastSubmitTime < 2000) {
        toast({ title: "Aguarde", description: "Muitas tentativas. Aguarde alguns segundos.", variant: "destructive" });
        return;
      }
      setLastSubmitTime(now);

      const validated = loginSchema.parse({ email, password });

      // Check lockout before attempting login
      const isLocked = await checkLockout(validated.email);
      if (isLocked) {
        toast({
          title: "Conta temporariamente bloqueada",
          description: "Muitas tentativas falhas. Aguarde alguns minutos e tente novamente.",
          variant: "destructive",
        });
        return;
      }

      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) {
        // Record failed attempt
        await recordAttempt(validated.email, false);
        // Re-check lockout to update UI
        await checkLockout(validated.email);

        if (error.message.includes("Invalid login credentials")) {
          const attemptsInfo = lockout?.remaining_attempts
            ? ` (${lockout.remaining_attempts - 1} tentativas restantes)`
            : "";
          toast({
            title: "Erro ao fazer login",
            description: `Email ou senha incorretos${attemptsInfo}`,
            variant: "destructive",
          });
        } else {
          toast({ title: "Erro ao fazer login", description: error.message, variant: "destructive" });
        }
        return;
      }

      if (data.user) {
        // Record successful attempt (clears failed attempts)
        await recordAttempt(validated.email, true);

        // Check if user has MFA factors enrolled
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const totpFactors = factorsData?.totp?.filter(f => f.status === "verified") || [];

        if (totpFactors.length > 0) {
          // User has MFA — show verification dialog
          setShowMFA(true);
          return;
        }

        toast({ title: "Login realizado!", description: "Bem-vindo de volta" });
        await navigateAfterLogin();
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Erro de validação", description: error.errors[0].message, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const isLockedOut = lockout?.locked && lockoutCountdown > 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
          <CardDescription>Acesse sua conta para continuar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {isLockedOut && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <Lock className="h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Conta temporariamente bloqueada</p>
                  <p className="text-xs mt-0.5">
                    Tente novamente em {Math.ceil(lockoutCountdown / 60)} min {lockoutCountdown % 60}s
                  </p>
                </div>
              </div>
            )}

            {!isLockedOut && lockout && !lockout.locked && lockout.remaining_attempts !== undefined && lockout.remaining_attempts < 5 && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-warning/10 border border-warning/20 text-warning-foreground text-xs">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>{lockout.remaining_attempts} tentativas restantes antes do bloqueio temporário</span>
              </div>
            )}

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
                disabled={!!isLockedOut}
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
                disabled={!!isLockedOut}
              />
            </div>
            {/* Honeypot — invisible to users, bots auto-fill */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }}>
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !isOnline || !!isLockedOut}>
              {loading ? "Entrando..." : isLockedOut ? "Conta bloqueada" : isOnline ? "Entrar" : "Sem conexão"}
            </Button>
            {!isOnline && (
              <p className="text-sm text-destructive text-center">
                ⚠️ Você está offline. Conecte-se para fazer login.
              </p>
            )}
            <p className="text-center text-xs text-muted-foreground">
              Acesso restrito. Contate o administrador para obter uma conta.
            </p>
          </form>
        </CardContent>
      </Card>

      <MFAVerifyDialog
        open={showMFA}
        onSuccess={handleMFASuccess}
        onCancel={() => {
          setShowMFA(false);
          supabase.auth.signOut();
        }}
      />
    </>
  );
};
