import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

interface GraceInfo {
  required: boolean;
  enrolled: boolean;
  grace_expires_at: string | null;
  enforced: boolean;
}

/**
 * Banner global que aparece para admins/gerentes que ainda não inscreveram MFA.
 * Durante o grace period (7d), apenas alerta. Após expirar, o backend bloqueia
 * (HTTP 403 com code MFA_REQUIRED) — esta UI orienta o usuário a se inscrever.
 */
export function MfaGate() {
  const navigate = useNavigate();
  const [info, setInfo] = useState<GraceInfo | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u?.user) return;

        const [{ data: roles }, { data: enrollment }, { data: grace }] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", u.user.id),
          supabase.from("mfa_enrollments").select("verified_at").eq("user_id", u.user.id).maybeSingle(),
          supabase.from("mfa_grace_periods").select("grace_expires_at").eq("user_id", u.user.id).maybeSingle(),
        ]);

        const required = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "gerente");
        const enrolled = !!enrollment?.verified_at;

        if (!required || enrolled) { setInfo(null); return; }

        const expiresAt = grace?.grace_expires_at ?? null;
        const enforced = expiresAt ? new Date(expiresAt) < new Date() : false;

        setInfo({ required, enrolled, grace_expires_at: expiresAt, enforced });
      } catch { /* silencioso */ }
    })();
  }, []);

  if (!info || !info.required || info.enrolled) return null;

  const daysLeft = info.grace_expires_at
    ? Math.max(0, Math.ceil((new Date(info.grace_expires_at).getTime() - Date.now()) / 86400000))
    : 7;

  return (
    <div className="px-4 pt-3">
      <Alert variant={info.enforced ? "destructive" : "default"} className="border-2">
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle>
          {info.enforced
            ? "Acesso bloqueado: MFA obrigatório"
            : `MFA será obrigatório em ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`}
        </AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3 mt-1">
          <span>
            {info.enforced
              ? "Inscreva-se agora para restaurar o acesso a operações sensíveis."
              : "Sua conta tem perfil administrativo. Configure o autenticador para evitar interrupção."}
          </span>
          <Button size="sm" onClick={() => navigate("/dashboard/security/mfa")}>
            Configurar agora
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
