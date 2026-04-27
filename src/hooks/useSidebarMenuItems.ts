import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SidebarMenuItem {
  id: string;
  module_code: string;
  item_code: string;
  label: string;
  icon: string | null;
  route: string | null;
  parent_group: string | null;
  ordem: number;
  ativo: boolean;
  label_override: string | null;
  icon_override: string | null;
  screen_code: string | null;
  require_admin: boolean;
  require_admin_or_supervisor: boolean;
}

const QUERY_KEY = ["sidebar-menu-items"];

export function useSidebarMenuItems() {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sidebar_menu_items")
        .select("*")
        .order("module_code")
        .order("ordem");
      if (error) throw error;
      return (data || []) as SidebarMenuItem[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Invalida o cache imediatamente via realtime; usa polling como fallback
  useEffect(() => {
    let realtimeConnected = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const startPollingFallback = () => {
      if (pollInterval) return;
      // Refresh a cada 8s quando realtime não está disponível
      pollInterval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      }, 8000);
    };

    const stopPollingFallback = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    const channel = (supabase as any)
      .channel("sidebar-menu-items-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sidebar_menu_items" },
        () => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          realtimeConnected = true;
          stopPollingFallback();
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          realtimeConnected = false;
          startPollingFallback();
        }
      });

    // Safety net: se em 5s o realtime ainda não conectou, ativa polling
    const connectTimeout = setTimeout(() => {
      if (!realtimeConnected) startPollingFallback();
    }, 5000);

    return () => {
      clearTimeout(connectTimeout);
      stopPollingFallback();
      (supabase as any).removeChannel(channel);
    };
  }, [queryClient]);

  // Group items by module_code
  const itemsByModule = items.reduce<Record<string, SidebarMenuItem[]>>((acc, item) => {
    if (!acc[item.module_code]) acc[item.module_code] = [];
    acc[item.module_code].push(item);
    return acc;
  }, {});

  const updateItem = useMutation({
    mutationFn: async (item: Partial<SidebarMenuItem> & { id: string }) => {
      const { error } = await (supabase as any)
        .from("sidebar_menu_items")
        .update({ ...item, updated_at: new Date().toISOString() })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const reorderItems = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, idx) =>
        (supabase as any).from("sidebar_menu_items").update({ ordem: idx + 1 }).eq("id", id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const toggleItemActive = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await (supabase as any)
        .from("sidebar_menu_items")
        .update({ ativo, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return {
    items,
    itemsByModule,
    isLoading,
    updateItem,
    reorderItems,
    toggleItemActive,
  };
}
