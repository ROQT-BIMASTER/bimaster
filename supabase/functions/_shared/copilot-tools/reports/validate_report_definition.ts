// validate_report_definition — wraps the linter for use as a copilot tool.

import { z } from "https://esm.sh/zod@3.23.8";
import {
  lintReportLayout,
  summarizeLint,
  canPublish,
  type ReportDefinitionLike,
} from "./linter.ts";

export const ValidateReportDefinitionInput = z
  .object({
    definition: z.any(),
    mode: z.enum(["draft", "publish"]).default("publish"),
  })
  .strict();

export type ValidateReportDefinitionInput = z.infer<typeof ValidateReportDefinitionInput>;

export function validateReportDefinition(input: ValidateReportDefinitionInput) {
  const findings = lintReportLayout(input.definition as ReportDefinitionLike);
  const summary = summarizeLint(findings);
  return {
    ok: input.mode === "draft" ? true : summary.ok,
    canPublish: canPublish(findings),
    findings,
    summary,
  };
}
