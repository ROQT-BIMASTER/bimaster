import { useCallback, useState } from "react";
import { requestStepUp } from "@/hooks/useMfa";

export type StepUpScope =
  | "export.data"
  | "user.management"
  | "finance.sensitive"
  | "municipios.write"
  | "user.create.admin"
  | "user.delete"
  | "user.password.reset"
  | "user.password.self"
  | "user.password.bulk"
  | "security.admin.config"
  | "cofre.share"
  | "data.export.bulk"
  | "secret.reveal"
  | "mfa.reset_other"
  | "jit.approve"
  | "access.review_decision"
  | "pentest.execute"
  | "device.trust";

interface PendingAction {
  scope: StepUpScope;
  description?: string;
  resolve: (token: string | null) => void;
}

/**
 * Orquestra a captura de step-up. Use em conjunto com <StepUpDialog />.
 *
 * Exemplo:
 *   const { request, dialogProps } = useStepUp();
 *   const token = await request("export.data", "Exportar planilha financeira");
 *   if (!token) return; // usuário cancelou
 *   await supabase.functions.invoke("relatorio-export", {
 *     body: { ... },
 *     headers: { "x-step-up-token": token },
 *   });
 */
export function useStepUp() {
  const [pending, setPending] = useState<PendingAction | null>(null);

  const request = useCallback(
    (scope: StepUpScope, description?: string) =>
      new Promise<string | null>((resolve) => {
        setPending({ scope, description, resolve });
      }),
    []
  );

  const handleSuccess = useCallback(
    (token: string) => {
      pending?.resolve(token);
      setPending(null);
    },
    [pending]
  );

  const handleCancel = useCallback(() => {
    pending?.resolve(null);
    setPending(null);
  }, [pending]);

  return {
    request,
    dialogProps: {
      open: !!pending,
      scope: pending?.scope ?? "",
      description: pending?.description,
      onOpenChange: (v: boolean) => { if (!v) handleCancel(); },
      onSuccess: handleSuccess,
    },
  };
}

/** Alias direto para chamadas pontuais sem UI orquestrada. */
export async function issueStepUp(scope: StepUpScope, totp: string): Promise<string> {
  const r = await requestStepUp(scope, totp);
  return r.token;
}
