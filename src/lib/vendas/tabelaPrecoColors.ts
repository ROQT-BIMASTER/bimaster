// Paleta consistente para tabelas de preço (gráfico + tabela).
// Cores em HSL inline (não há tokens semânticos para cada coleção da marca).
const FIXED: Record<string, string> = {
  PRIMAVERA: "hsl(142 70% 45%)",
  CLEAR: "hsl(199 89% 48%)",
  MUDE: "hsl(280 65% 60%)",
  BLACK: "hsl(220 13% 18%)",
  "RUBY ROSE": "hsl(340 82% 52%)",
  "VERAO": "hsl(38 92% 50%)",
  "VERÃO": "hsl(38 92% 50%)",
  "MAGICO": "hsl(265 83% 58%)",
  "MÁGICO": "hsl(265 83% 58%)",
  VIP: "hsl(45 93% 47%)",
  "(SEM TABELA)": "hsl(215 16% 65%)",
};

const FALLBACK = [
  "hsl(173 58% 39%)",
  "hsl(12 76% 61%)",
  "hsl(197 37% 50%)",
  "hsl(43 74% 66%)",
  "hsl(27 87% 67%)",
  "hsl(291 47% 51%)",
  "hsl(120 35% 45%)",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function getTabelaColor(nome: string | null | undefined): string {
  const key = (nome ?? "(sem tabela)").trim().toUpperCase();
  if (FIXED[key]) return FIXED[key];
  return FALLBACK[hash(key) % FALLBACK.length];
}
