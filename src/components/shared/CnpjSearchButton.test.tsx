import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CnpjSearchButton } from "./CnpjSearchButton";

// Mock the supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn()
    }
  }
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }
}));

describe("CnpjSearchButton", () => {
  it("renders correctly with valid CNPJ", () => {
    render(
      <CnpjSearchButton
        cnpj="12345678000199"
        onDataFound={() => {}}
      />
    );
    
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it("is disabled with invalid CNPJ (less than 14 digits)", () => {
    render(
      <CnpjSearchButton
        cnpj="123456"
        onDataFound={() => {}}
      />
    );
    
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("is disabled when disabled prop is true", () => {
    render(
      <CnpjSearchButton
        cnpj="12345678000199"
        onDataFound={() => {}}
        disabled={true}
      />
    );
    
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("handles formatted CNPJ correctly", () => {
    render(
      <CnpjSearchButton
        cnpj="12.345.678/0001-99"
        onDataFound={() => {}}
      />
    );
    
    const button = screen.getByRole("button");
    expect(button).not.toBeDisabled();
  });
});
