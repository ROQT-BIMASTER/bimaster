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
  if (error) throw error;
  return data as StepUpResult;
}

export async function validateStepUp(scope: string, token: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke("mfa-step-up", {
    body: { action: "validate", scope, token },
  });
  if (error) return false;
  return !!(data as any)?.valid;
}
