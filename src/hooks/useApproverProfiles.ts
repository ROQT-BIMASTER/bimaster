import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ApproverProfile {
  id: string;
  nome: string;
}

export const useApproverProfiles = () => {
  return useQuery({
    queryKey: ["approver-profiles"],
    queryFn: async () => {
      // Get users with admin, supervisor, or gestor roles
      const { data: roleUsers, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "supervisor", "gerente"]);

      if (rolesError) throw rolesError;

      const userIds = [...new Set(roleUsers?.map((r) => r.user_id) || [])];
      if (userIds.length === 0) return [] as ApproverProfile[];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", userIds)
        .order("nome");

      if (profilesError) throw profilesError;

      return (profiles || []) as ApproverProfile[];
    },
  });
};

export const sendApproverNotification = async (
  approverId: string,
  description: string,
  valor: number
) => {
  try {
    const valorFormatted = valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    await supabase.functions.invoke("send-notifications", {
      body: {
        userId: approverId,
        type: "expense_pending_approval",
        title: "Nova despesa aguardando aprovação",
        message: `${description || "Despesa"} - ${valorFormatted} aguarda sua análise.`,
        actionUrl: "/approval-hub",
      },
    });
  } catch (error) {
    console.error("[Notification] Erro ao notificar aprovador:", error);
    // Don't throw - notification failure shouldn't block expense creation
  }
};
