import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatCNPJ,
  formatCPF,
  formatDate,
  formatPercentage,
  formatNumber,
  formatPhone,
  formatCEP,
  truncate,
  formatBytes,
  capitalize,
  formatDuration,
  formatCurrencySmart,
} from "../formatters";

describe("formatCurrency", () => {
  it("formats positive values", () => {
    expect(formatCurrency(1234.56)).toContain("1.234,56");
  });
  it("formats zero", () => {
    expect(formatCurrency(0)).toContain("0,00");
  });
  it("hides cents when requested", () => {
    expect(formatCurrency(1234.56, false)).not.toContain(",56");
  });
});

describe("formatCNPJ", () => {
  it("formats 14-digit string", () => {
    expect(formatCNPJ("12345678000199")).toBe("12.345.678/0001-99");
  });
});

describe("formatCPF", () => {
  it("formats 11-digit string", () => {
    expect(formatCPF("12345678901")).toBe("123.456.789-01");
  });
});

describe("formatDate", () => {
  it("formats short date", () => {
    const result = formatDate("2025-06-15");
    expect(result).toContain("15");
    expect(result).toContain("2025");
  });
});

describe("formatPercentage", () => {
  it("formats percentage", () => {
    expect(formatPercentage(50)).toContain("50");
  });
});

describe("formatNumber", () => {
  it("formats with separators", () => {
    expect(formatNumber(1234567)).toContain("1.234.567");
  });
});

describe("formatPhone", () => {
  it("formats 11-digit mobile", () => {
    expect(formatPhone("11988887777")).toBe("(11) 98888-7777");
  });
  it("formats 10-digit landline", () => {
    expect(formatPhone("1133334444")).toBe("(11) 3333-4444");
  });
});

describe("formatCEP", () => {
  it("formats CEP", () => {
    expect(formatCEP("01310100")).toBe("01310-100");
  });
});

describe("truncate", () => {
  it("truncates long text", () => {
    expect(truncate("Hello World Long Text", 10)).toBe("Hello W...");
  });
  it("keeps short text unchanged", () => {
    expect(truncate("Hi", 10)).toBe("Hi");
  });
});

describe("formatBytes", () => {
  it("formats zero", () => {
    expect(formatBytes(0)).toBe("0 Bytes");
  });
  it("formats megabytes", () => {
    expect(formatBytes(1048576)).toContain("MB");
  });
});

describe("capitalize", () => {
  it("capitalizes words", () => {
    expect(capitalize("hello world")).toBe("Hello World");
  });
});

describe("formatDuration", () => {
  it("formats minutes only", () => {
    expect(formatDuration(45)).toBe("45min");
  });
  it("formats hours and minutes", () => {
    expect(formatDuration(90)).toBe("1h 30min");
  });
  it("formats exact hours", () => {
    expect(formatDuration(120)).toBe("2h");
  });
});

describe("formatCurrencySmart", () => {
  it("formats millions with M suffix", () => {
    const result = formatCurrencySmart(5000000);
    expect(result.suffix).toBe("M");
    expect(result.formatted).toContain("5");
  });
  it("formats thousands with K suffix", () => {
    const result = formatCurrencySmart(50000);
    expect(result.suffix).toBe("K");
  });
  it("formats small values without suffix", () => {
    const result = formatCurrencySmart(500);
    expect(result.suffix).toBeNull();
  });
});
