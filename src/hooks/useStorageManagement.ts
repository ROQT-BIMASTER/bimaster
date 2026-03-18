import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BucketInfo {
  id: string;
  name: string;
  public: boolean;
  created_at: string;
  updated_at: string;
  file_count?: number;
}

export interface VisibilityAuditEntry {
  id: string;
  entity_type: string;
  entity_name: string;
  old_visibility: string;
  new_visibility: string;
  changed_by_name: string | null;
  reason: string | null;
  created_at: string;
}

export function useBuckets() {
  return useQuery({
    queryKey: ["storage-buckets"],
    queryFn: async () => {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw error;
      return (data || []).map((b) => ({
        id: b.id,
        name: b.name,
        public: b.public,
        created_at: b.created_at,
        updated_at: b.updated_at,
      })) as BucketInfo[];
    },
  });
}

export function useChangeBucketVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bucketId,
      makePublic,
      reason,
    }: {
      bucketId: string;
      makePublic: boolean;
      reason: string;
    }) => {
      const { data, error } = await supabase.rpc("change_bucket_visibility", {
        p_bucket_id: bucketId,
        p_make_public: makePublic,
        p_reason: reason,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || "Erro desconhecido");
      return result;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["storage-buckets"] });
      qc.invalidateQueries({ queryKey: ["visibility-audit-log"] });
      toast.success(
        vars.makePublic
          ? `Bucket "${vars.bucketId}" agora é público`
          : `Bucket "${vars.bucketId}" agora é privado`
      );
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao alterar visibilidade");
    },
  });
}

export function useVisibilityAuditLog() {
  return useQuery({
    queryKey: ["visibility-audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visibility_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as VisibilityAuditEntry[];
    },
  });
}
