import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        limit: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "test" }, session: null, loading: false, approved: true, isActive: true }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissions: () => ({ role: "admin", hasPermission: () => true, showModule: () => true }),
}));

vi.mock("@/hooks/useUIPermissions", () => ({
  useUIPermissions: () => ({ permissions: {}, hasPermission: () => true, loading: false }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: (k: string) => k, language: "pt" }),
}));

import MarketingModule from "../MarketingModule";

describe("MarketingModule", () => {
  it("renders without crashing", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <MarketingModule />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText("Marketing Digital")).toBeInTheDocument();
  });
});
