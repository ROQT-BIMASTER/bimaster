// Shared types for the unified copilot architecture (RFC v4.0.0).

export type CitationType = "rag" | "tool_result" | "metric_run" | "web";

export interface Citation {
  citationId: string; // "C1", "C2", ...
  type: CitationType;
  docId?: string;
  sourceUrl?: string;
  runId?: string;
  toolCallId?: string;
  snippet: string; // <= 240 chars
  span?: { start: number; end: number };
  confidence: number; // 0..1
}

export interface SourceRef {
  type: "tool_result" | "metric_run" | "rag";
  toolCallId?: string;
  runId?: string;
  valuePath: string; // JSONPath into payload
}

export type RoutedComplexity = "simple" | "complex";

export interface CopilotMessageMeta {
  requestId: string;
  auditId?: string;
  model: string;
  tokens?: { prompt: number; completion: number };
  routedComplexity: RoutedComplexity;
  classifierConfidence?: number;
}

export type UndoableCategory =
  | "task" // create/update/status/reassign
  | "report:draft_publish";

export type NonUndoableCategory =
  | "report:delivery_sent"
  | "data:export"
  | "permissions"
  | "share_link:external"
  | "finance:write";

export type ActionCategory = UndoableCategory | NonUndoableCategory;

export const UNDOABLE_CATEGORIES: ReadonlySet<string> = new Set<string>([
  "task",
  "report:draft_publish",
]);

export function isUndoable(category: string): boolean {
  return UNDOABLE_CATEGORIES.has(category);
}

export type StepUpScope =
  | "finance:write"
  | "permissions:read"
  | "permissions:write"
  | "tasks:bulk_delete"
  | "data:export"
  | "report:owner_change"
  | "propose_delete";

// Step-up methods strong enough for high-risk scopes (finance/permissions).
export const STRONG_STEP_UP_METHODS = new Set(["totp", "sso_reauth"]);

export function requiresStrongStepUp(scope: StepUpScope): boolean {
  return scope === "finance:write" || scope.startsWith("permissions:");
}

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

export interface CopilotAssistantPayload {
  assistantMessage: string;
  citations: Citation[];
  actions: CopilotActionPayload[];
  facts: Array<{ text: string; citationId: string }>;
  interpretations: Array<{ text: string; basis?: string }>;
  meta: CopilotMessageMeta;
}

export type CopilotErrorCode =
  | "PERMISSION_DENIED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN_TOOL"
  | "STEP_UP_REQUIRED"
  | "RATE_LIMITED";

export interface CopilotToolError {
  code: CopilotErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
