/**
 * Lane packing for multi-day calendar bars.
 *
 * Recebe um conjunto de eventos com `startCol` e `endCol` (índices 0–6 dentro
 * de uma linha-semana) e devolve o número da "lane" (linha empilhada) para
 * cada evento, garantindo que eventos sobrepostos não colidam visualmente.
 */

export interface LaneEvent {
  id: string;
  startCol: number; // 0–6, inclusive
  endCol: number;   // 0–6, inclusive (>= startCol)
}

export interface PackedLane<T extends LaneEvent> {
  event: T;
  lane: number; // 0-based row inside the week
}

/**
 * First-fit decreasing algorithm. O(n²) — suficiente até ~200 eventos/semana.
 */
export function packLanes<T extends LaneEvent>(events: T[]): PackedLane<T>[] {
  const sorted = [...events].sort((a, b) => {
    if (a.startCol !== b.startCol) return a.startCol - b.startCol;
    // mais longos primeiro em caso de empate
    return (b.endCol - b.startCol) - (a.endCol - a.startCol);
  });

  const lanes: number[] = []; // lanes[i] = última coluna ocupada pela lane i
  const result: PackedLane<T>[] = [];

  for (const ev of sorted) {
    let assigned = -1;
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] < ev.startCol) {
        assigned = i;
        break;
      }
    }
    if (assigned === -1) {
      assigned = lanes.length;
      lanes.push(ev.endCol);
    } else {
      lanes[assigned] = ev.endCol;
    }
    result.push({ event: ev, lane: assigned });
  }

  return result;
}

/**
 * Quebra um intervalo [start, end] em segmentos por linha-semana.
 * `weekRows` é uma lista de arrays de 7 datas (segunda → domingo).
 * Retorna os índices de coluna por linha em que o evento aparece.
 */
export function splitEventByWeekRow(
  start: Date,
  end: Date,
  weekRows: Date[][],
): Array<{ rowIndex: number; startCol: number; endCol: number }> {
  const segments: Array<{ rowIndex: number; startCol: number; endCol: number }> = [];
  const startTs = start.getTime();
  const endTs = end.getTime();

  weekRows.forEach((row, rowIndex) => {
    const rowStart = row[0].getTime();
    const rowEnd = row[6].getTime() + 24 * 60 * 60 * 1000 - 1;
    if (endTs < rowStart || startTs > rowEnd) return;

    let startCol = 0;
    let endCol = 6;
    for (let c = 0; c < 7; c++) {
      if (row[c].getTime() <= startTs && startTs <= row[c].getTime() + 24 * 60 * 60 * 1000 - 1) {
        startCol = c;
        break;
      }
      if (startTs < row[c].getTime()) {
        startCol = 0;
        break;
      }
    }
    for (let c = 6; c >= 0; c--) {
      if (row[c].getTime() <= endTs && endTs <= row[c].getTime() + 24 * 60 * 60 * 1000 - 1) {
        endCol = c;
        break;
      }
      if (endTs > row[c].getTime() + 24 * 60 * 60 * 1000 - 1) {
        endCol = 6;
        break;
      }
    }
    segments.push({ rowIndex, startCol, endCol });
  });

  return segments;
}
