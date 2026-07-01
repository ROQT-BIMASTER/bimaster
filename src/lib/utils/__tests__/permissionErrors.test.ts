import { describe, it, expect } from "vitest";
import { isPermissionError, toFriendlyPermissionMessage } from "@/lib/utils/permissionErrors";

describe("permissionErrors.isPermissionError", () => {
  it("returns false for null/undefined/empty", () => {
    expect(isPermissionError(null)).toBe(false);
    expect(isPermissionError(undefined)).toBe(false);
    expect(isPermissionError("")).toBe(false);
  });

  it("detects Postgres error code 42501", () => {
    expect(isPermissionError({ code: "42501", message: "denied" })).toBe(true);
  });

  it("detects HTTP 401 / 403", () => {
    expect(isPermissionError({ status: 401 })).toBe(true);
    expect(isPermissionError({ status: 403 })).toBe(true);
    expect(isPermissionError({ statusCode: 403 })).toBe(true);
  });

  it("detects RLS message variants", () => {
    expect(isPermissionError({ message: "new row violates row-level security policy" })).toBe(true);
    expect(isPermissionError({ message: "row level security" })).toBe(true);
    expect(isPermissionError({ message: "permission denied for table foo" })).toBe(true);
    expect(isPermissionError({ message: "Not authorized" })).toBe(true);
  });

  it("returns false for generic errors", () => {
    expect(isPermissionError({ message: "network error" })).toBe(false);
    expect(isPermissionError({ code: "23505" })).toBe(false);
    expect(isPermissionError(new Error("boom"))).toBe(false);
  });
});

describe("permissionErrors.toFriendlyPermissionMessage", () => {
  it("returns friendly message for RLS errors", () => {
    const msg = toFriendlyPermissionMessage({ code: "42501" });
    expect(msg.toLowerCase()).toContain("permissão");
  });

  it("returns original error message for non-permission errors", () => {
    expect(toFriendlyPermissionMessage({ message: "custom" })).toBe("custom");
  });

  it("falls back when no message available", () => {
    expect(toFriendlyPermissionMessage({}, "fallback X")).toBe("fallback X");
    expect(toFriendlyPermissionMessage(undefined, "fallback X")).toBe("fallback X");
  });
});
