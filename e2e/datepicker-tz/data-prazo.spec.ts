/**
 * E2E — Datepicker "Data prazo" com matriz de fusos horários.
 * Ver helpers/scenarios.ts para a mecânica compartilhada.
 */
import { registerDatepickerScenarios } from "./helpers/scenarios";

registerDatepickerScenarios({
  column: "data_prazo",
  fieldLabelRegex: /data prazo/i,
  fieldName: "Data prazo",
});
