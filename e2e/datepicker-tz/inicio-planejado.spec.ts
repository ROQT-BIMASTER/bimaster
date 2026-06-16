/**
 * E2E — Datepicker "Início planejado" com matriz de fusos horários.
 * Ver helpers/scenarios.ts para a mecânica compartilhada.
 */
import { registerDatepickerScenarios } from "./helpers/scenarios";

registerDatepickerScenarios({
  column: "data_inicio_planejada",
  fieldLabelRegex: /in(í|i)cio planejado/i,
  fieldName: "Início planejado",
});
