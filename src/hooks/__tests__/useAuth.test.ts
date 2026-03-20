import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { createElement } from "react";

// Mock supabase before importing AuthContext
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/utils/offline-manager", () => ({
  offlineManager: { isOnline: () => true, subscribe: vi.fn(() => vi.fn()) },
}));

import { AuthProvider, useAuth } from "@/contexts/AuthContext";

describe("useAuth", () => {
  it("returns user, loading and session without throwing", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(AuthProvider, null, children);

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current).toHaveProperty("user");
    expect(result.current).toHaveProperty("loading");
    expect(result.current).toHaveProperty("session");
  });

  it("throws when used outside provider", () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow();
  });
});
