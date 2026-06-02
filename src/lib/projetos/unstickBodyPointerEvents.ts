/**
 * Defensive helper to release a body `pointer-events: none` lock that Radix
 * UI Dialog occasionally leaves behind when nested dialogs or portals close
 * out of order (notably after a member is removed and a sibling dialog
 * unmounts via React Query invalidation).
 *
 * Safe to call from any tab — no-op if body is already interactive.
 */
export function unstickBodyPointerEvents(): void {
  if (typeof document === "undefined") return;
  if (document.body.style.pointerEvents === "none") {
    document.body.style.pointerEvents = "";
  }
}
