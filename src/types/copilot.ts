// Frontend Copilot types — mirrors supabase/functions/_shared/copilot/types.ts.

export type CitationType = "rag" | "tool_result" | "metric_run" | "web";

export interface Citation {
  citationId: string;
  type: CitationType;
  docId?: string;
  sourceUrl?: string;
  runId?: string;
  toolCallId?: string;
  snippet: string;
  span?: { start: number; end: number };
  confidence: number;
}

export interface SourceRef {
  type: "tool_result" | "metric_run" | "rag";
  toolCallId?: string;
  runId?: string;
  valuePath: string;
}

export type ActionCategory =
  | "task"
  | "report:draft_publish"
  | "report:delivery_sent"
  | "data:export"
  | "permissions"
  | "share_link:external"
  | "finance:write";

export type StepUpScope =
  | "finance:write"
  | "permissions:read"
  | "permissions:write"
  | "tasks:bulk_delete"
  | "data:export"
  | "report:owner_change"
  | "propose_delete";

export interface CopilotActionPayload {
  type: string;
  label: string;
  previewFields: Record<string, unknown>;
  requiresConfirmation: boolean;
  requiresStepUp?: boolean;
  scopeKey?: StepUpScope;
  undoable: boolean;
  category: ActionCategory;
  toolCall: { name: string; args: Record<string, unknown> };
  proposalId: string;
  clientActionId: string;
  sourceRef?: SourceRef;
}

export interface CopilotMessageMeta {
  requestId: string;
  auditId?: string;
  model: string;
  tokens?: { prompt: number; completion: number };
  routedComplexity: "simple" | "complex";
  classifierConfidence?: number;
  unverifiableCount?: number;
}
