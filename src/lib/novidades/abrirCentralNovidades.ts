/**
 * Canal simples para abrir a Central de Novidades a partir de qualquer tela.
 * O `NovidadesCenter` (montado no cabeçalho) escuta este evento.
 */
export const NOVIDADES_OPEN_EVENT = "novidades:abrir-historico";

export function abrirCentralNovidades() {
  window.dispatchEvent(new CustomEvent(NOVIDADES_OPEN_EVENT));
}
