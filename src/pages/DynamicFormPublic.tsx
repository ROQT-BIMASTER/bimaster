import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DynamicFormRenderer } from "@/components/forms/DynamicFormRenderer";
import { Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function DynamicFormPublic() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const formId = searchParams.get("form");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validatedFormId, setValidatedFormId] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<string | null>(null);

  useEffect(() => {
    validate();
  }, [token, formId]);

  async function validate() {
    setLoading(true);
    setError(null);

    if (!formId) {
      setError("Formulário não especificado.");
      setLoading(false);
      return;
    }

    // If token provided, validate it
    if (token) {
      // Hash the token
      const encoder = new TextEncoder();
      const data = encoder.encode(token);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const tokenHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      const { data: tokenData, error: tokenErr } = await supabase
        .from("team_form_tokens")
        .select("id, status, expires_at")
        .eq("token_hash", tokenHash)
        .single();

      if (tokenErr || !tokenData) {
        setError("Token inválido ou não encontrado.");
        setLoading(false);
        return;
      }

      if ((tokenData as any).status === "revoked") {
        setError("Este link foi revogado.");
        setLoading(false);
        return;
      }

      if (new Date((tokenData as any).expires_at) < new Date()) {
        setError("Este link expirou.");
        setLoading(false);
        return;
      }

      setTokenId(tokenData.id);
    }

    // Verify form exists and is active
    const { data: form } = await supabase
      .from("dynamic_forms")
      .select("id, status")
      .eq("id", formId)
      .single();

    if (!form) {
      setError("Formulário não encontrado.");
      setLoading(false);
      return;
    }

    if ((form as any).status !== "active") {
      setError("Este formulário não está ativo.");
      setLoading(false);
      return;
    }

    setValidatedFormId(form.id);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Erro</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!validatedFormId) return null;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <DynamicFormRenderer
        formId={validatedFormId}
        tokenId={tokenId || undefined}
      />
    </div>
  );
}
