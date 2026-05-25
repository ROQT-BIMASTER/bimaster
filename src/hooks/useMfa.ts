import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MfaStatus {
  enrolled: boolean;
  verified: boolean;
  required: boolean;
  verified_at?: string | null;
  last_used_at?: string | null;
}

interface EnrollResult {
  secret: string;
  otpauth_uri: string;
  recovery_codes: string[];
}

async function invoke<T = any>(body: any): Promise<T> {
  const { data, error } = await supabase.functions.invoke("mfa-manage", { body });
  if (error) throw error;
  return data as T;
}

export function useMfa() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await invoke<MfaStatus>({ action: "status" });
      setStatus(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const enroll = useCallback(async (): Promise<EnrollResult> => {
    return invoke<EnrollResult>({ action: "enroll" });
  }, []);

  const verify = useCallback(async (code: string): Promise<boolean> => {
    try {
      await invoke({ action: "verify", code });
      await refresh();
      return true;
    } catch {
      return false;
    }
  }, [refresh]);

  const disable = useCallback(async (code: string): Promise<boolean> => {
    try {
      await invoke({ action: "disable", code });
      await refresh();
      return true;
    } catch {
      return false;
    }
  }, [refresh]);

  return { status, loading, refresh, enroll, verify, disable };
}

export interface StepUpResult {
  token: string;
  expires_at: string;
}

export async function requestStepUp(scope: string, code: string): Promise<StepUpResult> {
  const { data, error } = await supabase.functions.invoke("mfa-step-up", {
    body: { action: "request", scope, code },
  });
  if (error) {
    // supabase.functions.invoke throws a generic "non-2xx" error; try to extract
    // the JSON body returned by the edge function so the user sees the real reason.
    let serverMsg: string | undefined;
    try {
      const resp = (error as any)?.context?.response as Response | undefined;
      if (resp) {
        const body = await resp.clone().json().catch(() => null);
        serverMsg = body?.error;
      }
    } catch { /* ignore */ }
    if (data && (data as any).error) serverMsg = serverMsg ?? (data as any).error;
    throw new Error(serverMsg ?? error.message ?? "Falha na verificação MFA");
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as StepUpResult;
}

export async function validateStepUp(scope: string, token: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke("mfa-step-up", {
    body: { action: "validate", scope, token },
  });
  if (error) return false;
  return !!(data as any)?.valid;
}
