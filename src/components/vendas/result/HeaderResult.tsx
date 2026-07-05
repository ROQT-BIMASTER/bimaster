import { ChevronDown } from "lucide-react";
import { FuturaBackButton } from "@/components/fornecedor/FuturaBackButton";

interface Props {
  ano: number;
  onAnoChange: (a: number) => void;
  anos: number[];
}

export function HeaderResult({ ano, onAnoChange, anos }: Props) {
  return (
    <>
      <FuturaBackButton />
      <header className="mt-6 mb-8 flex items-end justify-between flex-wrap gap-6 border-b border-rv-linha pb-8">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-rv-text-suave mb-3">
            Fornecedor · Vendas
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-medium tracking-tight text-rv-ink">
            Análise de Vendas (Result)
          </h1>
          <p className="mt-3 text-sm text-rv-text-suave max-w-xl">
            Panorama executivo das vendas faturadas — ranking por vendedor,
            valor e recorrência de clientes, evolução mensal comparada ao ano
            anterior e crescimento por cliente/vendedor.
          </p>
        </div>

        <div className="flex items-stretch gap-3">
          <div
            className="flex items-center gap-2 border border-rv-linha px-4 text-sm text-rv-ink cursor-default select-none"
            aria-label="Fornecedor selecionado"
            title="Fornecedor"
          >
            <span className="text-[10px] uppercase tracking-wider text-rv-text-suave">Fornecedor</span>
            <span className="font-medium">Result</span>
            <ChevronDown className="w-3.5 h-3.5 text-rv-muted" />
          </div>

          <div className="flex items-center gap-1 border border-rv-linha">
            {anos.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => onAnoChange(a)}
                className={`px-4 py-2 text-xs tabular-nums transition-colors ${
                  a === ano
                    ? "bg-rv-ink text-rv-bg"
                    : "bg-transparent text-rv-text-suave hover:text-rv-ink"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </header>
    </>
  );
}
