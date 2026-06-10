// Executor: orchestrates propose → confirm → execute → audit.
// See RFC v4.0.0 §A3, §A5.

import { computeProposalId } from "../copilot/proposals.ts";
import {
  isUndoable,
  requiresStrongStepUp,
  STRONG_STEP_UP_METHODS,
  type ActionCategory,
  type StepUpScope,
} from "../copilot/types.ts";
import { getTool, ToolError, type ToolContext } from "./registry.ts";

const DEFAULT_TTL_MS = 60 * 60_000; // 1h to consume a proposal

export interface ProposeInput {
  toolName: string;
  args: Record<string, unknown>;
  clientActionId: string; // UUID per click, sent by UI
  category: ActionCategory;
  requiresStepUp?: boolean;
  scopeKey?: StepUpScope;
  preview: Record<string, unknown>;
}

export interface ProposeOutput {
  proposalId: string;
  expiresAt: string;
  category: ActionCategory;
  undoable: boolean;
  requiresStepUp: boolean;
  scopeKey?: StepUpScope;
  preview: Record<string, unknown>;
}

interface SbLike {
  from(t: string): {
    select(c?: string): { eq(k: string, v: unknown): {
      maybeSingle(): Promise<{ data: any; error: any }>;
    } };
    insert(row: any): Promise<{ data: any; error: any }>;
    update(row: any): { eq(k: string, v: unknown): Promise<{ data: any; error: any }> };
    upsert(row: any, opts?: any): Promise<{ data: any; error: any }>;
  };
  rpc(name: string, args?: any): Promise<{ data: any; error: any }>;
}

export async function propose(
  ctx: ToolContext,
  input: ProposeInput,
): Promise<ProposeOutput> {
  const tool = getTool(input.toolName);
  if (!tool || tool.kind !== "propose") {
    throw new ToolError({ code: "FORBIDDEN_TOOL", message: `Not a propose tool: ${input.toolName}` });
  }
  // Validate args eagerly.
  tool.inputSchema.parse(input.args);

  const proposalId = await computeProposalId({
    userId: ctx.userId,
    toolName: input.toolName,
    args: input.args,
    clientActionId: input.clientActionId,
  });
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_MS).toISOString();

  const sb = ctx.supabase as SbLike;
  const { error } = await sb.from("copilot_proposals").upsert(
    {
      proposal_id: proposalId,
      user_id: ctx.userId,
      tool_name: input.toolName,
      args_hash: JSON.stringify(input.args),
      client_action_id: input.clientActionId,
      preview: input.preview,
      requires_step_up: !!input.requiresStepUp,
      scope_key: input.scopeKey ?? null,
      category: input.category,
      expires_at: expiresAt,
    },
    { onConflict: "proposal_id" },
  );
  if (error) throw new ToolError({ code: "VALIDATION_ERROR", message: String(error.message ?? error) });

  return {
    proposalId,
    expiresAt,
    category: input.category,
    undoable: isUndoable(input.category),
    requiresStepUp: !!input.requiresStepUp,
    scopeKey: input.scopeKey,
    preview: input.preview,
  };
}

export interface ConfirmInput {
  proposalId: string;
  stepUpToken?: { method: "totp" | "email_otp" | "sso_reauth"; value: string };
}

export interface ConfirmOutput {
  auditId: string;
  result: unknown;
  reused: boolean;
}

export async function confirm(ctx: ToolContext, input: ConfirmInput): Promise<ConfirmOutput> {
  const sb = ctx.supabase as SbLike;
  const { data: proposal, error: pErr } = await sb
    .from("copilot_proposals")
    .select("*")
    .eq("proposal_id", input.proposalId)
    .maybeSingle();
  if (pErr || !proposal) {
    throw new ToolError({ code: "NOT_FOUND", message: "Proposal not found" });
  }
  if (proposal.user_id !== ctx.userId) {
    throw new ToolError({ code: "PERMISSION_DENIED", message: "Not your proposal" });
  }
  if (new Date(proposal.expires_at).getTime() < Date.now()) {
    throw new ToolError({ code: "VALIDATION_ERROR", message: "Proposal expired" });
  }

  // Idempotency: already consumed → return same auditId.
  if (proposal.consumed_at && proposal.audit_id) {
    return { auditId: proposal.audit_id, result: { reused: true }, reused: true };
  }

  // Step-up enforcement.
  if (proposal.requires_step_up) {
    const scope = proposal.scope_key as StepUpScope | null;
    if (!input.stepUpToken) {
      throw new ToolError({ code: "PERMISSION_DENIED", message: "STEP_UP_REQUIRED" });
    }
    if (scope && requiresStrongStepUp(scope) && !STRONG_STEP_UP_METHODS.has(input.stepUpToken.method)) {
      throw new ToolError({
        code: "PERMISSION_DENIED",
        message: `Step-up method ${input.stepUpToken.method} not allowed for ${scope}; require TOTP or SSO reauth`,
      });
    }
    // Real token validation happens in caller via _shared/totp.ts or step_up_scopes table.
  }

  // Resolve and run the matching execute_* tool.
  const executeToolName = proposal.tool_name.replace(/^propose_/, "execute_");
  const exec = getTool(executeToolName);
  if (!exec || exec.kind !== "execute") {
    throw new ToolError({
      code: "VALIDATION_ERROR",
      message: `No execute tool for ${proposal.tool_name}`,
    });
  }
  const argsObj = JSON.parse(proposal.args_hash);
  exec.inputSchema.parse(argsObj);
  const result = await exec.handler(argsObj, ctx);

  // Audit row.
  const undoable = isUndoable(proposal.category);
  const { data: audit, error: aErr } = await sb.from("copilot_audit_log").insert({
    user_id: ctx.userId,
    copilot_id: ctx.copilotId,
    tool_name: executeToolName,
    proposal_id: proposal.proposal_id,
    category: proposal.category,
    undoable,
    diff: { args: argsObj, result },
    result_ref: extractResultRef(result),
  });
  if (aErr) throw new ToolError({ code: "VALIDATION_ERROR", message: String(aErr.message ?? aErr) });
  const auditId =
    (Array.isArray(audit) ? audit[0]?.id : (audit as any)?.id) ??
    // best-effort fallback: read it back
    (await sb.from("copilot_audit_log").select("id").eq("proposal_id", proposal.proposal_id).maybeSingle())
      .data?.id;

  await sb.from("copilot_proposals")
    .update({ consumed_at: new Date().toISOString(), audit_id: auditId })
    .eq("proposal_id", proposal.proposal_id);

  return { auditId: String(auditId), result, reused: false };
}

function extractResultRef(r: unknown): Record<string, unknown> {
  if (!r || typeof r !== "object") return {};
  const o = r as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if ("id" in o) out.id = o.id;
  if ("url" in o) out.url = o.url;
  if ("entity" in o) out.entity = o.entity;
  return out;
}
