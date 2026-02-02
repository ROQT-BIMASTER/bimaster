import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UserApprovalLevel {
  id: string;
  user_id: string;
  level_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ApprovalLevelWithCount {
  id: string;
  level_number: number;
  role_name: string;
  max_approval_amount: number;
  description: string | null;
  is_active: boolean;
  approvers_count: number;
}

export function useTradeUserApprovalLevels() {
  // Fetch all user approval level assignments
  const { data: userApprovalLevels, isLoading: isLoadingAssignments } = useQuery({
    queryKey: ["trade-user-approval-levels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_user_approval_levels")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data as UserApprovalLevel[];
    },
  });

  // Fetch approval levels with approver counts
  const { data: levelsWithCounts, isLoading: isLoadingLevels } = useQuery({
    queryKey: ["trade-approval-levels-with-counts"],
    queryFn: async () => {
      // Get all levels
      const { data: levels, error: levelsError } = await supabase
        .from("trade_approval_levels")
        .select("*")
        .order("level_number");
      
      if (levelsError) throw levelsError;

      // Get all user assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from("trade_user_approval_levels")
        .select("level_id")
        .eq("is_active", true);

      if (assignmentsError) throw assignmentsError;

      // Count approvers per level
      const countMap = new Map<string, number>();
      assignments?.forEach((a) => {
        countMap.set(a.level_id, (countMap.get(a.level_id) || 0) + 1);
      });

      // Merge counts into levels
      const result: ApprovalLevelWithCount[] = levels?.map((level) => ({
        ...level,
        approvers_count: countMap.get(level.id) || 0,
      })) || [];

      return result;
    },
  });

  // Get user's approval level
  const getUserApprovalLevel = (userId: string) => {
    const assignment = userApprovalLevels?.find((a) => a.user_id === userId);
    if (!assignment) return null;
    
    const level = levelsWithCounts?.find((l) => l.id === assignment.level_id);
    return level || null;
  };

  // Get all approvers for a specific level
  const getApproversForLevel = (levelId: string) => {
    return userApprovalLevels?.filter((a) => a.level_id === levelId) || [];
  };

  return {
    userApprovalLevels,
    levelsWithCounts,
    isLoading: isLoadingAssignments || isLoadingLevels,
    getUserApprovalLevel,
    getApproversForLevel,
  };
}
