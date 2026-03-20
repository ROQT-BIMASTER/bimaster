import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
  },
}));

vi.mock("@/utils/excelExport", () => ({
  exportToExcel: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { ExportControls } from "../ExportControls";

describe("ExportControls", () => {
  it("renders PDF and Excel buttons", () => {
    render(<ExportControls reportType="test" data={[{ a: 1 }]} />);
    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(screen.getByText("Excel")).toBeInTheDocument();
  });

  it("renders without data", () => {
    render(<ExportControls reportType="test" data={[]} />);
    expect(screen.getByText("PDF")).toBeInTheDocument();
  });
});
