import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Languages } from "lucide-react";
import { useTraduzirTexto, type IdiomaTraducao } from "@/hooks/useTraduzirTexto";
import { cn } from "@/lib/utils";

type TraducoesMap = Partial<Record<IdiomaTraducao, string>>;

interface Props {
  texto: string;
  idiomaOrigem?: IdiomaTraducao | null;
  traducoes?: TraducoesMap;
  /** Persistir cache (ex.: salvar em motivo_traducoes da revisão). */
  onCacheTraducao?: (params: { origem: IdiomaTraducao; traducoes: TraducoesMap }) => void;
  className?: string;
  label?: string;
}

const LABELS: Record<IdiomaTraducao, string> = {
  pt: "Português",
  zh: "中文",
  en: "English",
};

function detectarIdiomaUsuario(): IdiomaTraducao {
  if (typeof navigator === "undefined") return "pt";
  const lang = (navigator.language || "pt").toLowerCase();
  if (lang.startsWith("zh")) return "zh";
  if (lang.startsWith("en")) return "en";
  return "pt";
}

export function TextoComTraducao({
  texto,
  idiomaOrigem,
  traducoes,
  onCacheTraducao,
  className,
  label,
}: Props) {
  const traduzir = useTraduzirTexto();
  const [cache, setCache] = useState<TraducoesMap>(() => ({ ...(traducoes || {}) }));
  const [origem, setOrigem] = useState<IdiomaTraducao | null>(idiomaOrigem || null);
  const idiomaUsuario = useMemo(() => detectarIdiomaUsuario(), []);
  const [ativo, setAtivo] = useState<IdiomaTraducao>(() => {
    if (idiomaOrigem && cache[idiomaOrigem]) return idiomaOrigem;
    if (cache[idiomaUsuario]) return idiomaUsuario;
    return idiomaOrigem || idiomaUsuario;
  });

  useEffect(() => {
    setCache({ ...(traducoes || {}) });
  }, [traducoes]);

  const conteudo = cache[ativo] || (ativo === origem ? texto : "");

  async function selecionarIdioma(alvo: IdiomaTraducao) {
    setAtivo(alvo);
    if (cache[alvo] || traduzir.isPending) return;
    try {
      const r = await traduzir.mutateAsync({ texto, origem: origem || undefined });
      setOrigem(r.origem);
      const novo = { ...cache, ...r.traducoes };
      setCache(novo);
      onCacheTraducao?.({ origem: r.origem, traducoes: novo });
    } catch {
      // toast já exibido em useTraduzirTexto
    }
  }

  const idiomas: IdiomaTraducao[] = ["pt", "zh", "en"];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 flex-wrap">
        {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
        <div className="flex items-center gap-1 ml-auto">
          <Languages className="h-3.5 w-3.5 text-muted-foreground" />
          {idiomas.map((l) => {
            const isAtivo = l === ativo;
            const isOrigem = l === origem;
            return (
              <Button
                key={l}
                size="sm"
                variant={isAtivo ? "default" : "outline"}
                className="h-6 px-2 text-[11px]"
                onClick={() => selecionarIdioma(l)}
                disabled={traduzir.isPending && !cache[l]}
              >
                {LABELS[l]}
                {isOrigem && <span className="ml-1 opacity-60">·orig</span>}
              </Button>
            );
          })}
        </div>
      </div>
      <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap break-words min-h-[3rem]">
        {traduzir.isPending && !conteudo ? (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Traduzindo…
          </span>
        ) : (
          conteudo || <span className="text-muted-foreground italic">Tradução indisponível.</span>
        )}
      </div>
    </div>
  );
}
