import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Minimal typed wrapper — supabase.auth.oauth is beta and not always in the
// generated types. Keep it local to this page.
type OAuthApi = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{
    data: {
      client?: { name?: string; logo_uri?: string; client_uri?: string };
      redirect_url?: string;
      redirect_to?: string;
      scopes?: string[];
    } | null;
    error: { message: string } | null;
  }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{
    data: { redirect_url?: string; redirect_to?: string } | null;
    error: { message: string } | null;
  }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{
    data: { redirect_url?: string; redirect_to?: string } | null;
    error: { message: string } | null;
  }>;
};

function getOAuthApi(): OAuthApi | null {
  const anyAuth = (supabase.auth as unknown) as { oauth?: OAuthApi };
  return anyAuth.oauth ?? null;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<
    { client?: { name?: string; logo_uri?: string; client_uri?: string }; scopes?: string[] } | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Parâmetro authorization_id ausente.");
        return;
      }
      const oauth = getOAuthApi();
      if (!oauth) {
        setError("Este ambiente ainda não expõe supabase.auth.oauth. Atualize o SDK do backend.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data ?? null);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    const oauth = getOAuthApi();
    if (!oauth) return;
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Servidor de autorização não retornou destino de redirecionamento.");
      return;
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="p-8 max-w-md w-full space-y-3">
          <h1 className="text-lg font-semibold text-foreground">Não foi possível carregar</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </Card>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="p-8 max-w-md w-full">
          <p className="text-sm text-muted-foreground">Carregando pedido de autorização…</p>
        </Card>
      </main>
    );
  }

  const appName = details.client?.name ?? "aplicativo externo";

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="p-8 max-w-md w-full space-y-6">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">
            Conectar {appName} à sua conta
          </h1>
          <p className="text-sm text-muted-foreground">
            Ao aprovar, {appName} poderá usar as ferramentas da Central Bimaster em seu nome,
            respeitando suas permissões.
          </p>
        </div>
        {details.scopes && details.scopes.length > 0 && (
          <div className="text-sm text-muted-foreground">
            <div className="font-medium text-foreground mb-1">Escopos solicitados</div>
            <ul className="list-disc pl-5 space-y-1">
              {details.scopes.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex gap-3">
          <Button disabled={busy} onClick={() => decide(true)} className="flex-1">
            Aprovar
          </Button>
          <Button
            disabled={busy}
            onClick={() => decide(false)}
            variant="outline"
            className="flex-1"
          >
            Negar
          </Button>
        </div>
      </Card>
    </main>
  );
}
