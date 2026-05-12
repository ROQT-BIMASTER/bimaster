import { useSyncExternalStore } from "react";
import { isVincularRead, subscribeVincularRead, markVincularRead } from "@/lib/china/vincularReadState";

export function useVincularReadFlag(id: string) {
  const read = useSyncExternalStore(subscribeVincularRead, () => isVincularRead(id), () => false);
  return { read, markRead: () => markVincularRead(id) };
}
