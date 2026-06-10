// Tool registry. See RFC v4.0.0 §A3.
//
// LLM only sees and may call READ tools and PROPOSE tools.
// EXECUTE tools are private — only the executor invokes them after confirm().
// LLM trying to call an execute_* tool → FORBIDDEN_TOOL error.

import type { CopilotToolError } from "../copilot/types.ts";

export type ToolKind = "read" | "propose" | "execute" | "ui";

export interface ToolDef<TInput = unknown, TOutput = unknown> {
  name: string;
  kind: ToolKind;
  description: string;
  /** Zod-style validator. We accept any object with `.parse(x)` so callers may swap libs. */
  inputSchema: { parse: (x: unknown) => TInput };
  /** Backend-only handler. */
  handler: (input: TInput, ctx: ToolContext) => Promise<TOutput>;
  /** Required scope for step-up checks. */
  scopeKey?: string;
  /** Whether result fields can flow into user-visible numbers (drives sourceRef coverage). */
  sourceOfTruth?: boolean;
}

export interface ToolContext {
  userId: string;
  requestId: string;
  copilotId: string;
  // Supabase service-role client must be provided by the edge.
  supabase: unknown;
  // Logger for tool execution.
  log?: (event: string, data?: Record<string, unknown>) => void;
}

const _registry = new Map<string, ToolDef>();

export function registerTool(def: ToolDef): void {
  if (_registry.has(def.name)) {
    throw new Error(`tool already registered: ${def.name}`);
  }
  _registry.set(def.name, def);
}

export function getTool(name: string): ToolDef | undefined {
  return _registry.get(name);
}

export function listToolsForLLM(opts: { kinds?: ToolKind[] } = {}): ToolDef[] {
  const kinds = new Set(opts.kinds ?? ["read", "propose", "ui"]);
  return [...(_registry.values())].filter((t) => kinds.has(t.kind));
}

export function isLLMCallable(name: string): boolean {
  const t = _registry.get(name);
  if (!t) return false;
  return t.kind === "read" || t.kind === "propose" || t.kind === "ui";
}

export function assertLLMCallable(name: string): void {
  if (!isLLMCallable(name)) {
    const err: CopilotToolError = {
      code: "FORBIDDEN_TOOL",
      message: `Tool ${name} cannot be called by the LLM (kind=${_registry.get(name)?.kind ?? "unknown"})`,
    };
    throw new ToolError(err);
  }
}

export class ToolError extends Error {
  constructor(public detail: CopilotToolError) {
    super(detail.message);
  }
}
