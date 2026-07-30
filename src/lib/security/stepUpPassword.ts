/**
 * Step-up por senha — emite um token de curta duração (5 min, uso único)
 * após revalidar a senha do usuário no servidor.
 *
 * A senha nunca é comparada no cliente: o edge function `mfa-step-up`
 * revalida a credencial num cliente isolado e grava o hash do token.
 * O token é enviado às RPCs sensíveis (ex.: aprovação de documentos).
 */
import { supabase } from "@/integrations/supabase/client";

export interface StepUpToken {
  token: string;
  expires_at: string;
}

export async function requestStepUpWithPassword(
  scope: string,
  password: string,
): Promise<StepUpToken> {
  const { data, error } = await supabase.functions.invoke("mfa-step-up", {
    body: { action: "request_from_password", scope, password },
  });

  if (error) {
    let serverMsg: string | undefined;
    try {
      const resp = (error as any)?.context?.response as Response | undefined;
      if (resp) {
        const body = await resp.clone().json().catch(() => null);
        serverMsg = body?.error;
      }
    } catch {
      /* ignore */
    }
    throw new Error(serverMsg ?? error.message ?? "Falha ao confirmar a senha.");
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as StepUpToken;
}

export const CHINA_DOC_APPROVAL_SCOPE = "china.doc_approval";
