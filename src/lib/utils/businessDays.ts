/**
 * Adiciona N horas úteis a partir de `from`, considerando jornada
 * de 9h–18h em dias úteis (seg–sex). Útil para calcular prazo de SLA.
 */
export function addBusinessHours(from: Date, hours: number): Date {
  const WORK_START = 9;
  const WORK_END = 18;
  const HOURS_PER_DAY = WORK_END - WORK_START;
  const d = new Date(from);
  let remaining = hours;

  // posiciona dentro da janela útil do dia
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  if (d.getHours() < WORK_START) d.setHours(WORK_START, 0, 0, 0);
  if (d.getHours() >= WORK_END) {
    d.setDate(d.getDate() + 1);
    d.setHours(WORK_START, 0, 0, 0);
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  }

  while (remaining > 0) {
    const hoursLeftToday = WORK_END - d.getHours() - d.getMinutes() / 60;
    if (remaining <= hoursLeftToday) {
      d.setTime(d.getTime() + remaining * 3600_000);
      remaining = 0;
    } else {
      remaining -= hoursLeftToday;
      d.setDate(d.getDate() + 1);
      d.setHours(WORK_START, 0, 0, 0);
      if (d.getDay() === 6) d.setDate(d.getDate() + 2);
      if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    }
    if (remaining > HOURS_PER_DAY * 365) break; // segurança
  }
  return d;
}

export function addBusinessDays(from: Date, days: number): Date {
  return addBusinessHours(from, days * 9);
}

export function diffBusinessDays(a: Date, b: Date): number {
  const start = a < b ? new Date(a) : new Date(b);
  const end = a < b ? new Date(b) : new Date(a);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  let count = 0;
  const cur = new Date(start);
  while (cur < end) {
    cur.setDate(cur.getDate() + 1);
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return a < b ? count : -count;
}
