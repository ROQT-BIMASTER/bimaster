import { useMembershipRealtime } from "@/hooks/useMembershipRealtime";

/**
 * Listener invisível: ativa o realtime global de membership do usuário logado.
 * Mantido como componente para ser plugado no provider tree do App.
 */
export function MembershipRealtimeListener() {
  useMembershipRealtime();
  return null;
}
