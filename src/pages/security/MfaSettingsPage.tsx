import { useState } from "react";
import { useMfa } from "@/hooks/useMfa";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldCheck, ShieldAlert, KeyRound, Copy } from "lucide-react";
import { toast } from "sonner";

export default function MfaSettingsPage() {
  const { status, loading, enroll, verify, disable } = useMfa();
  const [enrolling, setEnrolling] = useState(false);
  const [otpUri, setOtpUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const r = await enroll();
      setOtpUri(r.otpauth_uri);
      setSecret(r.secret);
      setRecovery(r.recovery_codes);
    } catch (e: any) {
      toast.error("Falha ao iniciar MFA: " + e.message);
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(code)) {
      toast.error("Digite o código de 6 dígitos");
      return;
    }
    const ok = await verify(code);
    if (ok) {
      toast.success("MFA ativado com sucesso");
      setOtpUri(null); setSecret(null); setRecovery(null); setCode("");
    } else {
      toast.error("Código incorreto");
    }
  };

  const handleDisable = async () => {
    if (!/^\d{6}$/.test(disableCode)) {
      toast.error("Digite o código TOTP atual");
      return;
    }
    const ok = await disable(disableCode);
    if (ok) {
      toast.success("MFA desativado");
      setDisableCode("");
    } else {
      toast.error("Código incorreto");
    }
  };

  if (loading && !status) return <div className="p-6">Carregando…</div>;

  const qrUrl = otpUri ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(otpUri)}` : null;

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Autenticação em Dois Fatores (MFA)</h1>
          <p className="text-sm text-muted-foreground">Adicione uma camada extra de proteção à sua conta com TOTP.</p>
        </div>
      </div>

      {status?.required && !status.verified && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>MFA obrigatório para sua função</AlertTitle>
          <AlertDescription>
            Sua role exige MFA. Configure agora para manter acesso pleno ao sistema.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Status</CardTitle>
            <CardDescription>Estado atual do seu MFA</CardDescription>
          </div>
          <Badge variant={status?.verified ? "default" : "secondary"}>
            {status?.verified ? "Ativo" : status?.enrolled ? "Pendente" : "Inativo"}
          </Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          {status?.verified_at && <div>Verificado em: {new Date(status.verified_at).toLocaleString("pt-BR")}</div>}
          {status?.last_used_at && <div>Último uso: {new Date(status.last_used_at).toLocaleString("pt-BR")}</div>}
        </CardContent>
      </Card>

      {!status?.verified && (
        <Card>
          <CardHeader>
            <CardTitle>Configurar MFA</CardTitle>
            <CardDescription>Use Google Authenticator, Authy, 1Password ou similar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!otpUri ? (
              <Button onClick={handleEnroll} disabled={enrolling}>
                <KeyRound className="h-4 w-4 mr-2" />
                {enrolling ? "Gerando…" : "Iniciar configuração"}
              </Button>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-start">
                  {qrUrl && <img src={qrUrl} alt="QR Code MFA" className="border rounded-md" />}
                  <div className="space-y-3">
                    <p className="text-sm">Escaneie o QR code ou insira manualmente esta chave secreta:</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded break-all">{secret}</code>
                      <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(secret!); toast.success("Copiado"); }}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    {recovery && (
                      <div className="border rounded-md p-3 bg-muted/40">
                        <p className="text-xs font-medium mb-2">Códigos de recuperação (guarde em local seguro — só aparecem uma vez)</p>
                        <div className="grid grid-cols-2 gap-1 text-xs font-mono">
                          {recovery.map((c) => <div key={c}>{c}</div>)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-end gap-2 pt-2">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs">Código de 6 dígitos do app</label>
                    <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" maxLength={6} />
                  </div>
                  <Button onClick={handleVerify}>Confirmar</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {status?.verified && (
        <Card>
          <CardHeader>
            <CardTitle>Desativar MFA</CardTitle>
            <CardDescription>Requer código TOTP atual.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs">Código atual</label>
              <Input value={disableCode} onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" maxLength={6} />
            </div>
            <Button variant="destructive" onClick={handleDisable}>Desativar</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
