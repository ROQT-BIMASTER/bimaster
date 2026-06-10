// Complexity router with fail-safe. See RFC v4.0.0 §A1.
//
// Default model: openai/gpt-5.2 (top-tier, "complex").
// Fast model:    google/gemini-3-flash-preview ("simple").
//
// FAIL-SAFE: any of the following forces "complex":
//  - classifier confidence < 0.7
//  - any write tool in the requested tool set
//  - any ACL-sensitive scope (finance, permissions, PII)
//  - classifier error/timeout

import type { RoutedComplexity } from "./types.ts";

const WRITE_TOOL_PREFIX = ["propose_", "execute_", "create_", "update_", "delete_"];
const SENSITIVE_SCOPES = new Set(["finance:write", "permissions:read", "permissions:write", "pii:read", "pii:write"]);

export const MODEL_COMPLEX = "openai/gpt-5.2";
export const MODEL_SIMPLE = "google/gemini-3-flash-preview";

export interface RouteInput {
  classifierConfidence?: number; // 0..1, undefined => treat as failed
  classifierDecision?: RoutedComplexity;
  toolNames?: string[];
  scopes?: string[];
}

export interface RouteDecision {
  complexity: RoutedComplexity;
  model: string;
  reason: string;
  confidence: number;
}

export function routeComplexity(input: RouteInput): RouteDecision {
  const hasWriteTool = (input.toolNames ?? []).some((t) =>
    WRITE_TOOL_PREFIX.some((p) => t.startsWith(p)),
  );
  if (hasWriteTool) {
    return { complexity: "complex", model: MODEL_COMPLEX, reason: "write_tool_present", confidence: 1 };
  }
  const hasSensitiveScope = (input.scopes ?? []).some((s) => SENSITIVE_SCOPES.has(s));
  if (hasSensitiveScope) {
    return { complexity: "complex", model: MODEL_COMPLEX, reason: "sensitive_scope", confidence: 1 };
  }
  const conf = input.classifierConfidence;
  if (conf === undefined || Number.isNaN(conf)) {
    return { complexity: "complex", model: MODEL_COMPLEX, reason: "classifier_failed", confidence: 0 };
  }
  if (conf < 0.7) {
    return { complexity: "complex", model: MODEL_COMPLEX, reason: "low_confidence", confidence: conf };
  }
  if (input.classifierDecision === "simple") {
    return { complexity: "simple", model: MODEL_SIMPLE, reason: "classified_simple", confidence: conf };
  }
  return { complexity: "complex", model: MODEL_COMPLEX, reason: "classified_complex", confidence: conf };
}
