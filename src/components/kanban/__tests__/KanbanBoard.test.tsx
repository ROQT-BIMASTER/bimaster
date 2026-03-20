import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "test" } }, error: null }),
    },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { KanbanBoard } from "../KanbanBoard";

describe("KanbanBoard", () => {
  it("renders loading state initially", () => {
    render(<KanbanBoard />);
    // The component shows a loader initially
    expect(document.querySelector(".animate-spin")).toBeTruthy();
  });
});
