// Deterministic proposalId with clientActionId escape hatch.
// See RFC v4.0.0 §A3.
//
// proposalId = sha256(userId | toolName | canonicalArgsHash | timeWindow60s | clientActionId?)
//
// - Same (user, tool, args, window, clientActionId) -> same proposalId -> idempotent retry.
// - Different clientActionId from a distinct click -> different proposalId -> 2 actions allowed.

const encoder = new TextEncoder();

export function canonicalizeArgs(args: unknown): string {
  return JSON.stringify(sortKeys(args));
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.keys(o)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys(o[k]);
        return acc;
      }, {});
  }
  return v;
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface ProposalIdInput {
  userId: string;
  toolName: string;
  args: unknown;
  clientActionId?: string | null;
  /** Window in seconds. Default 60. */
  windowSec?: number;
  /** Override clock for tests. */
  nowMs?: number;
}

export async function computeProposalId(input: ProposalIdInput): Promise<string> {
  const windowSec = input.windowSec ?? 60;
  const now = input.nowMs ?? Date.now();
  const window = Math.floor(now / 1000 / windowSec);
  const argsHash = await sha256Hex(canonicalizeArgs(input.args));
  const key = [
    input.userId,
    input.toolName,
    argsHash,
    String(window),
    input.clientActionId ?? "",
  ].join("|");
  return sha256Hex(key);
}
