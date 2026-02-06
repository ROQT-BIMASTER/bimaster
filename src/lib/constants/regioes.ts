export const REGIOES_UFS: Record<string, string[]> = {
  "Norte": ["AC", "AM", "AP", "PA", "RO", "RR", "TO"],
  "Nordeste": ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
  "Centro-Oeste": ["DF", "GO", "MS", "MT"],
  "Sudeste": ["ES", "MG", "RJ", "SP"],
  "Sul": ["PR", "RS", "SC"],
};

export const REGIOES = Object.keys(REGIOES_UFS);

export function getUFsByRegiao(regiao: string | null): string[] | null {
  if (!regiao) return null;
  return REGIOES_UFS[regiao] || null;
}
