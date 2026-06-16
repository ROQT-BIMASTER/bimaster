/**
 * E2E — Datepicker "Próxima ação" com matriz de fusos horários.
 * Ver helpers/scenarios.ts para a mecânica compartilhada.
 */
import { registerDatepickerScenarios } from "./helpers/scenarios";

registerDatepickerScenarios({
  column: "data_proxima_acao",
  fieldLabelRegex: /pr(ó|o)xima a(ç|c)(ã|a)o/i,
  fieldName: "Próxima ação",
});
