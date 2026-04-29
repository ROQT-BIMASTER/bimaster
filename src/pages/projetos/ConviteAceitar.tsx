import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X, Mail, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Convite {
  id: string;
  projeto_id: string;
  projeto_nome: string;
  email: string;
  papel: string;
  mensagem: string | null;
  status: string;
  expires_at: string;
  convidante_nome: string | null;
}

export default function ConviteAceitar() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [convite, setConvite] = useState<Convite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error } = await supabase.rpc("get_convite_by_token" as any, { _token: token });
      if (error) {
        setError("Erro ao carregar convite.");
      } else if (!data || (data as any[]).length === 0) {
        setError("Convite não encontrado.");
      } else {
        setConvite((data as any[])[0]);
      }
      setLoading(false);
    })();
  }, [token]);

  const handleAccept = async () => {
    if (!user) {
      navigate(`/auth?redirect=/projetos/convite/${token}`);
      return;
    }
    setActing(true);
    const { data, error } = await supabase.rpc("accept_projeto_convite" as any, { _token: token });
    setActing(false);
    if (error || !(data as any)?.ok) {
      const msg = (data as any)?.error || error?.message;
      if (msg === "email_mismatch") {
        toast.error("Este convite é para outro e-mail. Faça login com a conta correta.");
      } else if (msg === "expired") {
        toast.error("Convite expirado.");
      } else {
        toast.error("Erro: " + msg);
      }
      return;
    }
    toast.success("Convite aceito!");
    navigate(`/dashboard/projetos/${(data as any).projeto_id}`);
  };

  const handleDecline = async () => {
    if (!user) {
      navigate(`/auth?redirect=/projetos/convite/${token}`);
      return;
    }
    setActing(true);
    await supabase.rpc("decline_projeto_convite" as any, { _token: token });
    setActing(false);
    toast.success("Convite recusado.");
    navigate("/");
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !convite) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
            <p>{error || "Convite inválido"}</p>
            <Button asChild variant="outline">
              <Link to="/">Voltar ao início</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = new Date(convite.expires_at) < new Date();
  const isPending = convite.status === "pending" && !isExpired;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Mail className="h-5 w-5 text-primary" />
            <CardTitle>Convite para projeto</CardTitle>
          </div>
          <CardDescription>
            {convite.convidante_nome ? `${convite.convidante_nome} convidou você` : "Você foi convidado"} para participar de:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border rounded-md bg-card">
            <p className="font-semibold text-lg">{convite.projeto_nome}</p>
            <Badge variant="secondary" className="mt-2">
              Papel: {convite.papel}
            </Badge>
          </div>

          {convite.mensagem && (
            <div className="border-l-2 border-primary pl-3 text-sm italic text-muted-foreground">
              "{convite.mensagem}"
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Destinatário: <strong>{convite.email}</strong>
          </p>

          {!isPending ? (
            <div className="text-center py-2 text-sm text-muted-foreground">
              {isExpired ? "Este convite expirou." : `Status: ${convite.status}`}
            </div>
          ) : !user ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground text-center">
                Faça login com <strong>{convite.email}</strong> para aceitar.
              </p>
              <Button
                className="w-full"
                onClick={() =>
                  navigate(`/auth?redirect=/projetos/convite/${token}&email=${encodeURIComponent(convite.email)}`)
                }
              >
                Entrar ou criar conta
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button onClick={handleAccept} disabled={acting} className="flex-1 gap-2">
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Aceitar
              </Button>
              <Button onClick={handleDecline} disabled={acting} variant="outline" className="flex-1 gap-2">
                <X className="h-4 w-4" />
                Recusar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
